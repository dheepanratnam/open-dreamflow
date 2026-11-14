import React, { useState } from 'react';
import { ArrowRight, KeyRound, Lock, Mail, Sparkles, ShieldCheck } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { PlatformBrandIcon } from './PlatformBrandIcon';
import type { PlatformId } from '../types/studio';

const SHOWCASE_PLATFORMS: PlatformId[] = [
  'higgsfield',
  'dreamina',
  'kling',
  'sume',
  'elevenlabs',
  'openai',
  'fal',
  'google-flow',
];

export const AuthGateModal: React.FC = () => {
  const { authBootstrapInfo, loginStudioUser } = useStudioStore();
  const [email, setEmail] = useState(authBootstrapInfo?.ownerDefaultEmail || '');
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !passcode) {
      setError('Enter both your workspace email and passcode.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await loginStudioUser(cleanEmail, passcode);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Invalid email or passcode');
    }
  };

  const handleQuickOwnerSignIn = async () => {
    const ownerEmail = authBootstrapInfo?.ownerDefaultEmail || 'owner@dreamflow.studio';
    setEmail(ownerEmail);
    setPasscode('dreamflow2026');
    setSubmitting(true);
    setError(null);
    const res = await loginStudioUser(ownerEmail, 'dreamflow2026');
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Owner quick sign-in failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#060607]/95 backdrop-blur-2xl p-4 font-sans text-white">
      <div className="w-full max-w-[440px] rounded-2xl border border-white/[0.09] bg-[#101012] shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-white/[0.07]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#041b24] border border-[#20D5EC]/35 flex items-center justify-center text-[#20D5EC]">
                <Sparkles size={16} />
              </div>
              <div>
                <h1 className="text-[15px] font-semibold tracking-tight text-white">
                  Open-DreamFlow Studio
                </h1>
                <p className="text-[11px] text-white/50">
                  Private Creative Workspace &amp; Shared Credit Hub
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-400/25 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
              <ShieldCheck size={11} />
              Invite Only
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {SHOWCASE_PLATFORMS.map((pid) => (
              <div
                key={pid}
                className="opacity-85 hover:opacity-100 transition-opacity"
                title={pid}
              >
                <PlatformBrandIcon platformId={pid} size="md" />
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-[12px] text-rose-200">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-white/65">
              Workspace Email
            </label>
            <div className="relative">
              <Mail
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
              />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@dreamflow.studio"
                className="w-full rounded-xl bg-black/50 border border-white/[0.1] pl-9 pr-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:border-[#20D5EC]/60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-white/65">
              Access Passcode
            </label>
            <div className="relative">
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
              />
              <input
                type="password"
                autoComplete="current-password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter invite passcode"
                className="w-full rounded-xl bg-black/50 border border-white/[0.1] pl-9 pr-3 py-2.5 text-[13px] tabular-nums text-white placeholder:text-white/25 focus:outline-none focus:border-[#20D5EC]/60"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#20D5EC] hover:bg-[#3CE0F5] disabled:opacity-60 text-[#051419] font-semibold text-[13px] py-2.5 transition-colors"
          >
            <span>{submitting ? 'Signing in…' : 'Sign In to Workspace'}</span>
            <ArrowRight size={15} />
          </button>

          {isLocalhost && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleQuickOwnerSignIn()}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-white/90 font-medium text-[12px] py-2.5 transition-colors"
            >
              <KeyRound size={14} className="text-[#20D5EC]" />
              <span>Quick Sign In as Workspace Owner (Localhost)</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
