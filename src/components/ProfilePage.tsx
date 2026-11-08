/**
 * ProfilePage — full-screen profile tab
 *
 * Handles both states cleanly:
 *  - Unauthenticated: premium sign-in prompt with app feature highlights
 *  - Authenticated:   profile overview, stats, quick actions, settings
 */
import React, { useState, useEffect } from 'react';
import {
  User, LogIn, Building2, Film, MessageCircle, Heart,
  Settings, ShieldCheck, Coins, ChevronRight, LogOut,
  Star, Landmark, Users, Camera, CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import type { Profile, TokenWallet } from '../types/database';
import type { AppTab } from './Navbar';

interface ProfilePageProps {
  currentUser: Profile | null;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onTabChange: (tab: AppTab) => void;
}

// ─── Unauthenticated view ─────────────────────────────────────────────────────
const GuestProfile: React.FC<{ onOpenAuth: () => void }> = ({ onOpenAuth }) => (
  <div className="min-h-[70vh] flex flex-col">
    {/* Hero */}
    <div className="bg-gradient-to-br from-[#7138E8] via-indigo-700 to-purple-900 pt-12 pb-16 px-6 text-white text-center">
      <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border-2 border-white/30">
        <User className="w-10 h-10 text-white/80" />
      </div>
      <h2 className="text-2xl font-black tracking-tight">Welcome to IndoProperty</h2>
      <p className="text-indigo-200 text-sm mt-2 max-w-xs mx-auto">
        Sign in to access your profile, manage listings, and earn tokens
      </p>
      <div className="flex gap-3 justify-center mt-6">
        <button
          onClick={onOpenAuth}
          className="flex items-center gap-2 px-6 py-3 bg-white text-[#7138E8] font-black text-sm rounded-2xl shadow-lg hover:bg-indigo-50 transition active:scale-95"
        >
          <LogIn className="w-4 h-4" /> Sign In
        </button>
        <button
          onClick={onOpenAuth}
          className="flex items-center gap-2 px-6 py-3 bg-white/15 text-white font-bold text-sm rounded-2xl border border-white/25 hover:bg-white/25 transition active:scale-95"
        >
          Create Account
        </button>
      </div>
    </div>

    {/* Feature highlights */}
    <div className="flex-1 bg-slate-50 px-4 py-6 space-y-3">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mb-4">
        What you get with an account
      </p>
      {[
        { icon: <Building2 className="w-5 h-5 text-indigo-600" />, bg: 'bg-indigo-50', title: 'List & Manage Properties', desc: 'Post unlimited property listings with photos and video reels' },
        { icon: <Film className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50', title: 'Upload Video Reels', desc: 'Showcase properties with immersive vertical video walkthroughs' },
        { icon: <MessageCircle className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50', title: 'Direct Chat & Enquiries', desc: 'Connect directly with buyers, sellers, and brokers' },
        { icon: <Coins className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50', title: 'Earn Tokens & Rewards', desc: 'Refer friends and earn platform credits to promote listings' },
        { icon: <Landmark className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50', title: 'Apply for Home Loan', desc: 'Submit loan applications and track approval status' },
        { icon: <Heart className="w-5 h-5 text-rose-600" />, bg: 'bg-rose-50', title: 'Save & Follow', desc: 'Bookmark properties and follow creators you love' },
      ].map(f => (
        <div key={f.title} className="flex items-center gap-4 bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm">
          <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center shrink-0`}>{f.icon}</div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-slate-800">{f.title}</p>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{f.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Authenticated view ───────────────────────────────────────────────────────
const AuthedProfile: React.FC<{
  currentUser: Profile;
  wallet: TokenWallet | null;
  onOpenProfile: () => void;
  onLogout: () => void;
  onTabChange: (tab: AppTab) => void;
}> = ({ currentUser, wallet, onOpenProfile, onLogout, onTabChange }) => {
  const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    admin:        { label: 'Admin',        color: 'text-purple-700', bg: 'bg-purple-100' },
    professional: { label: 'Professional', color: 'text-indigo-700', bg: 'bg-indigo-100' },
    customer:     { label: 'Member',       color: 'text-slate-700',  bg: 'bg-slate-100' },
  };
  const badge = ROLE_BADGE[currentUser.role] ?? ROLE_BADGE.customer;

  const menuItems = [
    {
      group: 'My Activity',
      items: [
        { icon: <Building2 className="w-5 h-5 text-indigo-500" />, label: 'My Listings & Dashboard', tab: 'professional' },
        { icon: <Film className="w-5 h-5 text-purple-500" />,      label: 'Video Reels',             tab: 'reels' },
        { icon: <Heart className="w-5 h-5 text-rose-500" />,       label: 'Saved Properties & Reels', tab: 'saved' },
        { icon: <MessageCircle className="w-5 h-5 text-purple-500" />, label: 'Messages & Enquiries', tab: 'chats' },
      ],
    },
    {
      group: 'Rewards & Finance',
      items: [
        { icon: <Coins className="w-5 h-5 text-amber-500" />, label: 'Token Wallet & Referrals', tab: 'tokens', extra: wallet ? `${wallet.balance} tokens` : undefined },
        { icon: <Users className="w-5 h-5 text-emerald-500" />, label: 'Refer & Earn', tab: 'tokens' },
        { icon: <Landmark className="w-5 h-5 text-blue-500" />, label: 'Home Loan Applications', tab: 'homeloan' },
      ],
    },
    {
      group: 'Account',
      items: [
        { icon: <Settings className="w-5 h-5 text-slate-500" />, label: 'Edit Profile & Settings', action: onOpenProfile },
        ...(currentUser.role === 'admin' ? [{ icon: <ShieldCheck className="w-5 h-5 text-purple-500" />, label: 'Admin Console', tab: 'admin' }] : []),
      ],
    },
  ];

  return (
    <div className="space-y-0">
      {/* Profile header */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-5 pt-8 pb-6 text-white">
        <div className="flex items-start gap-4">
          <div className="relative">
            <img
              src={currentUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.email}`}
              alt={currentUser.full_name}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
            />
            <button
              onClick={onOpenProfile}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center border-2 border-slate-900 hover:bg-indigo-400 transition"
            >
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-xl leading-tight truncate">{currentUser.full_name}</h2>
              {currentUser.verified && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
            </div>
            <p className="text-indigo-300 text-xs mt-0.5 truncate">{currentUser.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${badge.bg} ${badge.color}`}>
                {badge.label}
              </span>
              {currentUser.badge && (
                <span className="flex items-center gap-1 text-[11px] text-amber-300 font-bold">
                  <Star className="w-3 h-3 fill-amber-300 text-amber-300" />{currentUser.badge}
                </span>
              )}
              {currentUser.city && (
                <span className="text-[11px] text-indigo-400">📍 {currentUser.city}</span>
              )}
            </div>
          </div>
          <button
            onClick={onOpenProfile}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition shrink-0"
          >
            <Settings className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Token balance pill */}
        {wallet && (
          <button
            onClick={() => onTabChange('tokens' as AppTab)}
            className="mt-4 w-full flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-2xl px-4 py-3 transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 flex items-center justify-center">
                <Coins className="w-4 h-4 text-amber-300" />
              </div>
              <div className="text-left">
                <p className="text-xs text-indigo-300 font-medium">Token Balance</p>
                <p className="font-black text-white text-lg leading-tight">{wallet.balance.toLocaleString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-indigo-300">+{wallet.total_earned} earned</p>
              <ChevronRight className="w-4 h-4 text-indigo-400 ml-auto mt-0.5" />
            </div>
          </button>
        )}
      </div>

      {/* Menu groups */}
      <div className="bg-slate-50 px-4 py-4 space-y-4">
        {menuItems.map(group => (
          <div key={group.group}>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">{group.group}</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
              {group.items.map(item => (
                <button
                  key={item.label}
                  onClick={() => {
                    if ('action' in item && item.action) item.action();
                    else if ('tab' in item && item.tab) onTabChange(item.tab as AppTab);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                    {item.icon}
                  </div>
                  <span className="flex-1 text-sm font-semibold text-slate-800">{item.label}</span>
                  {'extra' in item && item.extra && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{item.extra}</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Sign out */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm text-rose-600 hover:bg-rose-50 transition"
        >
          <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
            <LogOut className="w-5 h-5 text-rose-500" />
          </div>
          <span className="font-semibold text-sm">Sign Out</span>
        </button>

        <p className="text-center text-[11px] text-slate-300 pb-4">
          IndoProperty · Real Estate for a Better Tomorrow
        </p>
      </div>
    </div>
  );
};

// ─── Main ProfilePage ─────────────────────────────────────────────────────────
export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser,
  onOpenAuth,
  onOpenProfile,
  onLogout,
  onTabChange,
}) => {
  const [wallet, setWallet] = useState<TokenWallet | null>(null);

  useEffect(() => {
    if (currentUser) {
      api.getMyWallet().then(w => setWallet(w)).catch(() => {});
    } else {
      setWallet(null);
    }
  }, [currentUser?.id]);

  if (!currentUser) {
    return <GuestProfile onOpenAuth={onOpenAuth} />;
  }

  return (
    <AuthedProfile
      currentUser={currentUser}
      wallet={wallet}
      onOpenProfile={onOpenProfile}
      onLogout={onLogout}
      onTabChange={onTabChange}
    />
  );
};
