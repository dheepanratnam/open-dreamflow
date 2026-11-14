/**
 * @open-dreamflow/mcp-client — RFC 9728 / RFC 8414 / RFC 7591 MCP OAuth 2.1 + PKCE Manager
 *
 * Implements standard MCP OAuth discovery, Dynamic Client Registration, PKCE S256
 * authorization URL construction, authorization_code exchange, safe JWT account decoding,
 * and automatic `ExternalMcpHost` Streamable HTTP registration (first-class for
 * Higgsfield Official MCP `https://mcp.higgsfield.ai/mcp`, reusable for any OAuth MCP server).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type {
  ExternalMcpHost,
  ExternalMcpToolSchema,
  McpOAuthAccountInfo,
} from './external-mcp-host.js';

export type McpOAuthStep =
  | 'registering'
  | 'awaiting_login'
  | 'exchanging_token'
  | 'discovering_tools'
  | 'connected'
  | 'error';

export const DEFAULT_OAUTH_MCP_ENDPOINTS: Record<
  string,
  { mcpUrl: string; serverName: string }
> = {
  higgsfield: {
    mcpUrl: 'https://mcp.higgsfield.ai/mcp',
    serverName: 'Higgsfield Official MCP',
  },
};

export interface PublicMcpOAuthSession {
  sessionId: string;
  state: string;
  platformId: string;
  userId?: string;
  serverName: string;
  mcpUrl: string;
  redirectUri: string;
  authorizeUrl?: string;
  step: McpOAuthStep;
  serverId?: string;
  account?: McpOAuthAccountInfo;
  tools?: ExternalMcpToolSchema[];
  toolsCount?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface InternalMcpOAuthSession extends PublicMcpOAuthSession {
  codeVerifier: string;
  clientId: string;
  tokenEndpoint: string;
  authorizationEndpoint: string;
  registrationEndpoint?: string;
  resource: string;
  scope: string;
}

interface CachedRegisteredClient {
  clientId: string;
  mcpUrl: string;
  redirectUri: string;
  registrationEndpoint: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  resource: string;
  registeredAt: string;
}

interface OAuthMetadataDiscovery {
  resource: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint?: string;
  scopesSupported: string[];
}

function writeJsonAtomic(targetPath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, targetPath);
}

function decodeJwtPayloadUnsafe(token?: string): Record<string, unknown> | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function extractAccountFromTokens(
  tokenResp: Record<string, unknown>
): McpOAuthAccountInfo | undefined {
  const idClaims = decodeJwtPayloadUnsafe(
    typeof tokenResp.id_token === 'string' ? tokenResp.id_token : undefined
  );
  const accessClaims = decodeJwtPayloadUnsafe(
    typeof tokenResp.access_token === 'string' ? tokenResp.access_token : undefined
  );

  const merged = { ...(accessClaims || {}), ...(idClaims || {}) };
  const email = typeof merged.email === 'string' ? merged.email : undefined;
  const name = typeof merged.name === 'string' ? merged.name : undefined;
  const username =
    typeof merged.preferred_username === 'string'
      ? merged.preferred_username
      : typeof merged.username === 'string'
        ? merged.username
        : undefined;
  const avatarUrl =
    typeof merged.picture === 'string'
      ? merged.picture
      : typeof merged.avatar_url === 'string'
        ? merged.avatar_url
        : undefined;
  const sub = typeof merged.sub === 'string' ? merged.sub : undefined;
  const orgId = typeof merged.org_id === 'string' ? merged.org_id : undefined;

  if (!email && !name && !username && !sub) return undefined;
  return {
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(username ? { username } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(sub ? { sub } : {}),
    ...(orgId ? { orgId } : {}),
  };
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class McpOAuthManager {
  private readonly clientsPath: string;
  private readonly externalMcpHost: ExternalMcpHost;
  private readonly onSessionUpdate?: (session: PublicMcpOAuthSession) => void;
  private readonly sessions = new Map<string, InternalMcpOAuthSession>();
  private readonly stateToSessionId = new Map<string, string>();
  private clientCache: Record<string, CachedRegisteredClient> = {};

  constructor(options: {
    dataDir: string;
    externalMcpHost: ExternalMcpHost;
    onSessionUpdate?: (session: PublicMcpOAuthSession) => void;
  }) {
    this.clientsPath = path.join(options.dataDir, 'mcp-oauth-clients.json');
    this.externalMcpHost = options.externalMcpHost;
    this.onSessionUpdate = options.onSessionUpdate;
    this.loadClientCache();
  }

  private loadClientCache(): void {
    try {
      if (fs.existsSync(this.clientsPath)) {
        const parsed = JSON.parse(fs.readFileSync(this.clientsPath, 'utf8'));
        if (typeof parsed === 'object' && parsed !== null) {
          this.clientCache = parsed as Record<string, CachedRegisteredClient>;
        }
      }
    } catch {
      this.clientCache = {};
    }
  }

  private saveClientCache(): void {
    try {
      writeJsonAtomic(this.clientsPath, this.clientCache);
    } catch {
      // Ignore write failures in ephemeral test directories
    }
  }

  public toPublicSession(session: InternalMcpOAuthSession): PublicMcpOAuthSession {
    return {
      sessionId: session.sessionId,
      state: session.state,
      platformId: session.platformId,
      ...(session.userId ? { userId: session.userId } : {}),
      serverName: session.serverName,
      mcpUrl: session.mcpUrl,
      redirectUri: session.redirectUri,
      authorizeUrl: session.authorizeUrl,
      step: session.step,
      ...(session.serverId ? { serverId: session.serverId } : {}),
      ...(session.account ? { account: session.account } : {}),
      ...(session.tools ? { tools: session.tools, toolsCount: session.tools.length } : {}),
      ...(session.error ? { error: session.error } : {}),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private emitUpdate(session: InternalMcpOAuthSession): PublicMcpOAuthSession {
    session.updatedAt = new Date().toISOString();
    const pub = this.toPublicSession(session);
    this.onSessionUpdate?.(pub);
    return pub;
  }

  public getSession(sessionId: string): PublicMcpOAuthSession | null {
    const s = this.sessions.get(sessionId);
    return s ? this.toPublicSession(s) : null;
  }

  private async fetchJsonOrNull(url: string): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const parsed = await res.json();
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  public async discoverOAuthMetadata(mcpUrl: string): Promise<OAuthMetadataDiscovery> {
    const parsedMcpUrl = new URL(mcpUrl);
    const origin = parsedMcpUrl.origin;

    // 1. RFC 9728 Protected Resource Metadata
    const pathSuffix = parsedMcpUrl.pathname !== '/' ? parsedMcpUrl.pathname.replace(/\/+$/, '') : '';
    const protectedRes =
      (pathSuffix
        ? await this.fetchJsonOrNull(`${origin}/.well-known/oauth-protected-resource${pathSuffix}`)
        : null) || (await this.fetchJsonOrNull(`${origin}/.well-known/oauth-protected-resource`));

    const resource =
      typeof protectedRes?.resource === 'string' && protectedRes.resource.trim()
        ? protectedRes.resource.trim()
        : mcpUrl;

    let authServerOrigin = origin;
    if (
      Array.isArray(protectedRes?.authorization_servers) &&
      typeof protectedRes.authorization_servers[0] === 'string'
    ) {
      try {
        authServerOrigin = new URL(protectedRes.authorization_servers[0]).origin;
      } catch {
        authServerOrigin = origin;
      }
    }

    // 2. RFC 8414 Authorization Server Metadata (with OIDC fallback)
    const authMeta =
      (await this.fetchJsonOrNull(`${authServerOrigin}/.well-known/oauth-authorization-server`)) ||
      (await this.fetchJsonOrNull(`${authServerOrigin}/.well-known/openid-configuration`));

    if (!authMeta) {
      throw new Error(
        `MCP server at ${origin} does not expose .well-known/oauth-authorization-server metadata.`
      );
    }

    const authorizationEndpoint =
      typeof authMeta.authorization_endpoint === 'string'
        ? authMeta.authorization_endpoint.trim()
        : '';
    const tokenEndpoint =
      typeof authMeta.token_endpoint === 'string' ? authMeta.token_endpoint.trim() : '';
    const registrationEndpoint =
      typeof authMeta.registration_endpoint === 'string'
        ? authMeta.registration_endpoint.trim()
        : undefined;

    if (!authorizationEndpoint || !tokenEndpoint) {
      throw new Error(
        `OAuth metadata at ${authServerOrigin} is missing authorization_endpoint or token_endpoint.`
      );
    }

    const rawScopes = Array.isArray(protectedRes?.scopes_supported)
      ? protectedRes.scopes_supported
      : Array.isArray(authMeta.scopes_supported)
        ? authMeta.scopes_supported
        : ['openid', 'email', 'offline_access'];
    const scopesSupported = rawScopes.map((s) => String(s)).filter(Boolean);

    return {
      resource,
      authorizationEndpoint,
      tokenEndpoint,
      registrationEndpoint,
      scopesSupported,
    };
  }

  private async ensureClientRegistered(
    mcpUrl: string,
    redirectUri: string,
    discovery: OAuthMetadataDiscovery
  ): Promise<string> {
    const cacheKey = `${mcpUrl}|${redirectUri}`;
    const cached = this.clientCache[cacheKey];
    if (
      cached &&
      cached.clientId &&
      cached.tokenEndpoint === discovery.tokenEndpoint &&
      cached.registrationEndpoint === (discovery.registrationEndpoint || '')
    ) {
      return cached.clientId;
    }

    if (!discovery.registrationEndpoint) {
      throw new Error(
        `MCP OAuth server for ${mcpUrl} does not expose dynamic registration_endpoint.`
      );
    }

    const redirectUris = Array.from(
      new Set([
        redirectUri,
        'http://localhost:3001/api/mcp/oauth/callback',
        'http://127.0.0.1:3001/api/mcp/oauth/callback',
      ])
    );

    const regRes = await fetch(discovery.registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_name: 'Open-DreamFlow Studio',
        redirect_uris: redirectUris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
      signal: AbortSignal.timeout(12_000),
    });

    const regJson = (await regRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!regRes.ok || typeof regJson.client_id !== 'string' || !regJson.client_id.trim()) {
      throw new Error(
        `Dynamic client registration failed (${regRes.status}): ${String(
          regJson.error_description || regJson.error || JSON.stringify(regJson)
        )}`
      );
    }

    const clientId = regJson.client_id.trim();
    this.clientCache[cacheKey] = {
      clientId,
      mcpUrl,
      redirectUri,
      registrationEndpoint: discovery.registrationEndpoint,
      authorizationEndpoint: discovery.authorizationEndpoint,
      tokenEndpoint: discovery.tokenEndpoint,
      resource: discovery.resource,
      registeredAt: new Date().toISOString(),
    };
    this.saveClientCache();
    return clientId;
  }

  public async startOAuth(options: {
    platformId?: string;
    userId?: string;
    mcpUrl?: string;
    serverName?: string;
    redirectUri: string;
  }): Promise<PublicMcpOAuthSession> {
    const platformId = String(options.platformId || 'higgsfield').trim().toLowerCase() || 'higgsfield';
    const userId = String(options.userId || 'owner').trim() || 'owner';
    const preset = DEFAULT_OAUTH_MCP_ENDPOINTS[platformId];
    const mcpUrl = (options.mcpUrl || preset?.mcpUrl || '').trim();
    if (!mcpUrl) {
      throw new Error(`No MCP URL provided or known for platform "${platformId}".`);
    }

    const serverName =
      (options.serverName || preset?.serverName || `${platformId} Official MCP`).trim();
    const redirectUri = options.redirectUri;

    const sessionId = `mcpoauth_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const state = crypto.randomBytes(24).toString('base64url');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const nowIso = new Date().toISOString();

    const session: InternalMcpOAuthSession = {
      sessionId,
      state,
      platformId,
      userId,
      serverName,
      mcpUrl,
      redirectUri,
      step: 'registering',
      codeVerifier,
      clientId: '',
      tokenEndpoint: '',
      authorizationEndpoint: '',
      resource: mcpUrl,
      scope: 'openid email offline_access',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.sessions.set(sessionId, session);
    this.stateToSessionId.set(state, sessionId);
    this.emitUpdate(session);

    try {
      const discovery = await this.discoverOAuthMetadata(mcpUrl);
      const clientId = await this.ensureClientRegistered(mcpUrl, redirectUri, discovery);
      const preferredScopes = ['openid', 'email', 'offline_access'].filter(
        (s) => discovery.scopesSupported.length === 0 || discovery.scopesSupported.includes(s)
      );
      const scope =
        preferredScopes.length > 0
          ? preferredScopes.join(' ')
          : discovery.scopesSupported.join(' ') || 'openid email offline_access';

      const authUrl = new URL(discovery.authorizationEndpoint);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('resource', discovery.resource);

      session.clientId = clientId;
      session.tokenEndpoint = discovery.tokenEndpoint;
      session.authorizationEndpoint = discovery.authorizationEndpoint;
      session.registrationEndpoint = discovery.registrationEndpoint;
      session.resource = discovery.resource;
      session.scope = scope;
      session.authorizeUrl = authUrl.toString();
      session.step = 'awaiting_login';
      return this.emitUpdate(session);
    } catch (err) {
      session.step = 'error';
      session.error = err instanceof Error ? err.message : String(err);
      this.emitUpdate(session);
      throw err;
    }
  }

  public async handleCallback(params: {
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
  }): Promise<{ ok: boolean; statusCode: number; html: string; session?: PublicMcpOAuthSession }> {
    const state = String(params.state || '').trim();
    const sessionId = state ? this.stateToSessionId.get(state) : undefined;
    const session = sessionId ? this.sessions.get(sessionId) : undefined;

    if (!session) {
      return {
        ok: false,
        statusCode: 400,
        html: this.renderCallbackHtml({
          ok: false,
          title: 'Authorization Session Expired',
          subtitle: 'Could not match OAuth callback state. Close this window and click Connect again in Open-DreamFlow.',
          platformId: 'higgsfield',
        }),
      };
    }

    if (params.error) {
      const msg = params.errorDescription || params.error || 'Authorization cancelled or denied.';
      session.step = 'error';
      session.error = msg;
      const pub = this.emitUpdate(session);
      return {
        ok: false,
        statusCode: 400,
        session: pub,
        html: this.renderCallbackHtml({
          ok: false,
          title: `${session.serverName} Cancelled`,
          subtitle: msg,
          platformId: session.platformId,
          sessionId: session.sessionId,
        }),
      };
    }

    const code = String(params.code || '').trim();
    if (!code) {
      const msg = 'Missing authorization "code" in OAuth callback.';
      session.step = 'error';
      session.error = msg;
      const pub = this.emitUpdate(session);
      return {
        ok: false,
        statusCode: 400,
        session: pub,
        html: this.renderCallbackHtml({
          ok: false,
          title: 'Missing OAuth Code',
          subtitle: msg,
          platformId: session.platformId,
          sessionId: session.sessionId,
        }),
      };
    }

    try {
      // Transition 1: Exchange Authorization Code + PKCE code_verifier
      session.step = 'exchanging_token';
      this.emitUpdate(session);

      const form = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: session.clientId,
        code,
        redirect_uri: session.redirectUri,
        code_verifier: session.codeVerifier,
        resource: session.resource,
      });

      const tokRes = await fetch(session.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(15_000),
      });

      const tokJson = (await tokRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!tokRes.ok || typeof tokJson.access_token !== 'string' || !tokJson.access_token) {
        const errText = String(
          tokJson.error_description || tokJson.error || `HTTP ${tokRes.status}`
        );
        if (/client/i.test(errText)) {
          delete this.clientCache[`${session.mcpUrl}|${session.redirectUri}`];
          this.saveClientCache();
        }
        throw new Error(`OAuth token exchange failed: ${errText}`);
      }

      const account = extractAccountFromTokens(tokJson);
      const expiresIn =
        typeof tokJson.expires_in === 'number' && tokJson.expires_in > 0
          ? tokJson.expires_in
          : 3600;

      // Transition 2: Connect Streamable HTTP MCP & Discover Tools
      session.step = 'discovering_tools';
      session.account = account;
      this.emitUpdate(session);

      const baseServerId = `mcp_${session.platformId}`;
      const uid = String(session.userId || 'owner').trim() || 'owner';
      const serverId = uid === 'owner' ? baseServerId : `${baseServerId}__${uid}`;
      const server = await this.externalMcpHost.registerOrUpdateServer({
        id: serverId,
        name: session.serverName,
        platformId: session.platformId,
        transport: 'http',
        url: session.mcpUrl,
        oauth: {
          clientId: session.clientId,
          tokenEndpoint: session.tokenEndpoint,
          authorizationEndpoint: session.authorizationEndpoint,
          registrationEndpoint: session.registrationEndpoint,
          accessToken: tokJson.access_token,
          refreshToken:
            typeof tokJson.refresh_token === 'string' ? tokJson.refresh_token : undefined,
          expiresAt: Date.now() + expiresIn * 1000,
          scope: typeof tokJson.scope === 'string' ? tokJson.scope : session.scope,
          resource: session.resource,
          account,
        },
      });

      // Transition 3: Connected!
      session.step = 'connected';
      session.serverId = server.id;
      session.tools = server.tools;
      session.account = account || server.account;
      const pub = this.emitUpdate(session);

      return {
        ok: true,
        statusCode: 200,
        session: pub,
        html: this.renderCallbackHtml({
          ok: true,
          title: `${session.serverName} Connected!`,
          subtitle: `${
            session.account?.email || session.account?.name || 'Account authorized'
          } · ${server.tools.length} MCP function${server.tools.length === 1 ? '' : 's'} ready.`,
          platformId: session.platformId,
          sessionId: session.sessionId,
          serverId: server.id,
          account: session.account,
          toolsCount: server.tools.length,
        }),
      };
    } catch (err) {
      session.step = 'error';
      session.error = err instanceof Error ? err.message : String(err);
      const pub = this.emitUpdate(session);
      return {
        ok: false,
        statusCode: 502,
        session: pub,
        html: this.renderCallbackHtml({
          ok: false,
          title: `${session.serverName} Connection Failed`,
          subtitle: session.error,
          platformId: session.platformId,
          sessionId: session.sessionId,
        }),
      };
    }
  }

  private renderCallbackHtml(opts: {
    ok: boolean;
    title: string;
    subtitle: string;
    platformId: string;
    sessionId?: string;
    serverId?: string;
    account?: McpOAuthAccountInfo;
    toolsCount?: number;
  }): string {
    const postMsgPayload = JSON.stringify({
      type: 'dreamflow_mcp_oauth_complete',
      ok: opts.ok,
      platformId: opts.platformId,
      sessionId: opts.sessionId || null,
      serverId: opts.serverId || null,
      account: opts.account || null,
      toolsCount: opts.toolsCount || 0,
      error: opts.ok ? null : opts.subtitle,
    });

    const iconSvg = opts.ok
      ? `<svg class="check" viewBox="0 0 52 52"><circle class="check-circle" cx="26" cy="26" r="24" fill="none"/><path class="check-mark" fill="none" d="M14 27l7.5 7.5L38 18"/></svg>`
      : `<svg class="err" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="none" stroke="#ef4444" stroke-width="2.5"/><path d="M18 18l16 16M34 18L18 34" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/></svg>`;

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(opts.title)} — Open-DreamFlow</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #0e0e0e;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 420px;
      background: #171717;
      border: 1px solid ${opts.ok ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'};
      border-radius: 16px;
      padding: 28px 24px;
      text-align: center;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
    }
    .icon-wrap { width: 60px; height: 60px; margin: 0 auto 16px; }
    svg { width: 60px; height: 60px; display: block; }
    .check-circle {
      stroke: #10b981;
      stroke-width: 2.5;
      stroke-dasharray: 166;
      stroke-dashoffset: 166;
      animation: stroke 0.5s cubic-bezier(0.65, 0, 0.45, 1) forwards;
    }
    .check-mark {
      stroke: #10b981;
      stroke-width: 3.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 48;
      stroke-dashoffset: 48;
      animation: stroke 0.35s cubic-bezier(0.65, 0, 0.45, 1) 0.35s forwards;
    }
    @keyframes stroke { 100% { stroke-dashoffset: 0; } }
    h1 { font-size: 18px; margin: 0 0 8px; font-weight: 600; }
    p { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin: 0 0 18px; word-break: break-word; }
    .hint { font-size: 11px; color: #71717a; }
    button {
      margin-top: 12px;
      background: #27272a;
      color: #f4f4f5;
      border: 1px solid #3f3f46;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 12px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">${iconSvg}</div>
    <h1>${escapeHtml(opts.title)}</h1>
    <p>${escapeHtml(opts.subtitle)}</p>
    <div class="hint">${
      opts.ok
        ? 'Returning to Open-DreamFlow Studio automatically...'
        : 'You can close this window and retry in Open-DreamFlow.'
    }</div>
    <button onclick="window.close()">Close Window</button>
  </div>
  <script>
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(${postMsgPayload}, '*');
      }
    } catch (_) {}
    ${opts.ok ? 'setTimeout(function () { try { window.close(); } catch (_) {} }, 1200);' : ''}
  </script>
</body>
</html>`;
  }
}
