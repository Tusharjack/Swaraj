/**
 * TokenPage — unified Token Wallet + Referral in one screen
 *
 * All sections are functional:
 *  1. Wallet balance card (live from Supabase)
 *  2. Refer a friend — copy code + native share + earn summary
 *  3. Apply a referral code received from someone else
 *  4. Transaction history (credits + debits)
 *
 * Unauthenticated: premium sign-in prompt.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Coins, TrendingUp, TrendingDown, RefreshCw, Copy, Share2,
  CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Star, Zap, Gift, Users, ChevronDown, ChevronUp, LogIn,
} from 'lucide-react';
import { api } from '../services/api';
import type { Profile, TokenTransaction, TokenWallet, Referral } from '../types/database';

interface TokenPageProps {
  currentUser: Profile | null;
  onOpenAuth: () => void;
}

// ─── Transaction type meta ────────────────────────────────────────────────────
const TX_META: Record<string, { label: string; creditColor: string; bg: string; icon: React.ReactNode }> = {
  earned_referral:  { label: 'Referral Reward',    creditColor: 'text-emerald-600', bg: 'bg-emerald-50',  icon: <ArrowUpRight   className="w-4 h-4 text-emerald-500" /> },
  earned_referred:  { label: 'Welcome Bonus',       creditColor: 'text-emerald-600', bg: 'bg-emerald-50',  icon: <ArrowUpRight   className="w-4 h-4 text-emerald-500" /> },
  earned_admin:     { label: 'Admin Reward',         creditColor: 'text-indigo-600',  bg: 'bg-indigo-50',   icon: <Star           className="w-4 h-4 text-indigo-500" /> },
  spent_promotion:  { label: 'Property Promotion',   creditColor: 'text-rose-600',    bg: 'bg-rose-50',     icon: <ArrowDownRight className="w-4 h-4 text-rose-500" /> },
  spent_featured:   { label: 'Featured Reel',        creditColor: 'text-rose-600',    bg: 'bg-rose-50',     icon: <ArrowDownRight className="w-4 h-4 text-rose-500" /> },
  deducted_admin:   { label: 'Admin Deduction',       creditColor: 'text-rose-600',    bg: 'bg-rose-50',     icon: <ArrowDownRight className="w-4 h-4 text-rose-500" /> },
};

// ─── Referral status badge colours ───────────────────────────────────────────
const REF_BADGE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-800',
  rewarded:  'bg-emerald-100 text-emerald-800',
  invalid:   'bg-rose-100 text-rose-800',
};

// ─── Unauthenticated prompt ───────────────────────────────────────────────────
const GuestTokens: React.FC<{ onOpenAuth: () => void }> = ({ onOpenAuth }) => (
  <div className="max-w-sm mx-auto py-16 px-6 text-center space-y-6">
    <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center mx-auto border border-amber-100">
      <Coins className="w-10 h-10 text-amber-500" />
    </div>
    <div>
      <h2 className="text-2xl font-black text-slate-900">Token Wallet</h2>
      <p className="text-slate-500 text-sm mt-2 leading-relaxed">
        Sign in to view your balance, earn tokens by referring friends, and use credits to promote your listings.
      </p>
    </div>
    <div className="grid grid-cols-2 gap-3 text-left">
      {[
        { icon: '👥', title: 'Refer Friends', desc: '+50 tokens each' },
        { icon: '🎁', title: 'Welcome Bonus', desc: '+25 on signup' },
        { icon: '🏠', title: 'Boost Listings', desc: 'Spend to promote' },
        { icon: '🏆', title: 'Admin Rewards', desc: 'Activity bonuses' },
      ].map(f => (
        <div key={f.title} className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
          <span className="text-xl">{f.icon}</span>
          <p className="text-xs font-bold text-slate-800 mt-1">{f.title}</p>
          <p className="text-[11px] text-slate-500">{f.desc}</p>
        </div>
      ))}
    </div>
    <button
      onClick={onOpenAuth}
      className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-amber-200 text-sm active:scale-95 transition"
    >
      <LogIn className="w-4 h-4" /> Sign In to View Wallet
    </button>
  </div>
);

// ─── Main authenticated view ──────────────────────────────────────────────────
export const TokenPage: React.FC<TokenPageProps> = ({ currentUser, onOpenAuth }) => {
  const [wallet,    setWallet]    = useState<TokenWallet | null>(null);
  const [txns,      setTxns]      = useState<TokenTransaction[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [refCode,   setRefCode]   = useState('');
  const [loading,   setLoading]   = useState(true);
  const [copied,    setCopied]    = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [applying,  setApplying]  = useState(false);
  const [applyMsg,  setApplyMsg]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [showTxns,  setShowTxns]  = useState(false);    // collapse history by default on mobile

  const loadAll = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [w, t, code, refs] = await Promise.all([
        api.getMyWallet(),
        api.getMyTransactions(),
        api.getMyReferralCode(),
        api.getMyReferrals(),
      ]);
      setWallet(w);
      setTxns(t);
      setRefCode(code);
      setReferrals(refs);
    } catch (e) {
      console.error('[TokenPage] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (!currentUser) return <GuestTokens onOpenAuth={onOpenAuth} />;

  const balance     = wallet?.balance      ?? 0;
  const earned      = wallet?.total_earned ?? 0;
  const spent       = wallet?.total_spent  ?? 0;
  const rewarded    = referrals.filter(r => r.status === 'rewarded').length;
  const shareLink   = `https://indoproperty.in/signup?ref=${refCode}`;
  const shareText   = `Join IndoProperty! Use my referral code ${refCode} to sign up and earn 25 free tokens. 🏠`;

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(refCode); } catch { /* ok */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Join IndoProperty', text: shareText, url: shareLink }); }
      catch { /* user cancelled */ }
    } else {
      copyCode();
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyCode.trim()) return;
    setApplying(true);
    setApplyMsg(null);
    try {
      const res = await api.applyReferralCode(applyCode.trim().toUpperCase());
      setApplyMsg({ ok: res.success, msg: res.message });
      if (res.success) {
        setApplyCode('');
        loadAll(); // refresh wallet balance and referral list
      }
    } catch (err) {
      setApplyMsg({ ok: false, msg: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-6">

      {/* ── Wallet Balance Card ── */}
      <div className="bg-gradient-to-br from-[#7138E8] via-indigo-700 to-purple-800 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200/50 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/20 rounded-xl">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-indigo-200 font-semibold uppercase tracking-wider">Token Wallet</p>
                <p className="text-[11px] text-indigo-300">IndoProperty Credits</p>
              </div>
            </div>
            <button onClick={loadAll} disabled={loading}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              <div className="h-12 w-32 bg-white/20 animate-pulse rounded-2xl" />
              <div className="h-4 w-24 bg-white/10 animate-pulse rounded-full" />
            </div>
          ) : (
            <div>
              <p className="text-6xl font-black tracking-tighter leading-none">{balance.toLocaleString()}</p>
              <p className="text-indigo-200 text-sm mt-2">Available Tokens</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
                <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-wide">Earned</span>
              </div>
              <p className="text-xl font-black">{earned.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-rose-300" />
                <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-wide">Spent</span>
              </div>
              <p className="text-xl font-black">{spent.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Refer a Friend ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Gift className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Refer a Friend</h3>
            <p className="text-[11px] text-slate-400">You earn 50 tokens · Friend earns 25 tokens</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Referral code display */}
          {loading ? (
            <div className="h-14 bg-slate-100 animate-pulse rounded-2xl" />
          ) : (
            <>
              <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl p-4 text-center">
                <p className="text-[11px] text-indigo-400 font-semibold uppercase tracking-wider mb-1">Your Referral Code</p>
                <p className="text-3xl font-black text-indigo-700 tracking-[0.25em]">{refCode}</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={copyCode}
                  className={`flex items-center justify-center gap-2 py-3 rounded-2xl border font-bold text-sm transition active:scale-95 ${
                    copied
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
                <button
                  onClick={shareNative}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#7138E8] text-white font-bold text-sm hover:bg-indigo-700 transition active:scale-95 shadow-md shadow-indigo-200"
                >
                  <Share2 className="w-4 h-4" /> Share Link
                </button>
              </div>
            </>
          )}

          {/* Referral stats */}
          {referrals.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[
                { v: referrals.length, l: 'Shared' },
                { v: referrals.filter(r => r.status !== 'pending').length, l: 'Signed Up' },
                { v: rewarded, l: 'Rewarded' },
              ].map(s => (
                <div key={s.l} className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
                  <p className="text-lg font-black text-slate-900">{s.v}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{s.l}</p>
                </div>
              ))}
            </div>
          )}

          {/* Referral list (compact) */}
          {referrals.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {referrals.map(r => (
                <div key={r.id} className="flex items-center gap-3 py-2 px-1">
                  <img
                    src={(r as any).referred?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.referred_email ?? r.id}`}
                    alt="" className="w-7 h-7 rounded-full border shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {(r as any).referred?.full_name || r.referred_email || 'Pending…'}
                    </p>
                    <p className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${REF_BADGE[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {r.status}
                  </span>
                  {r.status === 'rewarded' && (
                    <span className="text-[11px] font-black text-emerald-600 shrink-0">+{r.reward_tokens}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Apply a Code ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Have a Referral Code?</h3>
            <p className="text-[11px] text-slate-400">Enter a friend's code to earn 25 welcome tokens</p>
          </div>
        </div>

        <form onSubmit={handleApply} className="flex gap-2">
          <input
            value={applyCode}
            onChange={e => setApplyCode(e.target.value.toUpperCase())}
            placeholder="e.g.  IP-A1B2C3"
            maxLength={10}
            className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#7138E8] bg-slate-50"
          />
          <button
            type="submit"
            disabled={applying || !applyCode.trim()}
            className="px-5 py-3 bg-[#7138E8] hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl disabled:opacity-40 transition active:scale-95 shadow-md shadow-indigo-200 flex items-center gap-1.5"
          >
            {applying ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Apply'
            )}
          </button>
        </form>

        {applyMsg && (
          <div className={`mt-3 p-3.5 rounded-2xl text-sm flex items-start gap-2.5 font-medium ${
            applyMsg.ok
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-700'
          }`}>
            {applyMsg.ok
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />}
            {applyMsg.msg}
          </div>
        )}
      </div>

      {/* ── How to Earn ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#7138E8]" /> Ways to Earn Tokens
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: '👥', label: 'Refer a Friend',   detail: '+50 tokens per referral' },
            { icon: '🎁', label: 'Welcome Bonus',    detail: '+25 tokens on signup' },
            { icon: '🏆', label: 'Admin Rewards',    detail: 'Special activity bonuses' },
            { icon: '🏠', label: 'Boost Listings',   detail: 'Use tokens to promote' },
          ].map(item => (
            <div key={item.label} className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
              <span className="text-2xl block mb-1.5">{item.icon}</span>
              <p className="font-bold text-xs text-slate-800 leading-tight">{item.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Transaction History (collapsible) ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowTxns(p => !p)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">Transaction History</h3>
            <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
              {txns.length}
            </span>
          </div>
          {showTxns
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showTxns && (
          <>
            {loading ? (
              <div className="p-5 space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="animate-pulse flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                      <div className="h-2.5 bg-slate-50 rounded-full w-1/3" />
                    </div>
                    <div className="h-4 w-12 bg-slate-100 rounded-full" />
                  </div>
                ))}
              </div>
            ) : txns.length === 0 ? (
              <div className="p-10 text-center border-t border-slate-50">
                <Coins className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">No transactions yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Refer friends to earn your first tokens!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 border-t border-slate-100">
                {txns.map(tx => {
                  const meta = TX_META[tx.type] ?? {
                    label: tx.type,
                    creditColor: 'text-slate-700',
                    bg: 'bg-slate-50',
                    icon: <Coins className="w-4 h-4 text-slate-400" />,
                  };
                  const isCredit = tx.amount > 0;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{tx.description}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {meta.label} · {new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`font-black text-sm shrink-0 ${isCredit ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {isCredit ? '+' : ''}{tx.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
