import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Flag } from 'lucide-react';
import { api } from '../services/api';
import type { Profile } from '../types/database';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile | null;
  target_type: 'property' | 'reel' | 'user' | 'comment';
  target_id: string;
  target_label?: string;
}

const REPORT_REASONS = [
  'Spam or misleading',
  'Inappropriate content',
  'Fraud or scam',
  'Copyright / IP violation',
  'Harassment or hate speech',
  'Fake listing / wrong details',
  'Duplicate listing',
  'Other (describe below)'
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  target_type,
  target_id,
  target_label
}) => {
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setDetails('');
      setSubmitted(false);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    if (!currentUser) {
      alert('Please sign in to report content.');
      return;
    }
    setLoading(true);
    try {
      const combinedReason = details.trim()
        ? `${reason} — ${details.trim()}`
        : reason;
      await api.submitReport({
        target_type,
        target_id,
        reason: combinedReason
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="p-5 bg-gradient-to-br from-rose-50 via-amber-50 to-orange-50 flex items-center justify-between border-b border-rose-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-lg">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-tight">Report Content</h3>
              {target_label && (
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  Re: {target_label}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl text-slate-500 hover:text-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {submitted ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-lg">Report Submitted</h4>
                <p className="text-xs text-slate-500 mt-1 px-4">
                  Thank you for helping keep IndoProperty safe. Our admin team has been notified and will review this report shortly.
                  <br />
                  <span className="font-semibold text-rose-600 block mt-1">
                    No content is auto-removed — we review every report before taking action.
                  </span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-100 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-rose-800 leading-relaxed">
                  <strong>Please note:</strong> Reporting sends a flag to moderators. It does <strong>not</strong> automatically delete content or accounts.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason for reporting</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {REPORT_REASONS.map(r => (
                    <label
                      key={r}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border cursor-pointer transition ${
                        reason === r
                          ? 'border-rose-400 bg-rose-50 text-rose-800 font-semibold ring-2 ring-rose-200'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        className="accent-rose-600"
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Additional details (optional)</label>
                <textarea
                  rows={3}
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Any specific details the moderator should know…"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-200 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!reason || loading}
                  className="flex-1 py-2.5 bg-gradient-to-br from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition shadow-lg shadow-rose-200"
                >
                  {loading ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
