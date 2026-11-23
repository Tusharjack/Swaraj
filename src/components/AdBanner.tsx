import React, { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import type { Ad } from '../types/database';

/**
 * Horizontal scrolling ad banner shown on the home / properties feed.
 * Ads are created by admins. Each card links to its target URL.
 */
export const AdBanner: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getActiveAds()
      .then((list) => { if (!cancelled) setAds(list); })
      .catch((e) => console.warn('[AdBanner] load error:', e));
    return () => { cancelled = true; };
  }, []);

  if (hidden || ads.length === 0) return null;

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Sponsored
        </span>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
          title="Hide ads for this session"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1 -mx-4 sm:mx-0 px-4 sm:px-0">
        {ads.map((ad) => (
          <a
            key={ad.id}
            href={ad.link_url || '#'}
            target={ad.link_url ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="snap-start shrink-0 group"
          >
            <div className="relative w-72 h-32 sm:w-80 sm:h-36 rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg transition">
              <img
                src={ad.image_url}
                alt={ad.title}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <p className="text-white text-xs font-bold drop-shadow line-clamp-1">
                  {ad.title}
                </p>
                {ad.link_url && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-200 font-semibold">
                    View <ExternalLink className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold uppercase rounded">
                Ad
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
};
