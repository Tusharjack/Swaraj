/**
 * ReelLandingPage
 *
 * Served when someone opens https://indoproperty.in/reel/:id in a browser
 * WITHOUT the app installed. It shows:
 *   - Reel thumbnail + title + creator
 *   - "Open in App" button (android-app:// intent — opens app if installed)
 *   - Google Play download CTA if app is not installed
 *   - Full web preview of the reel content so the page is shareable on social
 *
 * When the app IS installed Android intercepts the URL via App Links BEFORE
 * this page ever loads, so this page is only ever seen by people without the
 * app (or on desktop).
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Reel } from '../types/database';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.swaraj.realestate&pcampaignid=deeplink';
const APP_SCHEME = 'com.swaraj.realestate'; // Android intent scheme

interface ReelLandingPageProps {
  reelId: string;
}

export const ReelLandingPage: React.FC<ReelLandingPageProps> = ({ reelId }) => {
  const [reel, setReel] = useState<Reel | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [appTried, setAppTried] = useState(false);

  useEffect(() => {
    if (!reelId) { setNotFound(true); setLoading(false); return; }
    api.getReelById(reelId)
      .then(r => { if (r) setReel(r); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [reelId]);

  /* ── Try to open in the app via Android intent URL ── */
  const handleOpenInApp = () => {
    setAppTried(true);
    // intent:// URL — Android resolves this to the app if installed,
    // otherwise falls through to the Play Store fallback URL.
    const intentUrl =
      `intent://reel/${reelId}#Intent;` +
      `scheme=https;` +
      `package=${APP_SCHEME};` +
      `S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};` +
      `end`;

    // On iOS / desktop use a plain https deep link (Universal Link).
    // For Android the intent:// URL above handles everything.
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      window.location.href = intentUrl;
    } else {
      // iOS: try Universal Link scheme, then fall back to App Store
      window.location.href = `https://indoproperty.in/reel/${reelId}`;
      // After 2 s if nothing happened (app not installed), go to store
      setTimeout(() => {
        if (!document.hidden) {
          window.location.href = 'https://apps.apple.com/app/indoproperty';
        }
      }, 2000);
    }
  };

  /* ── SEO meta injection (og: tags for social previews) ── */
  useEffect(() => {
    if (!reel) return;
    document.title = `${reel.title} — IndoProperty`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setMeta('og:title',       reel.title);
    setMeta('og:description', reel.caption || 'Watch this property video reel on IndoProperty');
    setMeta('og:image',       reel.thumbnail_url || '/logo.png');
    setMeta('og:url',         `https://indoproperty.in/reel/${reelId}`);
    setMeta('og:type',        'video.other');
  }, [reel, reelId]);

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="space-y-4 w-full max-w-sm px-6">
          <div className="aspect-[9/16] rounded-3xl bg-slate-800 animate-pulse" />
          <div className="h-5 bg-slate-800 rounded-full w-3/4 animate-pulse" />
          <div className="h-4 bg-slate-800 rounded-full w-1/2 animate-pulse" />
        </div>
      </div>
    );
  }

  /* ── 404 fallback ── */
  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6 text-center space-y-6">
        <img src="/logo.png" alt="IndoProperty" className="w-20 h-20 rounded-3xl object-contain bg-white p-2 shadow-xl" />
        <div>
          <h1 className="text-2xl font-black">Reel not found</h1>
          <p className="text-slate-400 text-sm mt-2">
            This reel may have been removed or the link is incorrect.
          </p>
        </div>
        <a
          href={PLAY_STORE_URL}
          className="inline-flex items-center gap-3 px-6 py-3.5 bg-white text-slate-900 font-black rounded-2xl shadow-xl text-sm"
        >
          <PlayStoreIcon /> Browse IndoProperty
        </a>
      </div>
    );
  }

  const creator = reel!.creator;
  const webUrl  = `https://indoproperty.in/reel/${reelId}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* ── Top bar ── */}
      <header className="px-5 py-4 flex items-center gap-3 border-b border-slate-800">
        <img src="/logo.png" alt="IndoProperty" className="w-8 h-8 rounded-xl object-contain bg-white" />
        <span className="font-black text-sm tracking-tight">IndoProperty</span>
        <span className="text-slate-500 text-xs font-medium">· Real Estate Video Reels</span>
      </header>

      {/* ── Reel preview ── */}
      <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-sm mx-auto w-full space-y-5">

        {/* Thumbnail card */}
        <div className="w-full relative rounded-3xl overflow-hidden shadow-2xl shadow-black/50 bg-slate-900 border border-slate-800">
          {reel!.thumbnail_url ? (
            <img
              src={reel!.thumbnail_url}
              alt={reel!.title}
              className="w-full aspect-[9/16] object-cover"
            />
          ) : (
            <div className="w-full aspect-[9/16] flex items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900">
              <svg className="w-16 h-16 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}

          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-2xl">
              <svg className="w-7 h-7 text-white fill-white translate-x-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Creator badge */}
          {creator && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
              <div className="flex items-center gap-2.5">
                {creator.avatar_url && (
                  <img src={creator.avatar_url} alt={creator.full_name}
                    className="w-8 h-8 rounded-full object-cover border-2 border-white/30 shrink-0" />
                )}
                <div>
                  <p className="font-bold text-sm leading-tight">
                    @{creator.agency_name || creator.full_name}
                  </p>
                  {creator.verified && (
                    <span className="text-[10px] text-emerald-400 font-semibold">✓ Verified</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reel info */}
        <div className="w-full space-y-1.5 text-center">
          <h1 className="text-lg font-black leading-tight">{reel!.title}</h1>
          {reel!.caption && (
            <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">{reel!.caption}</p>
          )}
          <div className="flex items-center justify-center gap-4 pt-1 text-xs text-slate-500">
            <span>❤️ {reel!.likes_count}</span>
            <span>💬 {reel!.comments_count}</span>
            <span>👁 {reel!.views_count}</span>
          </div>
        </div>

        {/* ── Primary CTA: Open in App ── */}
        <div className="w-full space-y-3">
          <button
            onClick={handleOpenInApp}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-base shadow-xl shadow-indigo-500/30 active:scale-95 transition flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            {appTried ? 'Install & Watch on IndoProperty' : 'Watch in IndoProperty App'}
          </button>

          {/* Play Store fallback */}
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2.5 border border-slate-700 transition active:scale-95"
          >
            <PlayStoreIcon />
            Download on Google Play — Free
          </a>

          {/* Web fallback: continue in browser */}
          <a
            href={webUrl}
            onClick={(e) => {
              // Redirect to home and scroll to this reel in the feed
              e.preventDefault();
              window.location.href = `/?reel=${reelId}`;
            }}
            className="block text-center text-xs text-slate-500 hover:text-slate-300 transition py-1 cursor-pointer"
          >
            Continue on website →
          </a>
        </div>

        {/* Feature chips */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {['🏠 Buy & Rent', '🎬 Video Reels', '💬 Direct Chat', '🏦 Home Loans', '🪙 Coin Wallet'].map(f => (
            <span key={f} className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-medium">
              {f}
            </span>
          ))}
        </div>
      </main>

      <footer className="text-center text-xs text-slate-600 pb-6 px-4">
        IndoProperty · India's Real Estate Video Platform ·{' '}
        <a href="https://indoproperty.in" className="hover:text-slate-400 transition">indoproperty.in</a>
      </footer>
    </div>
  );
};

/* ── Google Play SVG ── */
const PlayStoreIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3.18 23.76c.3.17.65.19.97.07l11.4-6.58-2.57-2.57-9.8 9.08zM.49 2.17C.18 2.5 0 3.01 0 3.69v16.62c0 .68.18 1.19.49 1.52l.08.08 9.31-9.31v-.22L.57 2.09l-.08.08zM19.84 10.3l-2.65-1.53-2.9 2.9 2.9 2.9 2.67-1.54c.76-.44.76-1.29-.02-1.73zM3.18.24L14.98 7.3l-2.57 2.57-9.23-9.63z" />
  </svg>
);
