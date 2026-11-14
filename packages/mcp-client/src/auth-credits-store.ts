import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as http from 'node:http';

export type UserRole = 'owner' | 'member';

export interface SharedPlatformGrant {
  enabled: boolean;
  capCredits: number | null;
  usedCredits: number;
  updatedAt: string;
}

export interface UserBillingMetaEntry {
  resetDay?: number;
  manualExpiresAt?: string;
  manualBudgetCredits?: number;
}

export interface EncryptedBlob {
  iv: string;
  tag: string;
  data: string;
}

export interface StoredUserRecord {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  passcodeHash: string;
  invitePasscodePreview?: string;
  sharedGrants: Record<string, SharedPlatformGrant>;
  encryptedByok?: EncryptedBlob;
  billingMeta: Record<string, UserBillingMetaEntry>;
  createdAt: string;
  updatedAt: string;
}

export interface StoredSessionRecord {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface UsageLedgerEntry {
  id: string;
  userId: string;
  userDisplayName: string;
  platformId: string;
  modelId: string;
  modality: string;
  creditsUsed: number;
  creditSource: 'own' | 'shared' | 'owner';
  nodeId?: string;
  timestamp: string;
}

export interface CalibratedRateEntry {
  credits: number;
  samples: number;
  updatedAt: string;
}

interface AuthVaultState {
  version: 1;
  users: Record<string, StoredUserRecord>;
  sessions: Record<string, StoredSessionRecord>;
  usageLedger: UsageLedgerEntry[];
  calibratedRates: Record<string, CalibratedRateEntry>;
}

export interface PublicUserInfo {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type AuthResolveResult =
  | { ok: true; user: StoredUserRecord; authenticatedViaToken: boolean }
  | { ok: false; status: number; error: string };

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasscode(passcode: string, storedHash: string): boolean {
  const [salt, hex] = String(storedHash || '').split(':');
  if (!salt || !hex) return false;
  try {
    const derived = crypto.scryptSync(passcode, salt, 32);
    const expected = Buffer.from(hex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function writeJsonAtomic(targetPath: string, data: unknown, mode = 0o600): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode });
  fs.chmodSync(tmp, mode);
  fs.renameSync(tmp, targetPath);
  fs.chmodSync(targetPath, mode);
}

export function isLocalhostOriginOrHost(raw: string | undefined): boolean {
  if (!raw || !raw.trim()) return true;
  const trimmed = raw.trim().toLowerCase();
  let hostname = trimmed;
  if (trimmed.includes('://')) {
    try {
      hostname = new URL(trimmed).hostname.toLowerCase();
    } catch {
      return false;
    }
  } else {
    hostname = trimmed.replace(/^\[|\]$/g, '').split(':')[0];
  }
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

export function isLocalhostHttpRequest(req: http.IncomingMessage): boolean {
  const hostOk = isLocalhostOriginOrHost(
    typeof req.headers.host === 'string' ? req.headers.host : undefined
  );
  const rawOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : undefined;
  const originOk =
    rawOrigin && rawOrigin.toLowerCase().startsWith('chrome-extension://')
      ? true
      : isLocalhostOriginOrHost(rawOrigin);
  const forwardedHost =
    typeof req.headers['x-forwarded-host'] === 'string' ? req.headers['x-forwarded-host'] : undefined;
  const fwdOk = isLocalhostOriginOrHost(forwardedHost);
  return hostOk && originOk && fwdOk;
}

export class AuthCreditsStore {
  private readonly dataDir: string;
  private readonly vaultPath: string;
  private readonly masterKeyPath: string;
  private masterKey: Buffer;
  private state: AuthVaultState;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.vaultPath = path.join(dataDir, 'auth-vault.json');
    this.masterKeyPath = path.join(dataDir, '.vault-master.key');
    this.masterKey = this.loadOrCreateMasterKey();
    this.state = this.loadState();
    this.ensureOwnerSeeded();
  }

  private loadOrCreateMasterKey(): Buffer {
    const envSecret = String(process.env.DREAMFLOW_VAULT_SECRET || '').trim();
    if (envSecret) {
      return crypto.createHash('sha256').update(envSecret).digest();
    }
    fs.mkdirSync(this.dataDir, { recursive: true });
    try {
      if (fs.existsSync(this.masterKeyPath)) {
        const hex = fs.readFileSync(this.masterKeyPath, 'utf8').trim();
        if (/^[0-9a-f]{64}$/i.test(hex)) {
          return Buffer.from(hex, 'hex');
        }
      }
    } catch {
      // Regenerate below
    }
    const key = crypto.randomBytes(32);
    const tmp = `${this.masterKeyPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, key.toString('hex'), { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, this.masterKeyPath);
    fs.chmodSync(this.masterKeyPath, 0o600);
    return key;
  }

  private loadState(): AuthVaultState {
    try {
      if (fs.existsSync(this.vaultPath)) {
        const parsed = JSON.parse(fs.readFileSync(this.vaultPath, 'utf8')) as Partial<AuthVaultState>;
        if (parsed && typeof parsed === 'object' && parsed.users) {
          return {
            version: 1,
            users: parsed.users || {},
            sessions: parsed.sessions || {},
            usageLedger: Array.isArray(parsed.usageLedger) ? parsed.usageLedger : [],
            calibratedRates: parsed.calibratedRates || {},
          };
        }
      }
    } catch {
      // Reinitialize clean vault if corrupt
    }
    return {
      version: 1,
      users: {},
      sessions: {},
      usageLedger: [],
      calibratedRates: {},
    };
  }

  private persist(): void {
    writeJsonAtomic(this.vaultPath, this.state, 0o600);
  }

  private ensureOwnerSeeded(): void {
    const now = new Date().toISOString();
    const envEmail = (process.env.DREAMFLOW_OWNER_EMAIL || 'owner@dreamflow.studio')
      .trim()
      .toLowerCase();
    const envPasscode = process.env.DREAMFLOW_OWNER_PASSCODE || 'dreamflow2026';
    if (!this.state.users.owner) {
      this.state.users.owner = {
        id: 'owner',
        email: envEmail,
        displayName: 'Owner',
        role: 'owner',
        passcodeHash: hashPasscode(envPasscode),
        sharedGrants: {},
        billingMeta: {},
        createdAt: now,
        updatedAt: now,
      };
      this.persist();
    } else if (
      process.env.DREAMFLOW_OWNER_EMAIL &&
      this.state.users.owner.email !== envEmail
    ) {
      this.state.users.owner.email = envEmail;
      this.state.users.owner.updatedAt = now;
      this.persist();
    }
  }

  private encryptObject(obj: Record<string, unknown>): EncryptedBlob {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: ciphertext.toString('base64'),
    };
  }

  private decryptObject(blob?: EncryptedBlob): Record<string, unknown> {
    if (!blob || !blob.iv || !blob.tag || !blob.data) return {};
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.masterKey,
        Buffer.from(blob.iv, 'base64')
      );
      decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(blob.data, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      const parsed = JSON.parse(plain);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  public toPublicUser(u: StoredUserRecord): PublicUserInfo {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  public getOwnerUser(): StoredUserRecord {
    return this.state.users.owner;
  }

  public getOwnerDefaultEmail(): string {
    return this.state.users.owner?.email || 'owner@dreamflow.studio';
  }

  public getUserById(userId: string): StoredUserRecord | null {
    return this.state.users[userId] || null;
  }

  public extractTokenFromRequest(req: http.IncomingMessage, urlObj?: URL): string {
    const authHeader =
      typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim();
    }
    const queryToken = urlObj?.searchParams.get('token')?.trim() || '';
    return queryToken;
  }

  public getUserByToken(rawToken: string): StoredUserRecord | null {
    const token = String(rawToken || '').trim();
    if (!token) return null;
    const tokenHash = sha256Hex(token);
    const sess = this.state.sessions[tokenHash];
    if (!sess) return null;
    if (Date.parse(sess.expiresAt) <= Date.now()) {
      delete this.state.sessions[tokenHash];
      this.persist();
      return null;
    }
    const user = this.state.users[sess.userId];
    if (!user) {
      delete this.state.sessions[tokenHash];
      this.persist();
      return null;
    }
    return user;
  }

  public resolveRequestAuth(req: http.IncomingMessage, urlObj?: URL): AuthResolveResult {
    const token = this.extractTokenFromRequest(req, urlObj);
    if (token) {
      const user = this.getUserByToken(token);
      if (!user) {
        return { ok: false, status: 401, error: 'Invalid or expired session' };
      }
      return { ok: true, user, authenticatedViaToken: true };
    }

    const requireAuthHeader =
      String(req.headers['x-dreamflow-require-auth'] || '').trim() === '1';
    const envRequireAuth = process.env.DREAMFLOW_REQUIRE_AUTH === 'true';
    const isLocal = isLocalhostHttpRequest(req);

    if (requireAuthHeader || envRequireAuth || !isLocal) {
      return { ok: false, status: 401, error: 'Authentication required' };
    }

    return {
      ok: true,
      user: this.getOwnerUser(),
      authenticatedViaToken: false,
    };
  }

  public login(
    emailRaw: string,
    passcodeRaw: string
  ):
    | {
        ok: true;
        token: string;
        user: PublicUserInfo;
        sharedGrants: Record<string, SharedPlatformGrant>;
        ownVaultSummary: { configuredPlatforms: string[]; billingMeta: Record<string, UserBillingMetaEntry> };
      }
    | { ok: false; error: string } {
    const email = String(emailRaw || '').trim().toLowerCase();
    const passcode = String(passcodeRaw || '');
    if (!email || !passcode) {
      return { ok: false, error: 'Email and passcode are required.' };
    }
    const user = Object.values(this.state.users).find((u) => u.email.toLowerCase() === email);
    if (!user || !verifyPasscode(passcode, user.passcodeHash)) {
      return { ok: false, error: 'Invalid email or passcode.' };
    }

    const token = `dfw_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = sha256Hex(token);
    const now = Date.now();
    this.state.sessions[tokenHash] = {
      tokenHash,
      userId: user.id,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    };
    this.persist();

    const byok = this.getUserDecryptedByok(user.id);
    const configuredPlatforms = Object.entries(byok)
      .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
      .map(([k]) => k);

    return {
      ok: true,
      token,
      user: this.toPublicUser(user),
      sharedGrants: { ...user.sharedGrants },
      ownVaultSummary: {
        configuredPlatforms,
        billingMeta: { ...user.billingMeta },
      },
    };
  }

  public logout(rawToken: string): void {
    const token = String(rawToken || '').trim();
    if (!token) return;
    const tokenHash = sha256Hex(token);
    if (this.state.sessions[tokenHash]) {
      delete this.state.sessions[tokenHash];
      this.persist();
    }
  }

  public getUserDecryptedByok(userId: string): Record<string, string> {
    const user = this.state.users[userId];
    if (!user) return {};
    const raw = this.decryptObject(user.encryptedByok);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    return out;
  }

  public getUserBillingMeta(userId: string): Record<string, UserBillingMetaEntry> {
    return { ...(this.state.users[userId]?.billingMeta || {}) };
  }

  public saveUserVault(
    userId: string,
    payload: {
      byok?: Record<string, unknown>;
      billingMeta?: Record<string, UserBillingMetaEntry>;
    }
  ): StoredUserRecord {
    const user = this.state.users[userId];
    if (!user) throw new Error('User not found.');
    if (payload.byok && typeof payload.byok === 'object') {
      const current = this.getUserDecryptedByok(userId);
      const merged: Record<string, string> = { ...current };
      for (const [k, v] of Object.entries(payload.byok)) {
        if (v === null || v === '') {
          delete merged[k];
        } else if (typeof v === 'string' && v.trim()) {
          merged[k] = v.trim();
        }
      }
      user.encryptedByok = this.encryptObject(merged);
    }
    if (payload.billingMeta && typeof payload.billingMeta === 'object') {
      user.billingMeta = { ...user.billingMeta };
      for (const [plat, meta] of Object.entries(payload.billingMeta)) {
        if (!meta || typeof meta !== 'object') continue;
        user.billingMeta[plat] = {
          ...(user.billingMeta[plat] || {}),
          ...meta,
        };
      }
    }
    user.updatedAt = new Date().toISOString();
    this.persist();
    return user;
  }

  public updateProfile(
    userId: string,
    updates: { displayName?: string; email?: string; passcode?: string }
  ): PublicUserInfo {
    const user = this.state.users[userId];
    if (!user) throw new Error('User not found.');
    if (typeof updates.email === 'string' && updates.email.trim()) {
      const nextEmail = updates.email.trim().toLowerCase();
      const collision = Object.values(this.state.users).find(
        (u) => u.id !== userId && u.email.toLowerCase() === nextEmail
      );
      if (collision) {
        throw new Error('Another user already uses that email.');
      }
      user.email = nextEmail;
    }
    if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
      user.displayName = updates.displayName.trim();
    }
    if (typeof updates.passcode === 'string' && updates.passcode.length > 0) {
      user.passcodeHash = hashPasscode(updates.passcode);
      if (user.role === 'member') {
        user.invitePasscodePreview = updates.passcode;
      }
    }
    user.updatedAt = new Date().toISOString();
    this.persist();
    return this.toPublicUser(user);
  }

  public listTeamMembersForOwner(): Array<{
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    invitePasscodePreview?: string;
    sharedGrants: Record<string, SharedPlatformGrant>;
    createdAt: string;
    updatedAt: string;
  }> {
    return Object.values(this.state.users)
      .filter((u) => u.role !== 'owner')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        ...(u.invitePasscodePreview ? { invitePasscodePreview: u.invitePasscodePreview } : {}),
        sharedGrants: { ...u.sharedGrants },
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }));
  }

  public upsertInvite(input: {
    email: string;
    displayName: string;
    passcode: string;
    sharedGrants?: Record<string, { enabled: boolean; capCredits: number | null }>;
  }) {
    const email = String(input.email || '').trim().toLowerCase();
    const displayName = String(input.displayName || '').trim() || email.split('@')[0] || 'Member';
    const passcode = String(input.passcode || '').trim();
    if (!email || !passcode) {
      throw new Error('Invite email and passcode are required.');
    }

    const now = new Date().toISOString();
    const existing = Object.values(this.state.users).find(
      (u) => u.email.toLowerCase() === email
    );
    if (existing?.role === 'owner') {
      throw new Error('Cannot overwrite workspace owner via invite.');
    }

    const id = existing?.id || `usr_${crypto.randomBytes(5).toString('hex')}`;
    const nextGrants: Record<string, SharedPlatformGrant> = {
      ...(existing?.sharedGrants || {}),
    };
    if (input.sharedGrants && typeof input.sharedGrants === 'object') {
      for (const [plat, cfg] of Object.entries(input.sharedGrants)) {
        if (!cfg || typeof cfg !== 'object') continue;
        const prev = nextGrants[plat];
        nextGrants[plat] = {
          enabled: Boolean(cfg.enabled),
          capCredits:
            cfg.capCredits === null || cfg.capCredits === undefined
              ? null
              : Math.max(0, Math.round(Number(cfg.capCredits) || 0)),
          usedCredits: prev?.usedCredits || 0,
          updatedAt: now,
        };
      }
    }

    const record: StoredUserRecord = {
      id,
      email,
      displayName,
      role: 'member',
      passcodeHash: hashPasscode(passcode),
      invitePasscodePreview: passcode,
      sharedGrants: nextGrants,
      encryptedByok: existing?.encryptedByok,
      billingMeta: existing?.billingMeta || {},
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.state.users[id] = record;
    this.persist();

    return {
      id: record.id,
      email: record.email,
      displayName: record.displayName,
      role: record.role,
      invitePasscodePreview: record.invitePasscodePreview,
      sharedGrants: { ...record.sharedGrants },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  public updateMemberGrants(
    memberId: string,
    payload: {
      grants?: Record<string, { enabled: boolean; capCredits: number | null }>;
      resetUsagePlatformId?: string;
      passcode?: string;
      displayName?: string;
    }
  ) {
    const user = this.state.users[memberId];
    if (!user || user.role === 'owner') {
      throw new Error('Member not found.');
    }
    const now = new Date().toISOString();
    if (payload.grants && typeof payload.grants === 'object') {
      for (const [plat, cfg] of Object.entries(payload.grants)) {
        if (!cfg || typeof cfg !== 'object') continue;
        const prev = user.sharedGrants[plat];
        user.sharedGrants[plat] = {
          enabled: Boolean(cfg.enabled),
          capCredits:
            cfg.capCredits === null || cfg.capCredits === undefined
              ? null
              : Math.max(0, Math.round(Number(cfg.capCredits) || 0)),
          usedCredits: prev?.usedCredits || 0,
          updatedAt: now,
        };
      }
    }
    if (payload.resetUsagePlatformId && user.sharedGrants[payload.resetUsagePlatformId]) {
      user.sharedGrants[payload.resetUsagePlatformId].usedCredits = 0;
      user.sharedGrants[payload.resetUsagePlatformId].updatedAt = now;
    }
    if (typeof payload.passcode === 'string' && payload.passcode.trim()) {
      user.passcodeHash = hashPasscode(payload.passcode.trim());
      user.invitePasscodePreview = payload.passcode.trim();
    }
    if (typeof payload.displayName === 'string' && payload.displayName.trim()) {
      user.displayName = payload.displayName.trim();
    }
    user.updatedAt = now;
    this.persist();

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      invitePasscodePreview: user.invitePasscodePreview,
      sharedGrants: { ...user.sharedGrants },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  public deleteMember(memberId: string): boolean {
    const user = this.state.users[memberId];
    if (!user || user.role === 'owner') return false;
    delete this.state.users[memberId];
    for (const [tokHash, sess] of Object.entries(this.state.sessions)) {
      if (sess.userId === memberId) {
        delete this.state.sessions[tokHash];
      }
    }
    this.persist();
    return true;
  }

  public getMePayload(user: StoredUserRecord): Record<string, unknown> {
    const ownByok = this.getUserDecryptedByok(user.id);
    const ledger =
      user.role === 'owner'
        ? this.state.usageLedger.slice(0, 100)
        : this.state.usageLedger.filter((e) => e.userId === user.id).slice(0, 100);
    return {
      ok: true,
      user: this.toPublicUser(user),
      sharedGrants: { ...user.sharedGrants },
      ownByok,
      billingMeta: { ...user.billingMeta },
      ...(user.role === 'owner' ? { teamMembers: this.listTeamMembersForOwner() } : {}),
      usageLedger: ledger,
    };
  }

  public recordCreditUsage(entry: {
    userId: string;
    platformId: string;
    modelId: string;
    modality: string;
    creditsUsed: number;
    creditSource: 'own' | 'shared' | 'owner';
    nodeId?: string;
  }): void {
    const user = this.state.users[entry.userId];
    const credits = Math.max(0, Number(entry.creditsUsed) || 0);
    const now = new Date().toISOString();

    if (entry.creditSource === 'shared' && user && user.role === 'member') {
      const grant = user.sharedGrants[entry.platformId];
      if (grant) {
        grant.usedCredits = Math.round((grant.usedCredits + credits) * 100) / 100;
        grant.updatedAt = now;
      }
    }

    const record: UsageLedgerEntry = {
      id: `led_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      userId: entry.userId,
      userDisplayName: user?.displayName || entry.userId,
      platformId: entry.platformId,
      modelId: entry.modelId,
      modality: entry.modality,
      creditsUsed: credits,
      creditSource: entry.creditSource,
      ...(entry.nodeId ? { nodeId: entry.nodeId } : {}),
      timestamp: now,
    };
    this.state.usageLedger.unshift(record);
    if (this.state.usageLedger.length > 500) {
      this.state.usageLedger.length = 500;
    }
    this.persist();
  }

  public getCalibratedRates(): Record<string, CalibratedRateEntry> {
    return { ...this.state.calibratedRates };
  }

  public updateCalibratedRate(modelKey: string, observedDelta: number): void {
    if (!Number.isFinite(observedDelta) || observedDelta <= 0) return;
    const prev = this.state.calibratedRates[modelKey];
    const samples = prev ? Math.min(20, prev.samples + 1) : 1;
    const blended = prev
      ? Math.round(((prev.credits * prev.samples + observedDelta) / samples) * 100) / 100
      : Math.round(observedDelta * 100) / 100;
    this.state.calibratedRates[modelKey] = {
      credits: blended,
      samples,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
  }
}
