import React, { useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Coins,
  Copy,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { PlatformBrandIcon } from './PlatformBrandIcon';
import type { PlatformId } from '../types/studio';

const SHAREABLE_PLATFORM_IDS: Array<{ id: PlatformId; label: string }> = [
  { id: 'higgsfield', label: 'Higgsfield' },
  { id: 'dreamina', label: 'Dreamina' },
  { id: 'kling', label: 'Kling' },
  { id: 'elevenlabs', label: 'ElevenLabs' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'fal', label: 'fal.ai' },
  { id: 'google-flow', label: 'Google Flow / Gemini' },
];

export const TeamCreditsModal: React.FC = () => {
  const {
    teamCreditsModalOpen,
    teamCreditsModalTab,
    closeTeamCreditsModal,
    openTeamCreditsModal,
    authUser,
    billingMeta,
    updateBillingMetaEntry,
    creditsSummary,
    refreshCreditsSummary,
    teamMembers,
    usageLedger,
    inviteTeamMember,
    updateTeamMemberGrants,
    removeTeamMember,
    updateOwnProfile,
    logoutStudioUser,
    openProviderModal,
  } = useStudioStore();

  const [refreshingCredits, setRefreshingCredits] = useState(false);

  // Billing config local edits
  const [higgsResetDay, setHiggsResetDay] = useState<number>(
    billingMeta?.higgsfield?.resetDay || 1
  );
  const [dreaminaResetDay, setDreaminaResetDay] = useState<number>(
    billingMeta?.dreamina?.resetDay || 1
  );

  // Owner Invite Form
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePasscode, setInvitePasscode] = useState('');
  const [inviteGrants, setInviteGrants] = useState<
    Record<string, { enabled: boolean; capCredits: number | null }>
  >({
    higgsfield: { enabled: true, capCredits: 300 },
    dreamina: { enabled: true, capCredits: 400 },
    kling: { enabled: false, capCredits: 200 },
    elevenlabs: { enabled: true, capCredits: 100 },
    openai: { enabled: false, capCredits: 150 },
    fal: { enabled: false, capCredits: 150 },
    'google-flow': { enabled: false, capCredits: 150 },
  });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [createdLoginInfo, setCreatedLoginInfo] = useState<{
    displayName: string;
    email: string;
    passcode: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Member Profile Form
  const [profileName, setProfileName] = useState(authUser?.displayName || '');
  const [profileEmail, setProfileEmail] = useState(authUser?.email || '');
  const [profilePasscode, setProfilePasscode] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  if (!teamCreditsModalOpen) return null;

  const isOwner = !authUser || authUser.role === 'owner';

  const handleRefreshSummary = async () => {
    setRefreshingCredits(true);
    await refreshCreditsSummary(true);
    setRefreshingCredits(false);
  };

  const handleSaveResetDay = async (platformId: string, day: number) => {
    const cleanDay = Math.max(1, Math.min(31, Math.round(day || 1)));
    const prev = billingMeta[platformId] || {};
    await updateBillingMetaEntry(platformId, {
      ...prev,
      resetDay: cleanDay,
    });
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || !invitePasscode.trim()) {
      setInviteError('Fill in name, email, and passcode.');
      return;
    }
    setInviting(true);
    setInviteError(null);
    const cleanPass = invitePasscode.trim();
    const cleanEmail = inviteEmail.trim();
    const cleanName = inviteName.trim();
    const res = await inviteTeamMember({
      displayName: cleanName,
      email: cleanEmail,
      passcode: cleanPass,
      sharedGrants: inviteGrants,
    });
    setInviting(false);
    if (!res.ok) {
      setInviteError(res.error || 'Could not invite member');
      return;
    }
    setCreatedLoginInfo({
      displayName: cleanName,
      email: cleanEmail,
      passcode: cleanPass,
    });
    setInviteName('');
    setInviteEmail('');
    setInvitePasscode('');
  };

  const copyText = (text: string, id: string) => {
    try {
      void navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    const res = await updateOwnProfile({
      displayName: profileName.trim() || undefined,
      email: profileEmail.trim() || undefined,
      passcode: profilePasscode.trim() || undefined,
    });
    setProfileSaving(false);
    if (res.ok) {
      setProfilePasscode('');
      setProfileMsg('Profile saved.');
    } else {
      setProfileMsg(res.error || 'Failed to update profile.');
    }
  };

  const dreaminaSummary = creditsSummary?.platforms?.find(
    (p) => p.platformId === 'dreamina'
  );
  const higgsSummary = creditsSummary?.platforms?.find(
    (p) => p.platformId === 'higgsfield'
  );
  const elevenSummary = creditsSummary?.platforms?.find(
    (p) => p.platformId === 'elevenlabs'
  );
  const otherSummaries = (creditsSummary?.platforms || []).filter(
    (p) =>
      p.platformId !== 'dreamina' &&
      p.platformId !== 'higgsfield' &&
      p.platformId !== 'elevenlabs'
  );

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 font-sans text-white">
      <div className="w-full max-w-[920px] max-h-[88vh] flex flex-col rounded-2xl border border-white/[0.1] bg-[#111113] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#141417]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#041b24] border border-[#20D5EC]/30 flex items-center justify-center text-[#20D5EC]">
              <Coins size={16} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-white">
                Credit Intelligence &amp; Team Sharing
              </h2>
              <p className="text-[11px] text-white/50">
                {authUser
                  ? `${authUser.displayName || authUser.email} · ${
                      authUser.role === 'owner' ? 'Workspace Owner' : 'Invited Member'
                    }`
                  : 'Local Workspace Mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRefreshSummary()}
              disabled={refreshingCredits}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 text-[11px] font-medium text-white/85 transition-colors"
            >
              <RefreshCw
                size={12}
                className={refreshingCredits ? 'animate-spin text-[#20D5EC]' : ''}
              />
              <span>Refresh Balances</span>
            </button>
            <button
              type="button"
              onClick={closeTeamCreditsModal}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-0 border-b border-white/[0.07] bg-[#131316]">
          <button
            type="button"
            onClick={() => openTeamCreditsModal('credits')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
              teamCreditsModalTab === 'credits'
                ? 'border-[#20D5EC] text-white'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Coins size={13} />
            <span>Credit Intelligence</span>
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => openTeamCreditsModal('team')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
                teamCreditsModalTab === 'team'
                  ? 'border-[#20D5EC] text-white'
                  : 'border-transparent text-white/50 hover:text-white/80'
              }`}
            >
              <Users size={13} />
              <span>Friends &amp; Shared Credits</span>
              {teamMembers.length > 0 && (
                <span className="rounded-full bg-white/[0.08] px-1.5 py-0.2 text-[10px] tabular-nums text-white/75">
                  {teamMembers.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => openTeamCreditsModal('account')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
              teamCreditsModalTab === 'account'
                ? 'border-[#20D5EC] text-white'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Shield size={13} />
            <span>My Account &amp; Sign Out</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: CREDIT INTELLIGENCE */}
          {teamCreditsModalTab === 'credits' && (
            <>
              {creditsSummary?.expiringSoonAlerts &&
                creditsSummary.expiringSoonAlerts.length > 0 && (
                  <div className="space-y-2">
                    {creditsSummary.expiringSoonAlerts.map((al, idx) => (
                      <div
                        key={`${al.platformId}_${idx}`}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-[12px] ${
                          al.severity === 'urgent'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                            : 'border-[#20D5EC]/30 bg-[#20D5EC]/10 text-cyan-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <AlertTriangle size={14} className="shrink-0" />
                          <span>
                            {al.credits.toLocaleString()} credits expiring in{' '}
                            {al.daysRemaining}d ({al.expiresAt})
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold tabular-nums uppercase tracking-wide opacity-80">
                          {al.platformId}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

              {/* Primary Platform Credit Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dreamina Expiry Timeline */}
                <div className="rounded-xl border border-white/[0.08] bg-[#161619] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformBrandIcon platformId="dreamina" size="md" />
                      <div>
                        <h3 className="text-[13px] font-semibold text-white">
                          Dreamina Credits
                        </h3>
                        <p className="text-[11px] text-white/50">
                          {dreaminaSummary?.connected
                            ? dreaminaSummary.plan ||
                              dreaminaSummary.vipLevel ||
                              'Connected Session'
                            : 'Not connected yet'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[16px] font-semibold tabular-nums text-white">
                        {dreaminaSummary?.credits != null
                          ? `${dreaminaSummary.credits.toLocaleString()} cr`
                          : dreaminaSummary?.supportsUnlimited
                          ? '∞ Unlimited'
                          : '—'}
                      </div>
                      {(dreaminaSummary?.nextResetAt || dreaminaSummary?.expiresAt) && (
                        <div className="text-[10px] text-white/45 tabular-nums">
                          Renews{' '}
                          {dreaminaSummary.nextResetAt || dreaminaSummary.expiresAt}
                        </div>
                      )}
                    </div>
                  </div>

                  {dreaminaSummary?.buckets && dreaminaSummary.buckets.length > 0 ? (
                    <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                        Expiry Buckets Timeline
                      </div>
                      {dreaminaSummary.buckets.map((b, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg bg-black/35 px-2.5 py-1.5 text-[11px]"
                        >
                          <span className="font-semibold tabular-nums text-white">
                            {b.credits.toLocaleString()} cr
                          </span>
                          <span className="text-amber-300/90 tabular-nums">
                            {b.expiresAt} ({b.daysRemaining}d left)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-white/45 pt-1 border-t border-white/[0.06]">
                      Monthly renewal day tracking:
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <label className="flex items-center gap-1.5 text-[11px] text-white/60">
                      <CalendarClock size={12} />
                      <span>Reset Day</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={dreaminaResetDay}
                        onChange={(e) => setDreaminaResetDay(Number(e.target.value))}
                        className="w-14 rounded-lg bg-black/50 border border-white/[0.1] px-2 py-1 text-[11px] tabular-nums text-white text-center"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void handleSaveResetDay('dreamina', dreaminaResetDay)
                        }
                        className="rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-1 text-[11px] text-white/85"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                {/* Higgsfield Unlimited / Credits & Monthly Reset Picker */}
                <div className="rounded-xl border border-white/[0.08] bg-[#161619] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformBrandIcon platformId="higgsfield" size="md" />
                      <div>
                        <h3 className="text-[13px] font-semibold text-white">
                          Higgsfield AI
                        </h3>
                        <p className="text-[11px] text-white/50">
                          {higgsSummary?.connected
                            ? higgsSummary.plan || 'MCP Live Balance'
                            : 'Connect via MCP OAuth'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[16px] font-semibold tabular-nums text-white">
                        {higgsSummary?.supportsUnlimited && !higgsSummary?.credits
                          ? '∞ Unlimited'
                          : higgsSummary?.credits != null
                          ? `${higgsSummary.credits.toLocaleString()} cr`
                          : '—'}
                      </div>
                      {higgsSummary?.nextResetAt && (
                        <div className="text-[10px] text-white/45 tabular-nums">
                          Resets {higgsSummary.nextResetAt}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-white/55">
                    Configure your monthly billing reset date so Open-DreamFlow tracks
                    renewals and shared member credit caps accurately.
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                    <label className="flex items-center gap-1.5 text-[11px] text-white/60">
                      <CalendarClock size={12} />
                      <span>Monthly Reset Day (1–31)</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={higgsResetDay}
                        onChange={(e) => setHiggsResetDay(Number(e.target.value))}
                        className="w-14 rounded-lg bg-black/50 border border-white/[0.1] px-2 py-1 text-[11px] tabular-nums text-white text-center"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void handleSaveResetDay('higgsfield', higgsResetDay)
                        }
                        className="rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-1 text-[11px] text-white/85"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ElevenLabs + Additional Connected Platforms */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/[0.08] bg-[#161619] p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PlatformBrandIcon platformId="elevenlabs" size="md" />
                      <span className="text-[12px] font-semibold">ElevenLabs</span>
                    </div>
                    <span className="text-[11px] tabular-nums text-white/75">
                      {elevenSummary?.limit != null && elevenSummary?.credits != null
                        ? `${elevenSummary.credits.toLocaleString()} / ${elevenSummary.limit.toLocaleString()} chars`
                        : elevenSummary?.connected
                        ? 'Connected'
                        : 'Not configured'}
                    </span>
                  </div>
                  {elevenSummary?.limit && elevenSummary.credits != null ? (
                    <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full bg-[#20D5EC]"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((elevenSummary.credits / elevenSummary.limit) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                {otherSummaries.slice(0, 5).map((plat) => (
                  <div
                    key={plat.platformId}
                    className="rounded-xl border border-white/[0.08] bg-[#161619] p-3.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <PlatformBrandIcon
                        platformId={plat.platformId as PlatformId}
                        size="md"
                      />
                      <div>
                        <div className="text-[12px] font-medium text-white">
                          {plat.name || plat.platformId}
                        </div>
                        <div className="text-[10px] text-white/45">
                          {plat.connected
                            ? plat.plan || 'Connected'
                            : 'Disconnected'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-[11px] font-medium tabular-nums text-white/85">
                      {plat.supportsUnlimited && plat.credits == null
                        ? '∞ Unlim'
                        : plat.credits != null
                        ? `${plat.credits.toLocaleString()} cr`
                        : plat.connected
                        ? 'Live'
                        : '—'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Member Shared Pools & Connect My Own Account */}
              <div className="rounded-xl border border-white/[0.08] bg-[#151518] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[13px] font-semibold text-white">
                      {isOwner
                        ? 'Owner Shared Pools Overview'
                        : 'Your Shared Pools & Own Connections'}
                    </h3>
                    <p className="text-[11px] text-white/50">
                      {isOwner
                        ? 'Configure per-friend shared credit allocations in the Friends & Shared Credits tab.'
                        : 'Use workspace shared pools granted by the owner, or connect your own keys/accounts anytime.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      closeTeamCreditsModal();
                      openProviderModal('byok');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#20D5EC] hover:bg-[#3CE0F5] px-3 py-1.5 text-[11px] font-semibold text-[#051419] shrink-0"
                  >
                    <KeyRound size={12} />
                    <span>Connect My Own Account</span>
                  </button>
                </div>

                {creditsSummary?.sharedPools && creditsSummary.sharedPools.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {creditsSummary.sharedPools.map((pool) => {
                      const pct =
                        pool.capCredits && pool.capCredits > 0
                          ? Math.min(
                              100,
                              Math.round((pool.usedCredits / pool.capCredits) * 100)
                            )
                          : 0;
                      return (
                        <div
                          key={pool.platformId}
                          className="rounded-lg border border-white/[0.07] bg-black/35 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <PlatformBrandIcon
                                platformId={pool.platformId as PlatformId}
                                size="sm"
                              />
                              <span className="text-[12px] font-medium">
                                {pool.platformId}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                pool.enabled
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-white/[0.06] text-white/40'
                              }`}
                            >
                              {pool.enabled ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <div className="text-[11px] tabular-nums text-white/75">
                            Used {pool.usedCredits.toLocaleString()}
                            {pool.capCredits != null
                              ? ` / ${pool.capCredits.toLocaleString()} cr cap`
                              : ' · Uncapped'}
                          </div>
                          {pool.capCredits != null && (
                            <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
                              <div
                                className="h-full bg-[#20D5EC]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-white/40">
                    No shared pool allocations active for this view yet.
                  </p>
                )}
              </div>
            </>
          )}

          {/* TAB 2: FRIENDS & SHARED CREDITS (OWNER ONLY) */}
          {teamCreditsModalTab === 'team' && isOwner && (
            <>
              {/* Create Friend Invite */}
              <form
                onSubmit={handleCreateInvite}
                className="rounded-xl border border-white/[0.08] bg-[#161619] p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus size={15} className="text-[#20D5EC]" />
                    <h3 className="text-[13px] font-semibold">Invite Friend to Workspace</h3>
                  </div>
                  <span className="text-[11px] text-white/45">
                    Toggle platforms &amp; credit caps to share
                  </span>
                </div>

                {inviteError && (
                  <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                    {inviteError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Friend Name (e.g. Alex)"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="rounded-lg bg-black/50 border border-white/[0.1] px-3 py-2 text-[12px] text-white placeholder:text-white/30"
                  />
                  <input
                    type="email"
                    placeholder="alex@studio.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="rounded-lg bg-black/50 border border-white/[0.1] px-3 py-2 text-[12px] text-white placeholder:text-white/30"
                  />
                  <input
                    type="text"
                    placeholder="Passcode (e.g. alex2026)"
                    value={invitePasscode}
                    onChange={(e) => setInvitePasscode(e.target.value)}
                    className="rounded-lg bg-black/50 border border-white/[0.1] px-3 py-2 text-[12px] tabular-nums text-white placeholder:text-white/30"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SHAREABLE_PLATFORM_IDS.map((plat) => {
                    const g = inviteGrants[plat.id] || {
                      enabled: false,
                      capCredits: 200,
                    };
                    return (
                      <div
                        key={plat.id}
                        className={`rounded-lg border p-2.5 space-y-2 transition-colors ${
                          g.enabled
                            ? 'border-[#20D5EC]/40 bg-[#20D5EC]/[0.06]'
                            : 'border-white/[0.07] bg-black/30'
                        }`}
                      >
                        <label className="flex items-center justify-between gap-2 cursor-pointer">
                          <span className="flex items-center gap-1.5 text-[11px] font-medium">
                            <PlatformBrandIcon platformId={plat.id} size="sm" />
                            <span>{plat.label}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={g.enabled}
                            onChange={(e) =>
                              setInviteGrants((prev) => ({
                                ...prev,
                                [plat.id]: {
                                  ...g,
                                  enabled: e.target.checked,
                                },
                              }))
                            }
                            className="accent-[#20D5EC]"
                          />
                        </label>
                        {g.enabled && (
                          <div className="flex items-center justify-between gap-1 text-[10px] text-white/60">
                            <span>Cap cr:</span>
                            <input
                              type="number"
                              min={0}
                              placeholder="∞"
                              value={g.capCredits ?? ''}
                              onChange={(e) =>
                                setInviteGrants((prev) => ({
                                  ...prev,
                                  [plat.id]: {
                                    ...g,
                                    capCredits:
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-16 rounded bg-black/60 border border-white/[0.1] px-1.5 py-0.5 text-[11px] tabular-nums text-white text-right"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3">
                  {createdLoginInfo ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-200">
                      <Check size={13} />
                      <span className="tabular-nums">
                        Ready: {createdLoginInfo.email} / {createdLoginInfo.passcode}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            `Open-DreamFlow Studio Invite\nURL: ${window.location.origin}\nEmail: ${createdLoginInfo.email}\nPasscode: ${createdLoginInfo.passcode}`,
                            'new-invite'
                          )
                        }
                        className="ml-2 inline-flex items-center gap-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold"
                      >
                        <Copy size={11} />
                        <span>
                          {copiedId === 'new-invite' ? 'Copied' : 'Copy Login Info'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div />
                  )}

                  <button
                    type="submit"
                    disabled={inviting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#20D5EC] hover:bg-[#3CE0F5] disabled:opacity-60 px-4 py-2 text-[12px] font-semibold text-[#051419]"
                  >
                    <Plus size={14} />
                    <span>{inviting ? 'Creating…' : 'Create Friend Invite'}</span>
                  </button>
                </div>
              </form>

              {/* Active Team Members */}
              <div className="space-y-3">
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-white/50">
                  Invited Friends ({teamMembers.length})
                </h3>
                {teamMembers.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.07] bg-[#151518] p-6 text-center text-[12px] text-white/45">
                    No friends invited yet. Create an invite above to share your connected
                    platforms safely with optional credit caps.
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-xl border border-white/[0.08] bg-[#161619] p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[13px] font-semibold text-white">
                            {member.displayName}
                          </div>
                          <div className="text-[11px] text-white/50">{member.email}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                `Open-DreamFlow Studio Login\nURL: ${window.location.origin}\nEmail: ${member.email}`,
                                `m_${member.id}`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1 text-[11px] text-white/80"
                          >
                            <Copy size={11} />
                            <span>
                              {copiedId === `m_${member.id}`
                                ? 'Copied!'
                                : 'Copy Login Info'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void removeTeamMember(member.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 text-[11px] text-rose-200"
                          >
                            <Trash2 size={11} />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {SHAREABLE_PLATFORM_IDS.map((plat) => {
                          const grant = member.sharedGrants?.[plat.id] || {
                            enabled: false,
                            capCredits: null,
                            usedCredits: 0,
                          };
                          return (
                            <div
                              key={plat.id}
                              className="rounded-lg border border-white/[0.07] bg-black/35 p-2.5 space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={grant.enabled}
                                    onChange={(e) => {
                                      const nextMap: Record<
                                        string,
                                        { enabled: boolean; capCredits: number | null }
                                      > = {};
                                      for (const sp of SHAREABLE_PLATFORM_IDS) {
                                        const cur = member.sharedGrants?.[sp.id];
                                        nextMap[sp.id] = {
                                          enabled:
                                            sp.id === plat.id
                                              ? e.target.checked
                                              : Boolean(cur?.enabled),
                                          capCredits: cur?.capCredits ?? null,
                                        };
                                      }
                                      void updateTeamMemberGrants(member.id, {
                                        grants: nextMap,
                                      });
                                    }}
                                    className="accent-[#20D5EC]"
                                  />
                                  <PlatformBrandIcon platformId={plat.id} size="xs" />
                                  <span>{plat.label}</span>
                                </label>
                                <span className="text-[10px] tabular-nums text-white/55">
                                  {grant.usedCredits || 0} cr used
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="Cap (∞)"
                                  defaultValue={grant.capCredits ?? ''}
                                  onBlur={(e) => {
                                    const nextVal =
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value);
                                    if (nextVal === grant.capCredits) return;
                                    const nextMap: Record<
                                      string,
                                      { enabled: boolean; capCredits: number | null }
                                    > = {};
                                    for (const sp of SHAREABLE_PLATFORM_IDS) {
                                      const cur = member.sharedGrants?.[sp.id];
                                      nextMap[sp.id] = {
                                        enabled: Boolean(cur?.enabled),
                                        capCredits:
                                          sp.id === plat.id
                                            ? nextVal
                                            : cur?.capCredits ?? null,
                                      };
                                    }
                                    void updateTeamMemberGrants(member.id, {
                                      grants: nextMap,
                                    });
                                  }}
                                  className="w-20 rounded bg-black/60 border border-white/[0.1] px-2 py-0.5 text-[11px] tabular-nums text-white"
                                />
                                <button
                                  type="button"
                                  title="Reset used counter"
                                  onClick={() => {
                                    const nextMap: Record<
                                      string,
                                      { enabled: boolean; capCredits: number | null }
                                    > = {};
                                    for (const sp of SHAREABLE_PLATFORM_IDS) {
                                      const cur = member.sharedGrants?.[sp.id];
                                      nextMap[sp.id] = {
                                        enabled: Boolean(cur?.enabled),
                                        capCredits: cur?.capCredits ?? null,
                                      };
                                    }
                                    void updateTeamMemberGrants(member.id, {
                                      grants: nextMap,
                                      resetUsagePlatformId: plat.id,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 rounded bg-white/[0.06] hover:bg-white/[0.12] px-1.5 py-0.5 text-[10px] text-white/75"
                                >
                                  <RotateCcw size={10} />
                                  <span>Reset</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Usage Ledger */}
              {usageLedger.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-white/50">
                    Recent Shared Credit Usage Ledger
                  </h3>
                  <div className="rounded-xl border border-white/[0.08] bg-[#151518] divide-y divide-white/[0.06] max-h-52 overflow-y-auto">
                    {usageLedger.slice(0, 25).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between px-3.5 py-2 text-[11px]"
                      >
                        <div className="flex items-center gap-2.5">
                          <PlatformBrandIcon
                            platformId={entry.platformId as PlatformId}
                            size="sm"
                          />
                          <span className="font-medium text-white">
                            {entry.userName || entry.userId}
                          </span>
                          <span className="text-white/45">{entry.modelId}</span>
                        </div>
                        <div className="flex items-center gap-3 tabular-nums">
                          <span className="text-[#20D5EC] font-medium">
                            -{entry.creditsUsed} cr
                          </span>
                          <span className="text-white/40 text-[10px]">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 3: MY ACCOUNT & SIGN OUT */}
          {teamCreditsModalTab === 'account' && (
            <div className="max-w-md space-y-5">
              <form
                onSubmit={handleProfileSave}
                className="rounded-xl border border-white/[0.08] bg-[#161619] p-5 space-y-4"
              >
                <h3 className="text-[14px] font-semibold text-white">
                  Account Profile
                </h3>

                {profileMsg && (
                  <div className="rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-2 text-[12px] text-white/90">
                    {profileMsg}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[11px] text-white/60">Display Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full rounded-lg bg-black/50 border border-white/[0.1] px-3 py-2 text-[12px] text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-white/60">Email</label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full rounded-lg bg-black/50 border border-white/[0.1] px-3 py-2 text-[12px] text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-white/60">
                    New Passcode (optional)
                  </label>
                  <input
                    type="password"
                    value={profilePasscode}
                    onChange={(e) => setProfilePasscode(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full rounded-lg bg-black/50 border border-white/[0.1] px-3 py-2 text-[12px] tabular-nums text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={profileSaving}
                  className="rounded-lg bg-[#20D5EC] hover:bg-[#3CE0F5] px-4 py-2 text-[12px] font-semibold text-[#051419]"
                >
                  {profileSaving ? 'Saving…' : 'Save Account Changes'}
                </button>
              </form>

              {authUser && (
                <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-white">
                      Sign Out of Workspace
                    </div>
                    <div className="text-[11px] text-white/50">
                      Signed in as {authUser.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void logoutStudioUser()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 px-3.5 py-2 text-[12px] font-semibold text-rose-100"
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
