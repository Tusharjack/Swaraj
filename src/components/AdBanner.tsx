import React, { useEffect, useState, useRef } from 'react';
import { X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import type { Ad } from '../types/database';

/**
 * Full-width ad banner shown on the Properties feed.
 * Each ad card fills the full container width at a fixed tall height (like a
 * billboard). Multiple ads auto-rotate with dot indicators and manual
 * prev/next arrows — matching the full-bleed design in the screenshot.
 */
export const AdBanner: React.FC = () => {
  const [ads, setAds]       = useState<Ad[]>([]);
  const [hidden, setHidden] = useState(false);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getActiveAds()
      .then(list => { if (!cancelled) setAds(list); })
      .catch(e => console.warn('[AdBanner] load error:', e));
    return () => { cancelled = true; };
  }, []);

  // Auto-rotate every 4 s
  useEffect(() => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % ads.length);
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ads.length]);

  const goTo = (idx: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrent((idx + ads.length) % ads.length);
  };

  if (hidden || ads.length === 0) return null;

  const ad = ads[current];

  return (
    <section className="w-full relative">
      {/* ── Full-width card ── */}
      <a
        href={ad.link_url || '#'}
        target={ad.link_url ? '_blank' : undefined}
        rel="noopener noreferrer"
        className="block w-full relative overflow-hidden rounded-2xl shadow-md group"
        style={{ aspectRatio: '16/7', minHeight: 160 }}
      >
        {/* Background image — full cover */}
        <img
          src={ad.image_url}
          alt={ad.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-700"
          loading="lazy"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        {/* Ad label top-left */}
        <span className="absolute top-3 left-3 px-2 py-0.5 bg-black/55 backdrop-blur-sm text-white text-[9px] font-black uppercase rounded-md tracking-wider">
          Ad
        </span>

        {/* Close button top-right */}
        <button
          type="button"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setHidden(true); }}
          className="absolute top-2.5 right-2.5 p-1.5 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/80 transition"
          title="Hide ad"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Title + CTA bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-white font-black text-base leading-tight drop-shadow-lg line-clamp-2">
            {ad.title}
          </p>
          {ad.link_url && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-amber-300 font-bold drop-shadow">
              Learn more <ExternalLink className="w-3 h-3" />
            </span>
          )}
        </div>

        {/* SPONSORED label bottom-right */}
        <span className="absolute bottom-3 right-3 text-[9px] font-black uppercase tracking-widest text-white/50">
          Sponsored
        </span>
      </a>

      {/* ── Prev / Next arrows (only when >1 ad) ── */}
      {ads.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/80 transition z-10"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/80 transition z-10"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* ── Dot indicators ── */}
      {ads.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {ads.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${
                i === current
                  ? 'w-5 h-1.5 bg-indigo-600'
                  : 'w-1.5 h-1.5 bg-slate-300'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
