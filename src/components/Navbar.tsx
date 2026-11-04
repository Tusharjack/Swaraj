import React, { useState, useEffect, useRef } from 'react';
import { Building2, Film, Shield, LogIn, Sparkles, MessageCircle, Coins, Gift, Landmark, ChevronDown, Heart } from 'lucide-react';
import type { Profile } from '../types/database';
import { api } from '../services/api';

export type AppTab = 'properties' | 'reels' | 'chats' | 'saved' | 'professional' | 'admin' | 'tokens' | 'homeloan' | 'referral';

interface NavbarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  currentUser: Profile | null;
  onOpenAuth: () => void;
  savedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, currentUser, onOpenAuth, savedCount }) => {
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) {
      api.getMyWallet().then(w => { if (w) setTokenBalance(w.balance); }).catch(() => {});
    } else {
      setTokenBalance(null);
    }
  }, [currentUser, currentTab]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navBtn = (tab: AppTab, label: string, icon: React.ReactNode, extra?: React.ReactNode) => (
    <button
      key={tab}
      onClick={() => onTabChange(tab)}
      className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap text-xs font-bold ${
        currentTab === tab ? 'bg-white text-indigo-600 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {icon} {label} {extra}
    </button>
  );

  // "More" dropdown items — Tokens, Home Loan, Refer, Saved
  const moreItems: { tab: AppTab; label: string; icon: React.ReactNode; desc: string }[] = [
    { tab: 'tokens',   label: 'Token Wallet', icon: <Coins className="w-4 h-4 text-amber-500" />,   desc: tokenBalance !== null ? `${tokenBalance} tokens` : 'Credits & rewards' },
    { tab: 'homeloan', label: 'Home Loan',    icon: <Landmark className="w-4 h-4 text-indigo-500" />, desc: 'Apply & track loans' },
    { tab: 'referral', label: 'Refer & Earn', icon: <Gift className="w-4 h-4 text-emerald-500" />,   desc: 'Earn 50 tokens/referral' },
    { tab: 'saved',    label: 'Saved',         icon: <Heart className="w-4 h-4 text-rose-500" />,     desc: `${savedCount} saved items` },
  ];

  const isMoreActive = ['tokens', 'homeloan', 'referral', 'saved'].includes(currentTab);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">

        {/* Logo */}
        <div onClick={() => onTabChange('properties')} className="flex items-center gap-2.5 cursor-pointer group shrink-0">
          <img src="/logo.png" alt="IndoProperty" className="h-9 sm:h-10 w-auto object-contain rounded-lg group-hover:scale-105 transition" />
          <div className="hidden sm:block">
            <span className="font-extrabold text-slate-900 tracking-tight text-lg leading-none block">IndoProperty</span>
            <p className="text-[10px] text-slate-500 font-semibold leading-tight">Real Estate for a Better Tomorrow</p>
          </div>
        </div>

        {/* Desktop Nav — only 4 primary items + More dropdown */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-2xl text-xs font-bold text-slate-700">
          {navBtn('properties', 'Properties', <Building2 className="w-4 h-4" />)}

          <button
            onClick={() => onTabChange('reels')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 relative cursor-pointer text-xs font-bold ${
              currentTab === 'reels' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Film className="w-4 h-4" /> Reels
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping absolute top-2 right-2" />
          </button>

          {navBtn('chats', 'Messages', <MessageCircle className="w-4 h-4 text-purple-500" />)}

          {currentUser && navBtn('professional', 'Dashboard', <Sparkles className="w-4 h-4 text-amber-500" />)}

          {currentUser?.role === 'admin' && navBtn('admin', 'Admin', <Shield className="w-4 h-4 text-purple-600" />)}

          {/* More dropdown */}
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen(p => !p)}
              className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
                isMoreActive ? 'bg-white text-indigo-600 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              More <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
              {isMoreActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 absolute top-2 right-2" />}
            </button>

            {moreOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {moreItems.map(item => (
                  <button
                    key={item.tab}
                    onClick={() => { onTabChange(item.tab); setMoreOpen(false); }}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition ${
                      currentTab === item.tab ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${currentTab === item.tab ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${currentTab === item.tab ? 'text-indigo-700' : 'text-slate-800'}`}>{item.label}</p>
                      <p className="text-[11px] text-slate-400">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Right — token balance chip + profile */}
        <div className="flex items-center gap-2 shrink-0">
          {currentUser && (
            <button
              onClick={() => onTabChange('tokens')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl text-xs font-black text-amber-800 transition cursor-pointer"
              title="Token Wallet"
            >
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>{tokenBalance !== null ? tokenBalance : '…'}</span>
            </button>
          )}

          {currentUser ? (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 p-1.5 pl-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-semibold text-slate-800 transition border border-slate-200 cursor-pointer"
            >
              <span className="hidden sm:inline max-w-[90px] truncate">{currentUser.full_name}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase text-white ${
                currentUser.role === 'admin' ? 'bg-purple-600' : 'bg-indigo-600'
              }`}>
                {currentUser.role === 'admin' ? 'ADMIN' : currentUser.role === 'professional' ? 'PRO' : 'ME'}
              </span>
              <img
                src={currentUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.email}`}
                alt={currentUser.full_name}
                className="w-7 h-7 rounded-full object-cover border border-white"
              />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
