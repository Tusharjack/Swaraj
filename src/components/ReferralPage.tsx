import React, { useState, useEffect } from 'react';
import { Users, Copy, Share2, CheckCircle2, Gift, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import type { Profile, Referral } from '../types/database';

interface ReferralPageProps { currentUser: Profile; }

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-800',
  rewarded:  'bg-emerald-100 text-emerald-800',
  invalid:   'bg-rose-100 text-rose-800',
};

export const ReferralPage: React.FC<ReferralPageProps> = ({ currentUser }) => {
  const [code, setCode]           = useState<string>('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading]     = useState(true);
  const [copied, setCopied]       = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying]   = useState(false);
  const [applyMsg, setApplyMsg]   = useState<{ ok: boolean; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([api.getMyReferralCode(), api.getMyReferrals()]);
      setCode(c);
      setReferrals(r);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [currentUser.id]);

  const shareLink = `https://indoproperty.in/signup?ref=${code}`;

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); }
    catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Join IndoProperty', text: `Use my referral code ${code} to sign up on IndoProperty and earn tokens!`, url: shareLink });
    } else { copyCode(); }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyCode.trim()) return;
    setApplying(true);
    setApplyMsg(null);
    const res = await api.applyReferralCode(applyCode.trim());
    setApplyMsg({ ok: res.success, msg: res.message });
    setApplying(false);
    if (res.success) { setApplyCode(''); load(); }
  };

  const rewarded = referrals.filter(r => r.status === 'rewarded').length;
  const completed = referrals.filter(r => r.status === 'completed' || r.status === 'rewarded').length;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-indigo-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-36 h-36 bg-white/10 rounded-full" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/20 rounded-2xl"><Users className="w-6 h-6" /></div>
            <div>
              <h2 className="text-xl font-bold">Refer & Earn</h2>
              <p className="text-xs text-emerald-200 mt-0.5">Earn tokens for every friend you invite</p>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-3 mt-5">
          {[
            { l: 'Total Referrals', v: referrals.length },
            { l: 'Successful',      v: completed },
            { l: 'Tokens Earned',   v: referrals.filter(r=>r.status==='rewarded').reduce((s,r)=>s+(r.reward_tokens||0),0) },
          ].map(s => (
            <div key={s.l} className="bg-white/15 backdrop-blur rounded-2xl p-3 text-center">
              <p className="text-2xl font-black">{s.v}</p>
              <p className="text-[11px] text-emerald-200 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral Code Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
          <Gift className="w-4 h-4 text-emerald-600" /> Your Referral Code
        </h3>
        {loading ? (
          <div className="h-14 bg-slate-100 animate-pulse rounded-2xl" />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-2xl px-5 py-3 text-center">
                <span className="font-black text-2xl text-indigo-700 tracking-widest">{code}</span>
              </div>
              <button onClick={copyCode}
                className={`p-3 rounded-2xl border transition font-bold text-xs flex flex-col items-center gap-1 ${copied ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={shareNative}
                className="p-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 transition flex flex-col items-center gap-1 text-xs font-bold">
                <Share2 className="w-5 h-5" />Share
              </button>
            </div>
            <p className="text-xs text-slate-500 text-center">
              Share this code — you earn <strong className="text-emerald-600">50 tokens</strong> per successful referral. New users earn <strong className="text-indigo-600">25 tokens</strong> on signup.
            </p>
          </>
        )}
      </div>

      {/* Apply a code */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 mb-3 text-sm">Have a Referral Code?</h3>
        <form onSubmit={handleApply} className="flex gap-2">
          <input
            value={applyCode}
            onChange={e => setApplyCode(e.target.value.toUpperCase())}
            placeholder="Enter code e.g. IP-AB12CD"
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" disabled={applying || !applyCode.trim()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition">
            {applying ? '…' : 'Apply'}
          </button>
        </form>
        {applyMsg && (
          <div className={`mt-3 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${applyMsg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
            {applyMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {applyMsg.msg}
          </div>
        )}
      </div>

      {/* Referrals list */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">My Referrals</h3>
          <span className="text-xs text-slate-400">{referrals.length} total · {rewarded} rewarded</span>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">{[1,2].map(i=><div key={i} className="h-12 bg-slate-50 animate-pulse rounded-xl"/>)}</div>
        ) : referrals.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-400">No referrals yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Share your code and start earning!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {referrals.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                <img src={r.referred?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.referred_email}`}
                  alt="" className="w-8 h-8 rounded-full object-cover border shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {r.referred?.full_name || r.referred_email || 'Pending signup'}
                  </p>
                  <p className="text-[11px] text-slate-400">{new Date(r.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.reward_tokens > 0 && r.status === 'rewarded' && (
                    <span className="text-xs font-bold text-emerald-600">+{r.reward_tokens} tokens</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_BADGE[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
