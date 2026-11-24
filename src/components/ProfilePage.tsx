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
  Trash2, AlertTriangle, X, Lock, ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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

// ─── Sign Out confirmation dialog ────────────────────────────────────────────
const SignOutConfirmDialog: React.FC<{
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
      <div className="p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto border border-amber-100">
          <LogOut className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-900">Sign Out?</h3>
          <p className="text-sm text-slate-500 mt-1.5">Are you sure you want to sign out? You'll need to sign in again to access your account.</p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md shadow-rose-200 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Delete Account dialog with secure auth verification ─────────────────────
const DeleteAccountDialog: React.FC<{
  userEmail: string;
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
  deleting: boolean;
  deleteError: string | null;
}> = ({ userEmail, onConfirm, onCancel, deleting, deleteError }) => {
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const canDelete = password.length >= 6 && typed.trim().toUpperCase() === 'DELETE';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-rose-100 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-rose-600 to-red-600 text-white flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Delete Account Permanently</h3>
              <p className="text-xs text-rose-100 mt-0.5">Secure verification required — this cannot be undone</p>
            </div>
          </div>
          <button onClick={onCancel} disabled={deleting} className="text-white/70 hover:text-white transition mt-0.5 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Warning list */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">The following will be permanently deleted:</p>
            <ul className="text-xs text-rose-700 space-y-1.5">
              {[
                'Your profile and account credentials',
                'All properties and listings you created',
                'All video reels you uploaded',
                'Your enquiries and chat history',
                'Saved properties and liked reels',
                'All uploaded photos and videos',
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <span className="text-rose-400 mt-0.5 shrink-0">✕</span>{item}
                </li>
              ))}
            </ul>
          </div>

          {/* Step 1: Password verification */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500" /> Re-enter your password to verify identity
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={deleting}
              placeholder={`Password for ${userEmail}`}
              autoComplete="current-password"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 disabled:opacity-50"
            />
            <p className="text-[11px] text-slate-400 mt-1">We verify your password to prevent unauthorized deletion.</p>
          </div>

          {/* Step 2: Type DELETE */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Type <span className="font-extrabold text-rose-600 tracking-widest">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={deleting}
              placeholder="Type DELETE here"
              autoComplete="off"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-rose-500 focus:border-rose-500 disabled:opacity-50 disabled:bg-slate-50"
            />
          </div>

          {deleteError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />{deleteError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition disabled:opacity-50"
            >
              Cancel — Keep Account
            </button>
            <button
              type="button"
              onClick={() => onConfirm(password)}
              disabled={!canDelete || deleting}
              className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-200 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {deleting ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Deleting…</>
              ) : (
                <><Trash2 className="w-3.5 h-3.5" />Delete My Account</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  // ── Sign Out confirmation state ─────────────────────────────────────────
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // ── Delete Account state (with secure auth verification) ─────────────────
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Set / Change Password (for OTP-only users) ───────────────────────────
  const [showSetPwd, setShowSetPwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdErr('');
    if (newPwd.length < 6) { setPwdErr('Password must be at least 6 characters.'); return; }
    if (newPwd !== confirmPwd) { setPwdErr('Passwords do not match.'); return; }
    setPwdLoading(true);
    try {
      const { success, error } = await api.updatePassword(newPwd);
      if (success) {
        setPwdMsg('Password set successfully! You can now sign in with email + password.');
        setNewPwd(''); setConfirmPwd('');
        setTimeout(() => { setShowSetPwd(false); setPwdMsg(''); }, 2500);
      } else {
        setPwdErr(error || 'Could not set password. Please try again.');
      }
    } catch (err: any) {
      setPwdErr(err.message || 'Could not set password.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSignOut = () => {
    setShowSignOutConfirm(false);
    onLogout();
  };

  const handleDeleteAccount = async (password: string) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      // Step 1: Secure auth verification — re-enter password to confirm identity
      if (isSupabaseConfigured) {
        const { error: pwError } = await supabase.auth.signInWithPassword({
          email: currentUser.email,
          password,
        });
        if (pwError) {
          setDeleteError('Password verification failed. Please check your password and try again.');
          return;
        }
      }
      // Step 2: Delete the account via the secure edge function
      await api.deleteAccount();
      setShowDeleteAccount(false);
      onLogout();
      setTimeout(() => {
        window.alert('Your account has been permanently deleted. We\u2019re sorry to see you go.');
      }, 200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Account deletion failed. Please try again.';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

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
        { icon: <Lock className="w-5 h-5 text-indigo-500" />,    label: 'Set / Change Password',   action: () => { setPwdErr(''); setPwdMsg(''); setNewPwd(''); setConfirmPwd(''); setShowSetPwd(true); } },
        ...(currentUser.role === 'admin' ? [{ icon: <ShieldCheck className="w-5 h-5 text-purple-500" />, label: 'Admin Console', tab: 'admin' }] : []),
        { icon: <LogOut className="w-5 h-5 text-amber-500" />, label: 'Sign Out', action: () => setShowSignOutConfirm(true) },
        { icon: <Trash2 className="w-5 h-5 text-rose-500" />, label: 'Delete Account', action: () => { setDeleteError(null); setShowDeleteAccount(true); } },
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

        {/* ── Manage Account (Delete Account lives here) ── */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Manage Account</p>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button
              onClick={() => { setDeleteError(null); setShowDeleteAccount(true); }}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-rose-50 transition text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 className="w-5 h-5 text-rose-500" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-rose-600">Delete Account</span>
                <p className="text-[11px] text-slate-400">Permanently remove your account & all data</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          </div>
        </div>

        {/* ── Sign Out (bottom of Account, with confirmation) ── */}
        <button
          onClick={() => setShowSignOutConfirm(true)}
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

      {/* ── Sign Out confirmation dialog ── */}
      {showSignOutConfirm && (
        <SignOutConfirmDialog
          onConfirm={handleSignOut}
          onCancel={() => setShowSignOutConfirm(false)}
        />
      )}

      {/* ── Delete Account dialog (with secure auth verification) ── */}
      {showDeleteAccount && (
        <DeleteAccountDialog
          userEmail={currentUser.email}
          onConfirm={handleDeleteAccount}
          onCancel={() => { setShowDeleteAccount(false); setDeleteError(null); }}
          deleting={deleting}
          deleteError={deleteError}
        />
      )}

      {/* ── Set / Change Password modal ── */}
      {showSetPwd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Set / Change Password</h3>
                <p className="text-xs text-indigo-100 mt-0.5">You can sign in with email + password after this</p>
              </div>
              <button onClick={() => setShowSetPwd(false)} className="text-white/70 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSetPassword} className="p-5 space-y-4">
              {pwdMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> {pwdMsg}
                </div>
              )}
              {pwdErr && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" /> {pwdErr}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">New Password</label>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                  placeholder="At least 6 characters" minLength={6} required autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Confirm Password</label>
                <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Repeat password" minLength={6} required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowSetPwd(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition">
                  Cancel
                </button>
                <button type="submit" disabled={pwdLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-200 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {pwdLoading ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><Lock className="w-3.5 h-3.5" /> Save Password</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
