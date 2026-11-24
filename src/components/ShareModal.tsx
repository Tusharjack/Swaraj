import React, { useState } from 'react';
import { X, Check, Copy, Share2, Send, Download } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  text?: string;
  url: string;
  imageUrl?: string;
  /** Reel ID — when present, generates https://indoproperty.in/reel/:id as the share URL */
  reelId?: string;
  /** Creator display name — shown on the reel preview card */
  creatorName?: string;
  /** Creator avatar URL — shown on the reel preview card */
  creatorAvatar?: string;
}

// ─── Play Store / App Store Google Play SVG ───────────────────────────────────
const PlayStoreIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3.18 23.76c.3.17.65.19.97.07l11.4-6.58-2.57-2.57-9.8 9.08zM.49 2.17C.18 2.5 0 3.01 0 3.69v16.62c0 .68.18 1.19.49 1.52l.08.08 9.31-9.31v-.22L.57 2.09l-.08.08zM19.84 10.3l-2.65-1.53-2.9 2.9 2.9 2.9 2.67-1.54c.76-.44.76-1.29-.02-1.73zM3.18.24L14.98 7.3l-2.57 2.57-9.23-9.63z"/>
  </svg>
);

// ─── WhatsApp Icon ────────────────────────────────────────────────────────────
const WhatsAppIcon = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TelegramIcon = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const TwitterXIcon = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.swaraj.realestate&pcampaignid=web_share';

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  text = '',
  url: rawUrl,
  imageUrl,
  reelId,
  creatorName,
  creatorAvatar,
}) => {
  const [copied, setCopied] = useState(false);
  const [instaCopied, setInstaCopied] = useState(false);

  if (!isOpen) return null;

  // Build the canonical share URL:
  //   • If we have a reelId → https://indoproperty.in/reel/:id
  //     This is the deep link URL that opens the app if installed,
  //     or shows the ReelLandingPage in a browser.
  //   • Otherwise fall through to whatever url prop was passed.
  //   • Never share localhost / internal dev URLs.
  const WEBSITE = 'https://indoproperty.in';
  const appUrl = reelId
    ? `${WEBSITE}/reel/${reelId}`
    : (!rawUrl ||
        rawUrl.startsWith('http://localhost') ||
        rawUrl.startsWith('http://127') ||
        rawUrl === '/')
      ? PLAY_STORE_URL
      : rawUrl;

  // The full share message — includes the deep link URL.
  // Recipients with the app installed will be taken directly to the reel.
  // Recipients without the app will see the web landing page.
  const shareMsg = text
    ? `🎬 ${title}\n${text}\n\n📱 Watch on IndoProperty → ${appUrl}`
    : `🎬 ${title}\n\n📱 Watch on IndoProperty → ${appUrl}`;

  const enc = encodeURIComponent;

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareMsg); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = shareMsg;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleInsta = async () => {
    try { await navigator.clipboard.writeText(shareMsg); } catch { /* ok */ }
    setInstaCopied(true);
    setTimeout(() => setInstaCopied(false), 3000);
    window.open('https://www.instagram.com/', '_blank');
  };

  const handleNative = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title, text: shareMsg, url: appUrl }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[94vh]">

        {/* ── Drag handle (mobile) ── */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* ── Header ── */}
        <div className="px-5 pb-4 pt-2 sm:pt-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl"><Share2 className="w-4 h-4" /></div>
            <div>
              <h3 className="font-bold text-sm">Share Reel</h3>
              <p className="text-[11px] text-slate-300">Send this property video to your network</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* ── Reel Preview Card ── */}
          <div className="relative bg-slate-900 mx-4 mt-4 rounded-2xl overflow-hidden shadow-lg border border-slate-700">
            {imageUrl ? (
              <div className="relative">
                {/* Thumbnail — aspect-video for landscape or taller crop for portrait feel */}
                <img
                  src={imageUrl}
                  alt={title}
                  className="w-full h-52 object-cover"
                />
                {/* Gradient scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                {/* Play icon badge */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-xl">
                  <svg className="w-6 h-6 text-white fill-white translate-x-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>

                {/* Creator + title overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
                  {creatorName && (
                    <div className="flex items-center gap-2">
                      {creatorAvatar && (
                        <img src={creatorAvatar} alt={creatorName}
                          className="w-6 h-6 rounded-full object-cover border border-white/30 shrink-0" />
                      )}
                      <span className="text-[11px] font-bold text-white/90">@{creatorName}</span>
                    </div>
                  )}
                  <p className="font-bold text-sm text-white line-clamp-1 leading-tight">{title}</p>
                  {text && <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">{text}</p>}
                </div>
              </div>
            ) : (
              /* Fallback: no thumbnail */
              <div className="p-4 flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-indigo-900 flex items-center justify-center shrink-0 text-indigo-400">
                  <Share2 className="w-6 h-6" />
                </div>
                <div className="overflow-hidden">
                  {creatorName && (
                    <p className="text-[11px] text-indigo-300 font-semibold truncate">@{creatorName}</p>
                  )}
                  <p className="font-bold text-sm text-white truncate">{title}</p>
                  {text && <p className="text-[11px] text-slate-400 truncate mt-0.5">{text}</p>}
                </div>
              </div>
            )}

            {/* IndoProperty app badge at bottom of preview card */}
            <div className="bg-black/80 px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <img src="/logo.png" alt="IndoProperty" className="w-6 h-6 rounded-lg object-contain bg-white shrink-0" />
                <span className="text-[11px] font-bold text-white truncate">IndoProperty</span>
                <span className="text-[10px] text-slate-400 shrink-0">· Real Estate App</span>
              </div>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 rounded-xl text-[11px] font-black active:scale-95 transition"
              >
                <Download className="w-3.5 h-3.5" /> Get App
              </a>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* ── App Download CTA ── */}
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm shadow-lg shadow-indigo-500/30 active:scale-95 transition"
            >
              <PlayStoreIcon />
              Download IndoProperty on Google Play
            </a>

            {/* ── Platform grid ── */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Share via</p>
              <div className="grid grid-cols-5 gap-2 text-center">
                {/* WhatsApp */}
                <button
                  onClick={() => window.open(`https://api.whatsapp.com/send?text=${enc(shareMsg)}`, '_blank')}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition">
                    <WhatsAppIcon />
                  </div>
                  <span className="text-[10px] font-bold">WhatsApp</span>
                </button>

                {/* Instagram */}
                <button
                  onClick={handleInsta}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-pink-50 hover:bg-pink-100 text-pink-700 transition group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition">
                    <InstagramIcon />
                  </div>
                  <span className="text-[10px] font-bold">Insta</span>
                </button>

                {/* Facebook */}
                <button
                  onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${enc(appUrl)}&quote=${enc(shareMsg)}`, '_blank')}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 transition group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition">
                    <FacebookIcon />
                  </div>
                  <span className="text-[10px] font-bold">Facebook</span>
                </button>

                {/* Telegram */}
                <button
                  onClick={() => window.open(`https://t.me/share/url?url=${enc(appUrl)}&text=${enc(shareMsg)}`, '_blank')}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-700 transition group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition">
                    <TelegramIcon />
                  </div>
                  <span className="text-[10px] font-bold">Telegram</span>
                </button>

                {/* X / Twitter */}
                <button
                  onClick={() => window.open(`https://twitter.com/intent/tweet?text=${enc(shareMsg)}`, '_blank')}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition">
                    <TwitterXIcon />
                  </div>
                  <span className="text-[10px] font-bold">X</span>
                </button>
              </div>

              {instaCopied && (
                <p className="mt-2 text-[11px] text-center text-pink-600 font-semibold">
                  ✓ Copied! Open Instagram and paste in Stories or DMs.
                </p>
              )}
            </div>

            {/* ── Copy link ── */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 font-medium">
                📲 Smart link — opens app if installed, otherwise shows preview
              </p>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 truncate leading-tight">
                  {appUrl}
                </div>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 px-4 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200'
                  }`}
                >
                  {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
            </div>

            {/* Native share */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNative}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4 text-indigo-600" /> More Options (Native Share)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
