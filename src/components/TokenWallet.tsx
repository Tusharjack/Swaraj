import React, { useState, useEffect } from 'react';
import { Coins, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw, Zap, Star } from 'lucide-react';
import { api } from '../services/api';
import type { Profile, TokenTransaction, TokenWallet as TWallet } from '../types/database';

interface TokenWalletProps {
  currentUser: Profile;
  onOpenAuth: () => void;
}

const TX_LABELS: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  earned_referral:  { label: 'Referral Reward',   color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <ArrowUpRight className="w-4 h-4 text-emerald-600" /> },
  earned_referred:  { label: 'Welcome Bonus',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <ArrowUpRight className="w-4 h-4 text-emerald-600" /> },
  earned_admin:     { label: 'Admin Reward',        color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200',  icon: <Star className="w-4 h-4 text-indigo-600" /> },
  spent_promotion:  { label: 'Property Promotion',  color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200',      icon: <ArrowDownRight className="w-4 h-4 text-rose-600" /> },
  spent_featured:   { label: 'Featured Reel',       color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200',      icon: <ArrowDownRight className="w-4 h-4 text-rose-600" /> },
  deducted_admin:   { label: 'Admin Deduction',      color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200',      icon: <ArrowDownRight className="w-4 h-4 text-rose-600" /> },
};

export const TokenWallet: React.FC<TokenWalletProps> = ({ currentUser }) => {
  const [wallet, setWallet]   = useState<TWallet | null>(null);
  const [txns, setTxns]       = useState<TokenTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [w, t] = await Promise.all([api.getMyWallet(), api.getMyTransactions()]);
      setWallet(w);
      setTxns(t);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentUser.id]);

  const balance      = wallet?.balance      ?? 0;
  const totalEarned  = wallet?.total_earned ?? 0;
  const totalSpent   = wallet?.total_spent  ?? 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* Wallet Card */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-white/5 rounded-full" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/20 rounded-xl">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-indigo-200 font-semibold uppercase tracking-wider">IndoProperty Tokens</p>
                <p className="text-[11px] text-indigo-300">Platform Credits</p>
              </div>
            </div>
            <button onClick={load} disabled={loading}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="h-12 w-40 bg-white/20 animate-pulse rounded-2xl" />
          ) : (
            <div>
              <p className="text-5xl font-black tracking-tight">{balance.toLocaleString()}</p>
              <p className="text-indigo-200 text-sm mt-1">Available Tokens</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
                <span className="text-[11px] text-indigo-200 uppercase font-bold">Total Earned</span>
              </div>
              <p className="text-xl font-black">{totalEarned.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-rose-300" />
                <span className="text-[11px] text-indigo-200 uppercase font-bold">Total Spent</span>
              </div>
              <p className="text-xl font-black">{totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* How to earn */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" /> How to Earn Tokens
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: '👥', label: 'Refer a Friend',      detail: '+50 tokens per referral' },
            { icon: '🎁', label: 'Welcome Bonus',       detail: '+25 tokens on signup' },
            { icon: '🏆', label: 'Admin Rewards',       detail: 'Special activity bonuses' },
            { icon: '🏠', label: 'Promote Property',    detail: 'Use tokens to boost listings' },
          ].map(item => (
            <div key={item.label} className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
              <span className="text-2xl block mb-1">{item.icon}</span>
              <p className="font-bold text-xs text-slate-800">{item.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Transaction History</h3>
          <span className="text-xs text-slate-400 font-medium">{txns.length} transactions</span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                  <div className="h-2.5 bg-slate-50 rounded-full w-1/3" />
                </div>
                <div className="h-4 w-12 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : txns.length === 0 ? (
          <div className="p-10 text-center">
            <Coins className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-400">No transactions yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Refer friends to earn your first tokens!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {txns.map(tx => {
              const meta = TX_LABELS[tx.type] ?? {
                label: tx.type, color: 'text-slate-700',
                bg: 'bg-slate-50 border-slate-200',
                icon: <Coins className="w-4 h-4 text-slate-500" />
              };
              const isCredit = tx.amount > 0;
              return (
                <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.bg}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{tx.description}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {meta.label} · {new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`font-black text-sm shrink-0 ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isCredit ? '+' : ''}{tx.amount.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
