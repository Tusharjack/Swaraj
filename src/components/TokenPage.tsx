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
  Send, Rocket, X, Building2, Film, Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import type { Profile, TokenTransaction, TokenWallet, Referral, Property, Reel, PlatformSettings } from '../types/database';

interface TokenPageProps {
  currentUser: Profile | null;
  onOpenAuth: () => void;
}

// ─── Transaction type meta ────────────────────────────────────────────────────
const TX_META: Record<string, { label: string; creditColor: string; bg: string; icon: React.ReactNode }> = {
  earned_referral:   { label: 'Referral Reward',    creditColor: 'text-emerald-600', bg: 'bg-emerald-50',  icon: <ArrowUpRight   className="w-4 h-4 text-emerald-500" /> },
  earned_referred:   { label: 'Welcome Bonus',       creditColor: 'text-emerald-600', bg: 'bg-emerald-50',  icon: <ArrowUpRight   className="w-4 h-4 text-emerald-500" /> },
  earned_admin:      { label: 'Admin Reward',         creditColor: 'text-indigo-600',  bg: 'bg-indigo-50',   icon: <Star           className="w-4 h-4 text-indigo-500" /> },
  gifted_received:   { label: 'Gift Received',       creditColor: 'text-emerald-600', bg: 'bg-emerald-50',  icon: <Gift           className="w-4 h-4 text-emerald-500" /> },
  gifted_sent:       { label: 'Gift Sent',             creditColor: 'text-rose-600',    bg: 'bg-rose-50',     icon: <Gift           className="w-4 h-4 text-rose-500" /> },
  spent_promotion:   { label: 'Featured Listing',     creditColor: 'text-rose-600',    bg: 'bg-rose-50',     icon: <ArrowDownRight className="w-4 h-4 text-rose-500" /> },
  spent_featured:    { label: 'Featured Reel',         creditColor: 'text-rose-600',    bg: 'bg-rose-50',     icon: <ArrowDownRight className="w-4 h-4 text-rose-500" /> },
  spent_boost:       { label: 'Boosted Reel',          creditColor: 'text-rose-600',    bg: 'bg-rose-50',     icon: <Rocket         className="w-4 h-4 text-rose-500" /> },
  deducted_admin:    { label: 'Admin Deduction',       creditColor: 'text-rose-600',    bg: 'bg-rose-50',     icon: <ArrowDownRight className="w-4 h-4 text-rose-500" /> },
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

  // ── Gift Coins modal state ──────────────────────────────────────────────
  const [showGiftModal, setGiftModal]     = useState(false);
  const [giftMode,      setGiftMode]      = useState<'email' | 'phone'>('email');
  const [giftEmail,     setGiftEmail]     = useState('');
  const [giftPhone,     setGiftPhone]     = useState('');
  const [giftAmount,    setGiftAmount]    = useState<number>(10);
  const [giftStep,      setGiftStep]      = useState<'input' | 'confirm'>('input');
  const [giftLoading,   setGiftLoading]   = useState(false);
  const [giftError,     setGiftError]     = useState('');
  const [giftSuccess,   setGiftSuccess]   = useState('');

  // ── Use Coins modal state ────────────────────────────────────────────────
  const [showUseModal,   setShowUseModal]   = useState(false);
  const [useTab,         setUseTab]         = useState<'feature' | 'boost'>('feature');
  const [userProperties,  setUserProperties]  = useState<Property[]>([]);
  const [userReels,       setUserReels]       = useState<Reel[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [redeemLoading,   setRedeemLoading]   = useState<string | null>(null);
  const [redeemSuccess,   setRedeemSuccess]   = useState('');
  const [useError,        setUseError]        = useState('');

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

  // ── Gift Coins handlers ──────────────────────────────────────────────────
  const openGiftModal = () => {
    setGiftModal(true);
    setGiftStep('input');
    setGiftEmail('');
    setGiftPhone('');
    setGiftAmount(10);
    setGiftError('');
    setGiftSuccess('');
  };

  const handleGiftSubmit = async () => {
    setGiftError('');
    if (giftMode === 'email') {
      if (!giftEmail.trim()) { setGiftError('Please enter your friend\u2019s registered email address.'); return; }
    } else {
      if (!giftPhone.trim()) { setGiftError('Please enter your friend\u2019s registered phone number.'); return; }
    }
    if (!giftAmount || giftAmount <= 0) { setGiftError('Please enter a valid coin amount.'); return; }
    if (balance < giftAmount) { setGiftError(`Insufficient balance. You have ${balance} coins.`); return; }
    setGiftStep('confirm'); // move to confirmation step
  };

  const handleGiftConfirm = async () => {
    setGiftLoading(true);
    setGiftError('');
    try {
      const result = giftMode === 'email'
        ? await api.giftCoins(giftEmail.trim(), giftAmount)
        : await api.giftCoinsByPhone(giftPhone.trim(), giftAmount);
      setGiftSuccess(`🎉 ${result.amount} coins sent to ${result.receiverName}!`);
      setGiftStep('input');
      setGiftModal(false);
      loadAll(); // refresh wallet + transactions
    } catch (err: any) {
      setGiftError(err.message || 'Failed to send coins. Please try again.');
      setGiftStep('input'); // go back to input to fix errors
    } finally {
      setGiftLoading(false);
    }
  };

  // ── Use Coins handlers ───────────────────────────────────────────────────
  const openUseModal = async () => {
    setShowUseModal(true);
    setUseError('');
    setRedeemSuccess('');
    setUseTab('feature');
    try {
      const [dash, settings] = await Promise.all([
        api.getProfessionalDashboard(currentUser!.id),
        api.getPlatformSettings(),
      ]);
      setUserProperties(dash.properties || []);
      setUserReels(dash.reels || []);
      setPlatformSettings(settings);
    } catch (e) {
      console.error('[TokenPage] Use Coins load error:', e);
      setUseError('Could not load your listings. Please try again.');
    }
  };

  const handleRedeemFeature = async (prop: Property) => {
    if (prop.featured) return;
    const cost = platformSettings?.feature_property_cost ?? 50;
    const days = platformSettings?.feature_property_duration_days ?? 7;
    if (!confirm(`Feature "${prop.title}" for ${cost} coins (${days} days)? This will boost your listing's visibility across IndoProperty.`)) return;
    setRedeemLoading(prop.id);
    setUseError('');
    try {
      await api.redeemForFeature(prop.id);
      setUserProperties(prev => prev.map(p => p.id === prop.id ? { ...p, featured: true } : p));
      setRedeemSuccess(`🎉 "${prop.title}" is now featured for ${days} days!`);
      setTimeout(() => setRedeemSuccess(''), 4000);
      loadAll(); // refresh wallet balance
    } catch (err: any) {
      setUseError(err.message || 'Failed to feature listing.');
    } finally {
      setRedeemLoading(null);
    }
  };

  const handleRedeemBoost = async (reel: Reel) => {
    if (reel.boosted) return;
    const cost = platformSettings?.boost_reel_cost ?? 30;
    const days = platformSettings?.boost_reel_duration_days ?? 7;
    if (!confirm(`Boost "${reel.title}" for ${cost} coins (${days} days)? This will increase your reel's visibility in the feed.`)) return;
    setRedeemLoading(reel.id);
    setUseError('');
    try {
      await api.redeemForBoost(reel.id);
      setUserReels(prev => prev.map(r => r.id === reel.id ? { ...r, boosted: true } : r));
      setRedeemSuccess(`🚀 "${reel.title}" is now boosted for ${days} days!`);
      setTimeout(() => setRedeemSuccess(''), 4000);
      loadAll(); // refresh wallet balance
    } catch (err: any) {
      setUseError(err.message || 'Failed to boost reel.');
    } finally {
      setRedeemLoading(null);
    }
  };

  if (!currentUser) return <GuestTokens onOpenAuth={onOpenAuth} />;

  const balance     = wallet?.balance      ?? 0;
  const earned      = wallet?.total_earned ?? 0;
  const spent       = wallet?.total_spent  ?? 0;
  const rewarded    = referrals.filter(r => r.status === 'rewarded').length;
  const shareLink   = `https://play.google.com/store/apps/details?id=com.swaraj.realestate&pcampaignid=web_share`;

  const copyCode = async () => {
    // Copy the full shareable message — link + referral code together
    const fullMsg = `🏠 Join IndoProperty — India's Real Estate app!\n\nUse my referral code *${refCode}* when you sign up to earn 25 free tokens!\n\n👉 Download: ${shareLink}`;
    try { await navigator.clipboard.writeText(fullMsg); } catch { /* ok */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = () => {
    // navigator.share() MUST be called synchronously inside a click handler
    // — no await before it or Android treats it as untrusted and ignores it
    const fullMsg = `🏠 Join IndoProperty — India's Real Estate app!\n\nUse my referral code *${refCode}* when you sign up to earn 25 free tokens!\n\n👉 Download: ${shareLink}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      // Fires the native Android share sheet (WhatsApp, Instagram, Telegram, SMS etc.)
      navigator.share({
        title: 'Join IndoProperty',
        text: fullMsg,
        url: shareLink,
      }).catch(() => { /* user cancelled — no action */ });
    } else {
      // Desktop / browser fallback — copy to clipboard
      navigator.clipboard?.writeText(fullMsg).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
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

      {/* ── Gift Coins & Use Coins action buttons ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={openGiftModal}
          className="flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm rounded-2xl shadow-md shadow-emerald-200 active:scale-95 transition cursor-pointer"
        >
          <Gift className="w-5 h-5" /> Gift Coins
        </button>
        <button
          onClick={openUseModal}
          className="flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm rounded-2xl shadow-md shadow-indigo-200 active:scale-95 transition cursor-pointer"
        >
          <Rocket className="w-5 h-5" /> Use Coins
        </button>
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

              {/* Platform share buttons */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Share on</p>
                <div className="grid grid-cols-5 gap-2">
                  {/* WhatsApp */}
                  <button
                    onClick={() => {
                      const msg = encodeURIComponent(`🏠 Join IndoProperty!\n\nUse my referral code *${refCode}* to earn 25 free tokens when you sign up.\n\n👉 ${shareLink}`);
                      window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 transition active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </div>
                    <span className="text-[10px] font-bold text-slate-700">WhatsApp</span>
                  </button>

                  {/* Telegram */}
                  <button
                    onClick={() => {
                      const msg = encodeURIComponent(`🏠 Join IndoProperty! Use my referral code ${refCode} to earn 25 free tokens. Download: ${shareLink}`);
                      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${msg}`, '_blank');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 transition active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#2AABEE] flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    </div>
                    <span className="text-[10px] font-bold text-slate-700">Telegram</span>
                  </button>

                  {/* Instagram — copy + open */}
                  <button
                    onClick={() => {
                      const msg = `🏠 Join IndoProperty! Use my referral code ${refCode} to earn 25 free tokens. Download: ${shareLink}`;
                      navigator.clipboard?.writeText(msg).catch(() => {});
                      window.open('https://www.instagram.com/', '_blank');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-pink-50 hover:bg-pink-100 transition active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    </div>
                    <span className="text-[10px] font-bold text-slate-700">Instagram</span>
                  </button>

                  {/* Facebook */}
                  <button
                    onClick={() => {
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}&quote=${encodeURIComponent(`Use my referral code ${refCode} to earn 25 free tokens on IndoProperty!`)}`, '_blank');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 transition active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </div>
                    <span className="text-[10px] font-bold text-slate-700">Facebook</span>
                  </button>

                  {/* More / Native share */}
                  <button
                    onClick={shareNative}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 transition active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shadow-md">
                      <Share2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-700">More</span>
                  </button>
                </div>

                {/* Copy full message */}
                <button
                  onClick={copyCode}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border font-bold text-sm transition active:scale-95 ${
                    copied
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Message Copied!' : 'Copy Message + Link + Code'}
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
            <p className="text-[11px] text-slate-400">Enter a friend's code — they earn 50 coins, you get 25 welcome coins</p>
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

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* GIFT COINS MODAL                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl"><Gift className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-base">Gift Coins to a Friend</h3>
                  <p className="text-xs text-emerald-100">Transfer coins instantly — free of charge</p>
                </div>
              </div>
              <button onClick={() => setGiftModal(false)} className="text-white/70 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Balance display */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800">Your Balance</span>
                <span className="text-lg font-black text-amber-700 flex items-center gap-1">
                  <Coins className="w-4 h-4" /> {balance.toLocaleString()}
                </span>
              </div>

              {giftStep === 'input' ? (
                <>
                  {/* Recipient mode toggle: Email / Phone */}
                  <div className="flex border border-slate-200 p-1 bg-slate-50 rounded-2xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => { setGiftMode('email'); setGiftError(''); }}
                      className={`flex-1 py-2 rounded-xl transition ${
                        giftMode === 'email' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-slate-600'
                      }`}
                    >
                      📧 By Email
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGiftMode('phone'); setGiftError(''); }}
                      className={`flex-1 py-2 rounded-xl transition ${
                        giftMode === 'phone' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-slate-600'
                      }`}
                    >
                      📱 By Phone
                    </button>
                  </div>

                  {/* Recipient input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {giftMode === 'email' ? "Friend's Registered Email Address" : "Friend's Registered Phone Number"}
                    </label>
                    <input
                      type={giftMode === 'email' ? 'email' : 'tel'}
                      value={giftMode === 'email' ? giftEmail : giftPhone}
                      onChange={e => giftMode === 'email' ? setGiftEmail(e.target.value) : setGiftPhone(e.target.value)}
                      placeholder={giftMode === 'email' ? 'friend@example.com' : '+91 98765 43210'}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      {giftMode === 'email'
                        ? 'Your friend must be registered on IndoProperty.'
                        : 'Enter the phone number your friend used to register on IndoProperty.'}
                    </p>
                  </div>

                  {/* Amount input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Coin Amount
                    </label>
                    <input
                      type="number"
                      value={giftAmount}
                      onChange={e => setGiftAmount(Math.max(1, parseInt(e.target.value) || 0))}
                      min={1}
                      max={balance}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {/* Quick amount buttons */}
                    <div className="flex gap-2 mt-2">
                      {[10, 25, 50, 100].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setGiftAmount(amt)}
                          disabled={amt > balance}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                            giftAmount === amt
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          } disabled:opacity-30`}
                        >
                          {amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {giftError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" /> {giftError}
                    </div>
                  )}

                  <button
                    onClick={handleGiftSubmit}
                    disabled={giftLoading}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm rounded-2xl shadow-md shadow-emerald-200 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" /> Review Gift
                  </button>
                </>
              ) : (
                /* ── Confirmation step ── */
                <div className="space-y-4 text-center py-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <Gift className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">You are about to send</p>
                    <p className="text-3xl font-black text-slate-900 mt-1">{giftAmount} coins</p>
                    <p className="text-sm text-slate-500 mt-1">to <span className="font-bold text-slate-700">{giftMode === 'email' ? giftEmail : giftPhone}</span></p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800 font-medium">
                    After sending, you'll have <span className="font-black">{(balance - giftAmount).toLocaleString()}</span> coins left.
                  </div>
                  {giftError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" /> {giftError}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setGiftStep('input')}
                      disabled={giftLoading}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold text-sm rounded-2xl hover:bg-slate-200 transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleGiftConfirm}
                      disabled={giftLoading}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-md shadow-emerald-200 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {giftLoading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <><Send className="w-4 h-4" /> Confirm & Send</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gift success toast */}
      {giftSuccess && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-600 text-white font-bold text-sm rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-5 h-5" /> {giftSuccess}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* USE COINS MODAL                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {showUseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl"><Rocket className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-base">Use Coins</h3>
                  <p className="text-xs text-indigo-100">Feature listings & boost reels for more visibility</p>
                </div>
              </div>
              <button onClick={() => setShowUseModal(false)} className="text-white/70 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>

            {/* Balance + tab selector */}
            <div className="px-5 pt-4 shrink-0 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800">Available Balance</span>
                <span className="text-lg font-black text-amber-700 flex items-center gap-1">
                  <Coins className="w-4 h-4" /> {balance.toLocaleString()}
                </span>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                <button
                  onClick={() => setUseTab('feature')}
                  className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${useTab === 'feature' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'text-slate-600'}`}
                >
                  <Building2 className="w-4 h-4" /> Feature Listing
                </button>
                <button
                  onClick={() => setUseTab('boost')}
                  className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${useTab === 'boost' ? 'bg-white text-purple-600 shadow-sm font-black' : 'text-slate-600'}`}
                >
                  <Film className="w-4 h-4" /> Boost Reel
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {redeemSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> {redeemSuccess}
                </div>
              )}
              {useError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" /> {useError}
                </div>
              )}

              {useTab === 'feature' ? (
                /* ── Feature Property tab ── */
                <>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Cost: <strong className="text-slate-700">{platformSettings?.feature_property_cost ?? 50} coins</strong> per listing</span>
                    <span>Duration: <strong className="text-slate-700">{platformSettings?.feature_property_duration_days ?? 7} days</strong></span>
                  </div>
                  {userProperties.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm font-semibold">No properties yet</p>
                      <p className="text-xs mt-0.5">Add a property listing to feature it.</p>
                    </div>
                  ) : (
                    userProperties.map(prop => (
                      <div key={prop.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-indigo-300 transition">
                        <img
                          src={prop.media?.[0]?.url || prop.images?.[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=200'}
                          alt={prop.title}
                          className="w-14 h-14 rounded-xl object-cover border shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-sm text-slate-800 truncate">{prop.title}</p>
                            {prop.featured && (
                              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black uppercase rounded flex items-center gap-0.5 shrink-0">
                                <Star className="w-2.5 h-2.5 fill-white" /> Featured
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">{prop.location}, {prop.city}</p>
                        </div>
                        {prop.featured ? (
                          <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-lg flex items-center gap-1 shrink-0">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Active
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRedeemFeature(prop)}
                            disabled={redeemLoading === prop.id}
                            className="shrink-0 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {redeemLoading === prop.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <><Sparkles className="w-3.5 h-3.5" /> Feature ({platformSettings?.feature_property_cost ?? 50})</>
                            )}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </>
              ) : (
                /* ── Boost Reel tab ── */
                <>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Cost: <strong className="text-slate-700">{platformSettings?.boost_reel_cost ?? 30} coins</strong> per reel</span>
                    <span>Duration: <strong className="text-slate-700">{platformSettings?.boost_reel_duration_days ?? 7} days</strong></span>
                  </div>
                  {userReels.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Film className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm font-semibold">No reels yet</p>
                      <p className="text-xs mt-0.5">Upload a reel to boost it in the feed.</p>
                    </div>
                  ) : (
                    userReels.map(reel => (
                      <div key={reel.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-purple-300 transition">
                        <img
                          src={reel.thumbnail_url || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=200'}
                          alt={reel.title}
                          className="w-14 h-14 rounded-xl object-cover border shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-sm text-slate-800 truncate">{reel.title}</p>
                            {reel.boosted && (
                              <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[9px] font-black uppercase rounded flex items-center gap-0.5 shrink-0">
                                <Rocket className="w-2.5 h-2.5" /> Boosted
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">❤️ {reel.likes_count} · 👁 {reel.views_count}</p>
                        </div>
                        {reel.boosted ? (
                          <span className="px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold rounded-lg flex items-center gap-1 shrink-0">
                            <Rocket className="w-3 h-3 text-purple-500" /> Active
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRedeemBoost(reel)}
                            disabled={redeemLoading === reel.id}
                            className="shrink-0 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {redeemLoading === reel.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <><Rocket className="w-3.5 h-3.5" /> Boost ({platformSettings?.boost_reel_cost ?? 30})</>
                            )}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
