import React, { useState } from 'react';
import {
  Building2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Mail,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Clock,
  FileText,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// IndoProperty — Public Account Deletion Page
//
// Route: /delete-account
// Purpose: Satisfies Google Play Store's account-deletion policy requirement.
//          Users can request account deletion by submitting their email.
//          The actual deletion happens inside the app (Profile → Delete Account)
//          or via this page's instructions.
// ─────────────────────────────────────────────────────────────────────────────

const DATA_DELETED = [
  { icon: '👤', label: 'Profile', detail: 'Name, email, phone, city, bio, profile photo' },
  { icon: '🏠', label: 'Properties & Listings', detail: 'All property posts and media you uploaded' },
  { icon: '🎬', label: 'Video Reels', detail: 'All video reels and thumbnail images' },
  { icon: '💬', label: 'Enquiries & Chats', detail: 'All enquiries sent/received and chat messages' },
  { icon: '❤️', label: 'Likes, Saves & Follows', detail: 'Liked reels, saved properties, followed creators' },
  { icon: '🔔', label: 'Notifications', detail: 'All notification history' },
  { icon: '📁', label: 'Uploaded Files', detail: 'Photos and videos stored on our servers' },
];

const FAQ = [
  {
    q: 'How long does account deletion take?',
    a: 'Deletion is immediate when done inside the app. For email requests, we process them within 7 business days and send a confirmation email.',
  },
  {
    q: 'Can I recover my account after deletion?',
    a: 'No. Account deletion is permanent and irreversible. All your data is removed from our servers and cannot be restored.',
  },
  {
    q: 'What happens to enquiries I sent to other users?',
    a: 'Your sent enquiries are deleted. Enquiries addressed to you (where you were the recipient) are also removed along with the associated chat history.',
  },
  {
    q: 'Will my listings still appear after deletion?',
    a: 'No. All properties and reels you posted are immediately removed when your account is deleted.',
  },
  {
    q: 'I cannot log in — how do I still delete my account?',
    a: 'Send an email to support@indoproperty.in with the subject "Account Deletion Request" and the email address registered with your account. We will delete it within 7 business days.',
  },
];

export const DeleteAccountPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Send a mailto: link as a fallback — no backend endpoint needed for the
      // public page. The real deletion happens server-side via the app or email.
      const subject = encodeURIComponent('Account Deletion Request — IndoProperty');
      const body = encodeURIComponent(
        `I would like to permanently delete my IndoProperty account.\n\nRegistered email: ${email.trim()}\n\nReason: ${reason.trim() || 'Not specified'}\n\nI understand this action is permanent and cannot be undone.`
      );
      window.location.href = `mailto:support@indoproperty.in?subject=${subject}&body=${body}`;
      // Show success state after a short delay (gives mailto time to open)
      setTimeout(() => setSubmitted(true), 800);
    } catch {
      setSubmitError('Could not open your email client. Please email us directly at support@indoproperty.in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg text-slate-900 leading-none">IndoProperty</span>
            <p className="text-[11px] text-slate-500 leading-none mt-0.5">Real Estate for a Better Tomorrow</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* ── Hero ── */}
        <section className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-3xl mx-auto">
            <Trash2 className="w-8 h-8 text-rose-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Account Deletion
          </h1>
          <p className="text-slate-500 text-base max-w-xl mx-auto">
            You can permanently delete your IndoProperty account and all associated data
            at any time. This page explains what is deleted and how to proceed.
          </p>
        </section>

        {/* ── Preferred method — in-app ── */}
        <section className="bg-indigo-50 border border-indigo-200 rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-indigo-700" />
            </div>
            <h2 className="font-bold text-lg text-indigo-900">Preferred: Delete Inside the App</h2>
          </div>
          <p className="text-sm text-indigo-800">
            The fastest and most secure way to delete your account is directly within the
            IndoProperty app — no waiting, instant confirmation.
          </p>
          <ol className="space-y-2 text-sm text-indigo-800">
            {[
              'Open the IndoProperty app and sign in.',
              'Tap your profile avatar (top-right) to open Profile Settings.',
              'Scroll to the bottom — find the "Danger Zone" section.',
              'Tap "Delete Account" and type DELETE to confirm.',
              'Your account and all data are deleted immediately.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        {/* ── What gets deleted ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            What Data Is Deleted
          </h2>
          <p className="text-sm text-slate-500">
            When your account is deleted, the following data is <strong>permanently and irreversibly removed</strong> from our servers:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {DATA_DELETED.map(({ icon, label, detail }) => (
              <div
                key={label}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm"
              >
                <span className="text-2xl leading-none mt-0.5">{icon}</span>
                <div>
                  <p className="font-bold text-sm text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Aggregated or anonymised data (e.g. aggregate market
              statistics) that contains no personal information may be retained as required
              for business analytics. No personally identifiable information is kept.
            </p>
          </div>
        </section>

        {/* ── Email request form ── */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-xl">
              <Mail className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900">Request Deletion by Email</h2>
              <p className="text-xs text-slate-500">
                Can't access the app? Submit a deletion request here.
              </p>
            </div>
          </div>

          {submitted ? (
            <div className="py-6 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 rounded-3xl">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900">Request Submitted</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Your email client should have opened with a pre-filled deletion request.
                We'll process it within 7 business days and send a confirmation to{' '}
                <strong>{email}</strong>.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                Processing time: up to 7 business days
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="del-email"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Registered Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  id="del-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm
                             focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition"
                />
              </div>

              <div>
                <label
                  htmlFor="del-reason"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Reason for Deletion{' '}
                  <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  id="del-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Help us improve by sharing why you're leaving..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm
                             focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition resize-none"
                />
              </div>

              {/* Warning */}
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700">
                  Account deletion is <strong>permanent and irreversible</strong>. All your
                  data — properties, reels, chats, and uploaded files — will be permanently
                  removed and cannot be recovered.
                </p>
              </div>

              {submitError && (
                <p className="text-xs text-red-600 font-medium">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm
                           rounded-xl shadow-md shadow-rose-200 transition
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Opening Email…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Request Account Deletion
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-400">
                Or email us directly at{' '}
                <a
                  href="mailto:support@indoproperty.in?subject=Account%20Deletion%20Request"
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  support@indoproperty.in
                </a>
              </p>
            </form>
          )}
        </section>

        {/* ── FAQ ── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-3
                             font-semibold text-sm text-slate-800 hover:bg-slate-50 transition"
                  aria-expanded={openFaq === i}
                >
                  <span>{item.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-slate-600 border-t border-slate-100 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Privacy policy link ── */}
        <section className="text-center text-xs text-slate-400 space-y-1 pb-6">
          <p>
            For more information, see our{' '}
            <a href="/privacy-policy" className="text-indigo-600 hover:underline font-medium">
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="/terms" className="text-indigo-600 hover:underline font-medium">
              Terms of Service
            </a>
            .
          </p>
          <p>© {new Date().getFullYear()} IndoProperty. All rights reserved.</p>
        </section>
      </main>
    </div>
  );
};
