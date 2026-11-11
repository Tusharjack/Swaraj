import React, { useState } from 'react';
import { Lock, Eye, EyeOff, KeyRound, Mail, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Shared hook: change-password form state & submit logic
// ─────────────────────────────────────────────────────────────────────────────
const useChangePassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async (): Promise<boolean> => {
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return false;
    }
    setLoading(true);
    try {
      const { success: ok, error: err } = await api.updatePassword(newPassword);
      if (ok) {
        setNewPassword('');
        setConfirm('');
        setSuccess(true);
        return true;
      }
      setError(err || 'Could not change your password. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    newPassword, setNewPassword,
    confirm, setConfirm,
    show, setShow,
    loading, error, success, setSuccess,
    submit,
  };
};

const PasswordFields: React.FC<{ form: ReturnType<typeof useChangePassword> }> = ({ form }) => (
  <>
    <div>
      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
        New Password
      </label>
      <div className="relative">
        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type={form.show ? 'text' : 'password'}
          value={form.newPassword}
          onChange={(e) => form.setNewPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => form.setShow(!form.show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {form.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
    <div>
      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
        Confirm New Password
      </label>
      <div className="relative">
        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type={form.show ? 'text' : 'password'}
          value={form.confirm}
          onChange={(e) => form.setConfirm(e.target.value)}
          placeholder="••••••••"
          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// Settings section — Change Password + email reset link (signed-in users)
// ─────────────────────────────────────────────────────────────────────────────
export const PasswordSettingsSection: React.FC<{ email?: string | null }> = ({ email }) => {
  const form = useChangePassword();
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleEmailReset = async () => {
    if (!email) return;
    setResetLoading(true);
    setResetError('');
    try {
      const { success, error } = await api.sendPasswordReset(email);
      if (success) setResetSent(true);
      else setResetError(error || 'Could not send the reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-indigo-600" />
        <h4 className="text-sm font-bold text-slate-800">Security & Password</h4>
      </div>

      {form.success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Password changed successfully.
        </div>
      )}
      {resetSent && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2">
          <Mail className="w-4 h-4 text-emerald-600 shrink-0" /> Reset link sent to {email}. Check your inbox.
        </div>
      )}
      {form.error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" /> {form.error}
        </div>
      )}
      {resetError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" /> {resetError}
        </div>
      )}

      <PasswordFields form={form} />

      <button
        type="button"
        onClick={form.submit}
        disabled={form.loading}
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition disabled:opacity-50 cursor-pointer"
      >
        {form.loading ? 'Updating…' : 'Change Password'}
      </button>

      <button
        type="button"
        onClick={handleEmailReset}
        disabled={resetLoading || !email}
        className="w-full text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition disabled:opacity-50 cursor-pointer"
      >
        {resetLoading ? 'Sending…' : 'Forgot current password? Email me a reset link'}
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Recovery modal — shown after the user clicks the reset link in their email
// ─────────────────────────────────────────────────────────────────────────────
export const SetNewPasswordModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onDone?: () => void;
}> = ({ isOpen, onClose, onDone }) => {
  const form = useChangePassword();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await form.submit();
    if (ok) {
      onDone?.();
      setTimeout(onClose, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-indigo-400" />
          <div>
            <h3 className="font-bold text-lg">Set a New Password</h3>
            <p className="text-xs text-slate-300">Choose a strong password for your IndoProperty account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {form.success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Password updated! Signing you in…
            </div>
          )}
          {form.error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" /> {form.error}
            </div>
          )}

          <PasswordFields form={form} />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.loading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition disabled:opacity-50"
            >
              {form.loading ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
