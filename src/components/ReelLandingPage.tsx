/**
 * ReelLandingPage — /reel/:id
 *
 * Shown to users who tap a shared reel link WITHOUT the app installed.
 * When the app IS installed, Android App Links intercepts the URL before
 * this page loads and opens the app directly.
 *
 * This page is also the HTML that bots (WhatsApp, Telegram, iMessage) scrape
 * for the link preview — the OG meta tags are injected server-side by the
 * Netlify Edge Function (netlify/edge-functions/reel-og.ts) so bots see the
 * right thumbnail and title without needing to execute JavaScript.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Reel } from '../types/database';

const PLAY_STORE =
  'https://play.google.com/store/apps/details?id=com.swaraj.realestate&pcampaignid=reel_share';
const APP_PACKAGE = 'com.swaraj.realestate';

interface ReelLandingPageProps {
  reelId: string;
}

export const ReelLandingPage: React.FC<ReelLandingPageProps> = ({ reelId }) => {
  const [reel, setReel]       = useState<Reel | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [openAttempted, setOpenAttempted] = useState(false);

  // ── Load reel data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!reelId) { setNotFound(true); setLoading(false); return; }
    api.getReelById(reelId)
      .then(r => { if (r) setReel(r); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [reelId]);

  // ── Auto-attempt open on Android (best-effort) ─────────────────────────
  // On Android, we try the intent:// URL immediately on load.
  // If the app is installed it opens silently. If not, nothing happens.
  useEffect(() => {
    const isAndroid = /android/i.test(navigator.userAgent);
    if (!isAndroid || openAttempted) return;
    setOpenAttempted(true);
    const intent =
      `intent://reel/${reelId}#Intent;` +
      `scheme=https;` +
      `package=${APP_PACKAGE};` +
      `S.browser_fallback_url=${encodeURIComponent(PLAY_STORE)};` +
      `end`;
    // Small delay so the page has rendered before we try to redirect
    const t = setTimeout(() => { window.location.href = intent; }, 600);
    return () => clearTimeout(t);
  }, [reelId, openAttempted]);

  // ── Manual open in app button ──────────────────────────────────────────
  const handleOpenInApp = () => {
    const isAndroid = /android/i.test(navigator.userAgent);
    const isIos     = /iphone|ipad|ipod/i.test(navigator.userAgent);

    if (isAndroid) {
      window.location.href =
        `intent://reel/${reelId}#Intent;` +
        `scheme=https;package=${APP_PACKAGE};` +
        `S.browser_fallback_url=${encodeURIComponent(PLAY_STORE)};end`;
    } else if (isIos) {
      // Try universal link first; fall back to App Store after 2 s
      window.location.href = `https://indoproperty.in/reel/${reelId}`;
      setTimeout(() => {
        if (!document.hidden) window.location.href = 'https://apps.apple.com/app/indoproperty';
      }, 2000);
    } else {
      window.location.href = PLAY_STORE;
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-full max-w-xs px-6 space-y-4">
          <div className="w-full aspect-[9/16] rounded-2xl bg-slate-800 animate-pulse" />
          <div className="h-4 bg-slate-800 rounded-full w-3/4 animate-pulse" />
          <div className="h-3 bg-slate-800 rounded-full w-1/2 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── 404 ────────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center space-y-6">
        <img src="/logo.png" alt="IndoProperty"
          className="w-20 h-20 rounded-3xl object-contain bg-white p-2 shadow-2xl" />
        <div>
          <h1 className="text-2xl font-black">Reel not found</h1>
          <p className="text-slate-400 text-sm mt-2">
            This reel may have been removed or the link is incorrect.
          </p>
        </div>
        <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 px-7 py-4 bg-white text-slate-900 font-black rounded-2xl shadow-xl text-sm active:scale-95 transition">
          <PlayStoreIcon /> Browse IndoProperty
        </a>
      </div>
    );
  }

  const creator  = reel!.creator;
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const isIos     = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isMobile  = isAndroid || isIos;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center">

      {/* ── Top bar ── */}
      <header className="w-full max-w-sm px-4 py-4 flex items-center gap-2.5">
        <img src="/logo.png" alt="IndoProperty"
          className="w-8 h-8 rounded-xl object-contain bg-white shrink-0" />
        <span className="font-black text-sm">IndoProperty</span>
        <span className="text-slate-500 text-xs">· Real Estate Reels</span>
      </header>

      {/* ── Reel card — Instagram portrait style ── */}
      <div className="w-full max-w-sm px-4 flex flex-col items-center">
        <div
          className="relative w-full overflow-hidden rounded-2xl bg-slate-900 shadow-2xl shadow-black/70"
          style={{ aspectRatio: '9/16', maxHeight: '72vh' }}
        >
          {/* Thumbnail */}
          {reel!.thumbnail_url ? (
            <img
              src={reel!.thumbnail_url}
              alt={reel!.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center">
              <svg className="w-20 h-20 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}

          {/* Gradient scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/30" />

          {/* Play badge */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-2xl">
              <svg className="w-8 h-8 fill-white translate-x-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Creator row — top */}
          {creator && (
            <div className="absolute top-3 left-3 right-3 flex items-center gap-2.5">
              {creator.avatar_url ? (
                <img src={creator.avatar_url} alt={creator.full_name}
                  className="w-9 h-9 rounded-full object-cover border-2 border-white/40 shrink-0 shadow-md" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 border-2 border-white/40 text-xs font-black">
                  {(creator.full_name || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-black text-sm leading-tight truncate text-white drop-shadow">
                  {creator.agency_name || creator.full_name}
                </p>
                {creator.verified && (
                  <span className="text-[10px] text-emerald-400 font-bold">✓ Verified Pro</span>
                )}
              </div>
            </div>
          )}

          {/* Title + caption — bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
            <h1 className="font-black text-base leading-snug drop-shadow-lg line-clamp-2">
              {reel!.title}
            </h1>
            {reel!.caption && (
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {reel!.caption}
              </p>
            )}
            {/* Stats row */}
            <div className="flex items-center gap-4 pt-1 text-xs text-slate-400 font-semibold">
              <span>❤️ {reel!.likes_count.toLocaleString()}</span>
              <span>💬 {reel!.comments_count.toLocaleString()}</span>
              <span>👁 {reel!.views_count.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ── CTAs ── */}
        <div className="w-full mt-5 space-y-3 pb-8">

          {/* Primary — open in app / download */}
          <button
            onClick={handleOpenInApp}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-base shadow-xl shadow-indigo-500/30 active:scale-95 transition flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            {isMobile ? 'Open in IndoProperty App' : 'Get IndoProperty'}
          </button>

          {/* Play Store fallback */}
          <a
            href={PLAY_STORE}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2.5 border border-slate-700 transition active:scale-95"
          >
            <PlayStoreIcon /> Download Free on Google Play
          </a>

          {/* Web / browser fallback */}
          <button
            onClick={() => { window.location.href = `/?reel=${reelId}`; }}
            className="w-full py-2.5 text-slate-500 hover:text-slate-300 text-xs font-semibold transition"
          >
            Continue on website →
          </button>
        </div>
      </div>

      <footer className="w-full text-center text-[11px] text-slate-700 pb-6 px-4">
        <a href="https://indoproperty.in" className="hover:text-slate-400 transition">
          IndoProperty · India's Real Estate Video Platform
        </a>
      </footer>
    </div>
  );
};

const PlayStoreIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3.18 23.76c.3.17.65.19.97.07l11.4-6.58-2.57-2.57-9.8 9.08zM.49 2.17C.18 2.5 0 3.01 0 3.69v16.62c0 .68.18 1.19.49 1.52l.08.08 9.31-9.31v-.22L.57 2.09l-.08.08zM19.84 10.3l-2.65-1.53-2.9 2.9 2.9 2.9 2.67-1.54c.76-.44.76-1.29-.02-1.73zM3.18.24L14.98 7.3l-2.57 2.57-9.23-9.63z"/>
  </svg>
);
