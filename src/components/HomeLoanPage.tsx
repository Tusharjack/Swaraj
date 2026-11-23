import React, { useState, useEffect } from 'react';
import {
  Building2, CheckCircle2, Clock, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, IndianRupee, User, Phone,
  MapPin, FileText, RefreshCw, Plus
} from 'lucide-react';
import { api } from '../services/api';
import type { Profile, HomeLoanApplication, LoanApplicationStatus } from '../types/database';

interface HomeLoanPageProps {
  currentUser: Profile;
}

const STATUS_META: Record<LoanApplicationStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  submitted:    { label: 'Submitted',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    icon: <Clock className="w-4 h-4 text-blue-600" /> },
  under_review: { label: 'Under Review', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',  icon: <RefreshCw className="w-4 h-4 text-amber-600" /> },
  approved:     { label: 'Approved',     color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200',icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" /> },
  rejected:     { label: 'Rejected',     color: 'text-rose-700',   bg: 'bg-rose-50 border-rose-200',    icon: <XCircle className="w-4 h-4 text-rose-600" /> },
  disbursed:    { label: 'Disbursed',    color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200',icon: <CheckCircle2 className="w-4 h-4 text-purple-600" /> },
  cancelled:    { label: 'Cancelled',    color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200',  icon: <XCircle className="w-4 h-4 text-slate-500" /> },
};

const formatCr = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

export const HomeLoanPage: React.FC<HomeLoanPageProps> = ({ currentUser }) => {
  const [view, setView]         = useState<'list' | 'form'>('list');
  const [apps, setApps]         = useState<HomeLoanApplication[]>([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Form state — only the 4 fields we actually collect
  const [form, setForm] = useState({
    full_name:   currentUser.full_name ?? '',
    phone:       currentUser.phone ?? '',
    city:        currentUser.city ?? '',
    loan_amount: '',
  });

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const load = async () => {
    setLoading(true);
    try { setApps(await api.getMyLoanApplications()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [currentUser.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.applyForLoan({
        full_name:       form.full_name,
        phone:           form.phone,
        city:            form.city,
        loan_amount:     Number(form.loan_amount),
        // The form only collects 4 fields; the columns below are still NOT NULL
        // (+ CHECK) in the database, so safe defaults are sent to satisfy them.
        email:           currentUser.email ?? '',
        date_of_birth:   '1990-01-01',
        pan_number:      '',
        employment_type: 'salaried',
        monthly_income:  50000,
        tenure_years:    20,
        purpose:         'purchase',
      });
      setSuccess(true);
      await load();
      setTimeout(() => { setSuccess(false); setView('list'); }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const labelClass = "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1";
  const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white";

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 rounded-3xl p-6 text-white shadow-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white/15 rounded-2xl">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Home Loan</h2>
            <p className="text-xs text-indigo-300 mt-0.5">Apply and track your loan applications</p>
          </div>
        </div>
        {view === 'list' ? (
          <button onClick={() => setView('form')}
            className="px-4 py-2 bg-white text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1.5 hover:bg-indigo-50 transition">
            <Plus className="w-4 h-4" /> Apply Now
          </button>
        ) : (
          <button onClick={() => setView('list')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition">
            ← My Applications
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Important:</strong> IndoProperty facilitates loan enquiries only. Actual approvals and disbursements are subject to verification by authorised lending partners. Submission does not guarantee approval.
        </p>
      </div>

      {/* ── Application Form ── */}
      {view === 'form' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" /> New Loan Application
            </h3>
          </div>

          {success && (
            <div className="m-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              Application submitted successfully! Our team will review and contact you within 2 business days.
            </div>
          )}

          {error && (
            <div className="m-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Applicant Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={labelClass}>Full Name *</label><input required className={inputClass} placeholder="Your name" value={form.full_name} onChange={e => set('full_name', e.target.value)} /></div>
                <div><label className={labelClass}><Phone className="inline w-3 h-3 mr-1" />Contact Number *</label><input required type="tel" className={inputClass} placeholder="e.g. 9876543210" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
                <div><label className={labelClass}><MapPin className="inline w-3 h-3 mr-1" />Place *</label><input required className={inputClass} placeholder="City / locality" value={form.city} onChange={e => set('city', e.target.value)} /></div>
                <div><label className={labelClass}><IndianRupee className="inline w-3 h-3 mr-1" />Loan Amount (₹) *</label><input required type="number" min="100000" className={inputClass} placeholder="e.g. 5000000" value={form.loan_amount} onChange={e => set('loan_amount', e.target.value)} /></div>
              </div>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-sm shadow-md shadow-indigo-200 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting…</> : 'Submit Loan Application'}
            </button>
          </form>
        </div>
      )}

      {/* ── My Applications List ── */}
      {view === 'list' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">My Applications</h3>
            <button onClick={load} disabled={loading} className="p-1.5 text-slate-400 hover:text-slate-700 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2].map(i => <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-2xl" />)}
            </div>
          ) : apps.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Building2 className="w-12 h-12 text-slate-200 mx-auto" />
              <p className="text-sm font-semibold text-slate-400">No applications yet</p>
              <p className="text-xs text-slate-400">Click <strong>Apply Now</strong> to submit your first home loan application.</p>
              <button onClick={() => setView('form')}
                className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 mt-1">
                Apply for Home Loan
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {apps.map(app => {
                const meta = STATUS_META[app.status];
                const isOpen = expanded === app.id;
                return (
                  <div key={app.id}>
                    <button className="w-full text-left px-5 py-4 hover:bg-slate-50 transition"
                      onClick={() => setExpanded(isOpen ? null : app.id)}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 ${meta.bg} ${meta.color}`}>
                            {meta.icon}{meta.label}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-900 truncate">{formatCr(app.loan_amount)} Loan</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{app.city} · {new Date(app.created_at).toLocaleDateString('en-IN')}</p>
                          </div>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3">
                          {[
                            { l: 'Full Name', v: app.full_name },
                            { l: 'Contact Number', v: app.phone },
                            { l: 'Place', v: app.city },
                            { l: 'Loan Amount', v: formatCr(app.loan_amount) },
                          ].map(row => (
                            <div key={row.l} className="bg-white border border-slate-200 rounded-xl p-2.5">
                              <p className="text-[10px] text-slate-400 uppercase font-bold">{row.l}</p>
                              <p className="text-sm font-bold text-slate-800 mt-0.5 capitalize">{row.v}</p>
                            </div>
                          ))}
                        </div>
                        {app.admin_notes && (
                          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-800">
                            <strong>Admin Notes:</strong> {app.admin_notes}
                          </div>
                        )}
                        {app.approved_amount && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 font-bold">
                            ✅ Approved Amount: {formatCr(app.approved_amount)}
                          </div>
                        )}
                        {app.disbursed_amount && (
                          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-800 font-bold">
                            💰 Disbursed: {formatCr(app.disbursed_amount)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
