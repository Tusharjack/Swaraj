import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, MessageCircle, Heart, UserPlus, MessageSquare, Home, ShieldCheck, Check, X } from 'lucide-react';
import type { Notification, Profile } from '../types/database';
import { api } from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function iconFor(type: Notification['type']) {
  switch (type) {
    case 'message':  return <MessageCircle className="w-4 h-4 text-purple-500" />;
    case 'enquiry':  return <MessageSquare className="w-4 h-4 text-indigo-500" />;
    case 'like':     return <Heart className="w-4 h-4 text-rose-500" />;
    case 'comment':  return <MessageCircle className="w-4 h-4 text-sky-500" />;
    case 'follow':   return <UserPlus className="w-4 h-4 text-emerald-500" />;
    case 'match':    return <Home className="w-4 h-4 text-amber-500" />;
    case 'account':  return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
    default:         return <Bell className="w-4 h-4 text-slate-500" />;
  }
}

// Maps a notification link_url to an app tab (the app is tab-based, not routed)
function tabForLink(link?: string): string | null {
  if (!link) return null;
  if (link.startsWith('/chats')) return 'chats';
  if (link.startsWith('/reels')) return 'reels';
  if (link.startsWith('/profile')) return 'professional';
  if (link.startsWith('/enquiries')) return 'chats';
  if (link.startsWith('/property')) return 'properties';
  return null;
}

interface NotificationBellProps {
  currentUser: Profile | null;
  onOpenAuth: () => void;
  onNavigate?: (tab: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser, onOpenAuth, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!currentUser) { setItems([]); setUnread(0); return; }
    try {
      const [list, count] = await Promise.all([
        api.getNotifications(currentUser.id),
        api.getUnreadNotificationCount(currentUser.id),
      ]);
      setItems(list);
      setUnread(count);
    } catch { /* ignore — keep last known state */ }
  }, [currentUser]);

  // Initial load + realtime subscription + light polling fallback
  useEffect(() => {
    load();
    if (!currentUser) return;
    const unsub = api.subscribeToNotifications(currentUser.id, () => load());
    const iv = setInterval(load, 30000);
    return () => { unsub(); clearInterval(iv); };
  }, [currentUser, load]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (!currentUser) { onOpenAuth(); return; }
    setOpen(o => !o);
  };

  const handleItemClick = async (n: Notification) => {
    if (!n.read) {
      try { await api.markNotificationRead(n.id); } catch { /* ignore */ }
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, read: true } : i));
      setUnread(prev => Math.max(0, prev - 1));
    }
    const tab = tabForLink(n.link_url);
    if (tab && onNavigate) { onNavigate(tab); setOpen(false); }
  };

  const handleMarkAll = async () => {
    if (!currentUser) return;
    try { await api.markAllNotificationsRead(currentUser.id); } catch { /* ignore */ }
    setItems(prev => prev.map(i => ({ ...i, read: true })));
    setUnread(0);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && currentUser && (
        <div className="absolute top-full right-0 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-black text-slate-900">Notifications</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={handleMarkAll} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-50 transition cursor-pointer flex items-center gap-1">
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">You're all caught up</p>
              </div>
            ) : items.map(n => (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-slate-50 last:border-0 transition hover:bg-slate-50 cursor-pointer ${n.read ? '' : 'bg-indigo-50/40'}`}
              >
                <div className="p-2 rounded-xl bg-slate-100 shrink-0 mt-0.5">{iconFor(n.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900 truncate">{n.title}</p>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                    <span className="ml-auto text-[10px] text-slate-400 shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{n.message}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
