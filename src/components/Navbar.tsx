import React, { useState, useEffect } from 'react';
import { Building2, Film, Heart, Shield, LogIn, Sparkles, MessageCircle, Coins, Gift, Landmark } from 'lucide-react';
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

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  onOpenAuth,
  savedCount
}) => {
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);

  useEffect(() => {
    if (currentUser) {
      api.getMyWallet().then(w => {
        if (w) setTokenBalance(w.balance);
      }).catch(() => {});
    } else {
      setTokenBalance(null);
    }
  }, [currentUser, currentTab]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo & Brand */}
        <div 
          onClick={() => onTabChange('properties')}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <img
            src="/logo.png"
            alt="IndoProperty"
            className="h-9 sm:h-10 w-auto object-contain rounded-lg group-hover:scale-105 transition"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 tracking-tight text-lg sm:text-xl leading-none font-sans">
                IndoProperty
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold leading-tight">
              Real Estate for a Better Tomorrow
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-2xl text-xs font-bold text-slate-700">
          <button
            onClick={() => onTabChange('properties')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'properties' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" /> Properties
          </button>
          <button
            onClick={() => onTabChange('reels')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 relative cursor-pointer ${
              currentTab === 'reels' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'hover:text-slate-900'
            }`}
          >
            <Film className="w-4 h-4" /> Reels
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1.5 right-1.5" />
          </button>
          <button
            onClick={() => onTabChange('chats')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 relative cursor-pointer ${
              currentTab === 'chats' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'hover:text-slate-900'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-purple-600" /> Messages
          </button>
          <button
            onClick={() => onTabChange('homeloan')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'homeloan' ? 'bg-white text-indigo-700 shadow-sm font-black' : 'hover:text-slate-900'
            }`}
          >
            <Landmark className="w-4 h-4 text-indigo-600" /> Home Loan
          </button>
          <button
            onClick={() => onTabChange('tokens')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'tokens' ? 'bg-white text-amber-700 shadow-sm font-black' : 'hover:text-slate-900'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-500" /> Tokens
            {tokenBalance !== null && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                {tokenBalance}
              </span>
            )}
          </button>
          <button
            onClick={() => onTabChange('referral')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'referral' ? 'bg-white text-emerald-700 shadow-sm font-black' : 'hover:text-slate-900'
            }`}
          >
            <Gift className="w-4 h-4 text-emerald-600" /> Refer & Earn
          </button>
          <button
            onClick={() => onTabChange('saved')}
            className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'saved' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'hover:text-slate-900'
            }`}
          >
            <Heart className="w-4 h-4" /> Saved ({savedCount})
          </button>

          {currentUser && (
            <button
              onClick={() => onTabChange('professional')}
              className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'professional' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" /> Post & Leads
            </button>
          )}

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => onTabChange('admin')}
              className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'admin' ? 'bg-white text-purple-700 shadow-sm font-black' : 'hover:text-slate-900'
              }`}
            >
              <Shield className="w-4 h-4 text-purple-600" /> Admin
            </button>
          )}
        </nav>

        {/* Right Auth / Token Balance & Profile Button */}
        <div className="flex items-center gap-2">
          {currentUser && (
            <button
              onClick={() => onTabChange('tokens')}
              title="Token Wallet"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl text-xs font-black text-amber-800 transition cursor-pointer"
            >
              <Coins className="w-4 h-4 text-amber-600" />
              <span>{tokenBalance !== null ? tokenBalance : '…'}</span>
              <span className="hidden sm:inline text-[10px] font-bold text-amber-600 uppercase">Tokens</span>
            </button>
          )}

          {currentUser ? (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 p-1.5 pl-2.5 sm:pl-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-semibold text-slate-800 transition border border-slate-200 cursor-pointer"
            >
              <span className="hidden sm:inline max-w-[100px] truncate">{currentUser.full_name}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-indigo-600 text-white">
                {currentUser.role === 'admin' ? 'ADMIN' : 'PRO'}
              </span>
              <img
                src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={currentUser.full_name}
                className="w-7 h-7 rounded-full object-cover border border-white"
              />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
