import React, { useState } from 'react';
import { X, Check, Copy, Share2, MessageCircle, Send, Globe } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  text?: string;
  url: string;
  imageUrl?: string;
}

// Brand SVG Icons
const InstagramIcon = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const TelegramIcon = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  text = '',
  url,
  imageUrl
}) => {
  const [copied, setCopied] = useState(false);
  const [instaCopied, setInstaCopied] = useState(false);

  if (!isOpen) return null;

  const fullShareText = text ? `${title} - ${text}` : title;
  const encodedText = encodeURIComponent(fullShareText);
  const encodedUrl = encodeURIComponent(url);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_err) {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShareWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${fullShareText}\n${url}`)}`;
    window.open(waUrl, '_blank');
  };

  const handleShareInstagram = async () => {
    try {
      await navigator.clipboard.writeText(`${fullShareText}\n${url}`);
      setInstaCopied(true);
      setTimeout(() => setInstaCopied(false), 3000);
    } catch (_e) {}
    window.open('https://www.instagram.com/', '_blank');
  };

  const handleShareFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
    window.open(fbUrl, '_blank');
  };

  const handleShareTwitter = () => {
    const twUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    window.open(twUrl, '_blank');
  };

  const handleShareTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    window.open(tgUrl, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: fullShareText,
          url
        });
      } catch (_e) {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Share Property / Reel</h3>
              <p className="text-[11px] text-slate-300">Spread the word on your favorite social platforms</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition text-lg font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Card */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
          {imageUrl ? (
            <img src={imageUrl} alt={title} className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
              <Globe className="w-6 h-6" />
            </div>
          )}
          <div className="overflow-hidden">
            <h4 className="font-bold text-xs text-slate-900 truncate">{title}</h4>
            {text && <p className="text-[11px] text-slate-500 truncate mt-0.5">{text}</p>}
            <p className="text-[10px] text-indigo-600 font-mono truncate mt-0.5">{url}</p>
          </div>
        </div>

        {/* Social Sharing Options Grid */}
        <div className="p-5 space-y-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Share Via Platform
          </label>

          <div className="grid grid-cols-5 gap-2 text-center">
            {/* WhatsApp */}
            <button
              onClick={handleShareWhatsApp}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30 group-hover:scale-110 transition">
                <MessageCircle className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold">WhatsApp</span>
            </button>

            {/* Instagram */}
            <button
              onClick={handleShareInstagram}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-pink-50 hover:bg-pink-100 text-pink-700 transition group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-rose-500/30 group-hover:scale-110 transition">
                <InstagramIcon />
              </div>
              <span className="text-[10px] font-bold">Insta</span>
            </button>

            {/* Facebook */}
            <button
              onClick={handleShareFacebook}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 transition group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30 group-hover:scale-110 transition">
                <FacebookIcon />
              </div>
              <span className="text-[10px] font-bold">Facebook</span>
            </button>

            {/* Twitter / X */}
            <button
              onClick={handleShareTwitter}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/30 group-hover:scale-110 transition">
                <TwitterIcon />
              </div>
              <span className="text-[10px] font-bold">X / Twitter</span>
            </button>

            {/* Telegram */}
            <button
              onClick={handleShareTelegram}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-700 transition group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/30 group-hover:scale-110 transition">
                <TelegramIcon />
              </div>
              <span className="text-[10px] font-bold">Telegram</span>
            </button>
          </div>

          {instaCopied && (
            <div className="p-2.5 bg-pink-50 border border-pink-200 text-pink-700 text-xs rounded-xl text-center font-medium">
              ✨ Link copied to clipboard! Paste it into Instagram DMs or Stories.
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Or Copy Direct Link
            </label>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={url}
                className="flex-1 px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  copied
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/30'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Link
                  </>
                )}
              </button>
            </div>
          </div>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <div className="pt-2">
              <button
                onClick={handleNativeShare}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4 text-indigo-600" /> More Options (Native Share)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
