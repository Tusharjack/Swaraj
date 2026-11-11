import React, { useState, useEffect } from 'react';
import { ShieldCheck, Shield, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import type { Profile } from '../types/database';

// ─────────────────────────────────────────────────────────────────────────────
// Two-Factor Authentication (TOTP via Supabase Auth MFA)
// ─────────────────────────────────────────────────────────────────────────────

/** Enrol / manage 2FA — embedded in the Profile Settings modal. */
export const TwoFactorSection: React.FC<{ currentUser: Profile | null }> = ({ currentUser }) => {
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setFactors((await api.listMfaFactors()).filter(f => f.status === 'verified')); }
    catch { setFactors([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (currentUser) refresh(); }, [currentUser?.id]);

  const startEnroll = async () => {
    setError(''); setBusy(true);
    try { setEnrollData(await api.enrollTotp()); setEnrolling(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not start 2FA setup.'); }
    finally { setBusy(false); }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData) return;
    setError(''); setBusy(true);
    try {
      await api.verifyTotp(enrollData.factorId, code.trim());
      setDone(true); setEnrolling(false); setEnrollData(null); setCode('');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Invalid code.'); }
    finally { setBusy(false); }
  };

  const disable = async (factorId: string) => {
    setError(''); setBusy(true);
    try { await api.unenrollTotp(factorId); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not disable 2FA.'); }
    finally { setBusy(false); }
  };

  const enabled = factors.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <Shield className="w-4 h-4 text-slate-400" />}
          <div>
            <p className="text-xs font-bold text-slate-800">Two-Factor Authentication</p>
            <p className="text-[11px] text-slate-500">
              {loading ? 'Checking…' : enabled ? 'Enabled via authenticator app' : 'Add an extra layer of security'}
            </p>
          </div>
        </div>
        {!loading && !enabled && !enrolling && (
          <button onClick={startEnroll} disabled={busy}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold disabled:opacity-50 cursor-pointer">
            Enable 2FA
          </button>
        )}
        {!loading && enabled && (
          <button onClick={() => disable(factors[0].id)} disabled={busy}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold disabled:opacity-50 cursor-pointer">
            Disable
          </button>
        )}
      </div>

      {done && (
        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> 2FA enabled successfully.
        </div>
      )}

      {enrolling && enrollData && (
        <div className="space-y-3 pt-1">
          <p className="text-[11px] text-slate-600">
            Scan this QR code with Google Authenticator / Authy, then enter the 6-digit code.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <img src={enrollData.qrCode} alt="2FA QR code" className="w-36 h-36 rounded-xl border border-slate-200 bg-white p-1" />
            <div className="text-center sm:text-left">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Manual key</p>
              <button
                onClick={() => navigator.clipboard?.writeText(enrollData.secret)}
                className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer"
              >
                {enrollData.secret} <Copy className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </div>
          <form onSubmit={confirm} className="flex items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="123456"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm tracking-[0.3em] text-center focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" disabled={busy || code.length !== 6}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
            </button>
            <button type="button" onClick={() => { setEnrolling(false); setEnrollData(null); }}
              className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer">
              Cancel
            </button>
          </form>
        </div>
      )}

      {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
    </div>
  );
};


/** Blocking modal shown right after login when a 2FA challenge is required. */
export const MfaChallengeModal: React.FC<{
  isOpen: boolean;
  onVerified: () => void;
  onCancel: () => void;
}> = ({ isOpen, onVerified, onCancel }) => {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCode(''); setError('');
    api.listMfaFactors()
      .then(fs => setFactorId(fs.find(f => f.status === 'verified')?.id ?? null))
      .catch(() => setFactorId(null));
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true); setError('');
    try { await api.verifyTotp(factorId, code.trim()); onVerified(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Invalid code.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg text-slate-900">Two-Factor Verification</h3>
          <p className="text-xs text-slate-500">Enter the 6-digit code from your authenticator app.</p>
        </div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoFocus
          placeholder="123456"
          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-lg tracking-[0.4em] text-center focus:ring-2 focus:ring-indigo-500"
        />
        {error && <p className="text-xs text-rose-600 font-medium text-center">{error}</p>}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={busy || code.length !== 6}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Verify'}
          </button>
        </div>
      </form>
    </div>
  );
};
