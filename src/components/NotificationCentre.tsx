import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  MessageCircle,
  Heart,
  UserPlus,
  MessageSquare,
  Building,
  ShieldCheck,
  CheckCheck,
  X,
  Trash2,
  Sparkles,
  Coins,
  ArrowRight
} from 'lucide-react';
import type { Notification, Profile } from '../types/database';
import { api } from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function iconBadgeFor(type: Notification['type']) {
  switch (type) {
    case 'message':
      return {
        bg: 'bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-purple-500/20',
        icon: <MessageCircle className="w-4 h-4 text-white" />
      };
    case 'enquiry':
      return {
        bg: 'bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-blue-500/20',
        icon: <Building className="w-4 h-4 text-white" />
      };
    case 'like':
      return {
        bg: 'bg-gradient-to-tr from-rose-500 to-pink-500 shadow-rose-500/20',
        icon: <Heart className="w-4 h-4 text-white fill-white" />
      };
    case 'comment':
      return {
        bg: 'bg-gradient-to-tr from-sky-500 to-blue-600 shadow-sky-500/20',
        icon: <MessageSquare className="w-4 h-4 text-white" />
      };
    case 'follow':
      return {
        bg: 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-emerald-500/20',
        icon: <UserPlus className="w-4 h-4 text-white" />
      };
    case 'match':
      return {
        bg: 'bg-gradient-to-tr from-amber-500 to-orange-500 shadow-amber-500/20',
        icon: <Sparkles className="w-4 h-4 text-white" />
      };
    case 'account':
      return {
        bg: 'bg-gradient-to-tr from-violet-600 to-purple-600 shadow-violet-500/20',
        icon: <ShieldCheck className="w-4 h-4 text-white" />
      };
    default:
      return {
        bg: 'bg-gradient-to-tr from-amber-500 to-yellow-500 shadow-amber-500/20',
        icon: <Coins className="w-4 h-4 text-white" />
      };
  }
}

interface NotificationBellProps {
  currentUser: Profile | null;
  onOpenAuth: () => void;
  onNavigate?: (tab: string, meta?: any) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser, onOpenAuth, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread' | 'messages'>('all');
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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

    const link = n.link_url || '';
    let tab = 'properties';
    const meta: { enquiryId?: string; propertyId?: string } = {};

    if (link.startsWith('/chats') || link.startsWith('/enquiries') || n.type === 'message' || n.type === 'enquiry') {
      tab = 'chats';
      const m = link.match(/[?&]enquiry_id=([^&]+)/) || link.match(/\/enquiries\/([^\/?]+)/);
      if (m) meta.enquiryId = m[1];
    } else if (link.startsWith('/reels') || n.type === 'like' || n.type === 'comment' || n.type === 'follow') {
      tab = 'reels';
    } else if (link.startsWith('/property') || n.type === 'match') {
      tab = 'properties';
      const m = link.match(/\/property\/([^\/?]+)/);
      if (m) meta.propertyId = m[1];
    } else if (link.startsWith('/tokens') || link.startsWith('/profile') || n.type === 'account') {
      tab = 'tokens';
    }

    if (onNavigate) {
      onNavigate(tab, meta);
      setOpen(false);
    }
  };

  const handleMarkAll = async () => {
    if (!currentUser) return;
    try { await api.markAllNotificationsRead(currentUser.id); } catch { /* ignore */ }
    setItems(prev => prev.map(i => ({ ...i, read: true })));
    setUnread(0);
  };

  const handleDelete = async (e: React.MouseEvent, n: Notification) => {
    e.stopPropagation();
    setItems(prev => prev.filter(i => i.id !== n.id));
    if (!n.read) setUnread(prev => Math.max(0, prev - 1));
    try { await api.deleteNotification(n.id); } catch { /* ignore */ }
  };

  const filteredItems = items.filter(i => {
    if (filter === 'unread') return !i.read;
    if (filter === 'messages') return i.type === 'message' || i.type === 'enquiry';
    return true;
  });

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition cursor-pointer active:scale-95 shadow-sm"
      >
        <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-700" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm shadow-rose-500/40 animate-pulse">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Mobile Backdrop */}
      {open && currentUser && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Popover Card */}
      {open && currentUser && (
        <div
          className="
            fixed left-3 right-3 top-16 sm:left-auto sm:right-0 sm:top-full mt-2
            w-auto sm:w-[25rem] max-h-[82vh] sm:max-h-[34rem]
            bg-white rounded-3xl shadow-2xl border border-slate-200/90
            overflow-hidden z-50 flex flex-col animate-in fade-in zoom-in-95 duration-150
          "
        >
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900 tracking-tight">Notifications</span>
                {unread > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-600">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={handleMarkAll}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-xl hover:bg-indigo-50 transition cursor-pointer flex items-center gap-1 active:scale-95"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 mt-2.5 bg-slate-200/60 p-1 rounded-xl text-[11px] font-bold text-slate-600">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 py-1 rounded-lg transition text-center cursor-pointer ${
                  filter === 'all' ? 'bg-white text-indigo-600 shadow-xs font-black' : 'hover:text-slate-900'
                }`}
              >
                All ({items.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`flex-1 py-1 rounded-lg transition text-center cursor-pointer ${
                  filter === 'unread' ? 'bg-white text-indigo-600 shadow-xs font-black' : 'hover:text-slate-900'
                }`}
              >
                Unread ({unread})
              </button>
              <button
                onClick={() => setFilter('messages')}
                className={`flex-1 py-1 rounded-lg transition text-center cursor-pointer ${
                  filter === 'messages' ? 'bg-white text-indigo-600 shadow-xs font-black' : 'hover:text-slate-900'
                }`}
              >
                Chats ({items.filter(i => i.type === 'message' || i.type === 'enquiry').length})
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
            {filteredItems.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto shadow-inner">
                  <Bell className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-800">You're all caught up!</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
                    {filter === 'unread'
                      ? 'No unread notifications at the moment.'
                      : filter === 'messages'
                      ? 'No new chat messages or direct enquiries.'
                      : 'We will notify you about messages, property enquiries and activity here.'}
                  </p>
                </div>
              </div>
            ) : (
              filteredItems.map(n => {
                const badge = iconBadgeFor(n.type);
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleItemClick(n)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleItemClick(n); } }}
                    className={`group w-full text-left px-4 py-3.5 flex items-start gap-3.5 transition cursor-pointer select-none ${
                      n.read ? 'bg-white hover:bg-slate-50/80' : 'bg-indigo-50/35 hover:bg-indigo-50/60'
                    }`}
                  >
                    {/* Icon Badge */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-md ${badge.bg}`}>
                        {badge.icon}
                      </div>
                      {!n.read && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-indigo-600 rounded-full ring-2 ring-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={`text-xs truncate ${n.read ? 'font-semibold text-slate-800' : 'font-extrabold text-slate-900'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] font-semibold text-slate-400 shrink-0 ml-1">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                        {n.message}
                      </p>

                      {/* Quick Action Link */}
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-indigo-600 group-hover:text-indigo-700">
                        <span>{n.type === 'message' || n.type === 'enquiry' ? 'Open chat' : 'View details'}</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>

                    {/* Delete action */}
                    <button
                      type="button"
                      onClick={e => handleDelete(e, n)}
                      aria-label="Delete notification"
                      title="Delete"
                      className="shrink-0 p-1.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition opacity-70 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-400">
            <span>Real-time updates</span>
            {items.length > 0 && (
              <span>{items.length} total</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
