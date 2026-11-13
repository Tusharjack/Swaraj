import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  Search,
  Building,
  CheckCheck,
  Plus,
  X,
  Image as ImageIcon,
  Phone,
  Video,
  Info,
  Heart,
  Smile,
  Mic,
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import type { Profile, Enquiry, ChatMessage, Property } from '../types/database';
import { api, idsEqual } from '../services/api';
import { formatPrice } from './PropertyCard';
import { uploadToCloudinary } from '../lib/cloudinary';

interface ChatInboxProps {
  currentUser: Profile | null;
  onOpenAuth: () => void;
  onOpenProperty?: (property: Property) => void;
  /** Conversation to open immediately (e.g. after tapping "Chat" on a listing). */
  activeEnquiry?: Enquiry | null;
  /** Called once the activeEnquiry has been loaded into the inbox. */
  onActiveEnquiryConsumed?: () => void;
  /** Notifies parent whether an active chat thread is currently open (for hiding mobile bottom bar). */
  onChatSelectedChange?: (isSelected: boolean) => void;
}

export const ChatInbox: React.FC<ChatInboxProps> = ({
  currentUser,
  onOpenAuth,
  onOpenProperty,
  activeEnquiry,
  onActiveEnquiryConsumed,
  onChatSelectedChange
}) => {
  const [conversations, setConversations] = useState<Enquiry[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'properties'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [activeCallModal, setActiveCallModal] = useState<'audio' | 'video' | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadEta, setUploadEta] = useState<number | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [animatedHeartMsgId, setAnimatedHeartMsgId] = useState<string | null>(null);

  const uploadStartRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  // Notify parent component when conversation is selected or deselected
  useEffect(() => {
    onChatSelectedChange?.(selectedEnquiry !== null);
  }, [selectedEnquiry, onChatSelectedChange]);

  const loadConversations = async () => {
    if (!currentUser) return;
    try {
      const [enqs, users] = await Promise.all([
        api.getEnquiriesForUser(currentUser.id),
        api.getAllUsers()
      ]);
      setConversations(enqs);
      setAllUsers(users.filter(u => u.id !== currentUser.id));
      if (enqs.length > 0 && !selectedEnquiry && window.innerWidth >= 768) {
        setSelectedEnquiry(enqs[0]);
      }
    } catch (err) {
      console.error('[Chat] loadConversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
    const iv = setInterval(() => {
      if (currentUser) api.getEnquiriesForUser(currentUser.id).then(setConversations);
    }, 4000);
    return () => clearInterval(iv);
  }, [currentUser]);

  // Open a conversation handed down from elsewhere in the app
  useEffect(() => {
    if (!activeEnquiry) return;
    setConversations(prev =>
      prev.some(c => c.id === activeEnquiry.id) ? prev : [activeEnquiry, ...prev]
    );
    setSelectedEnquiry(activeEnquiry);
    atBottomRef.current = true;
    onActiveEnquiryConsumed?.();
  }, [activeEnquiry?.id]);

  // Load messages for selected enquiry
  useEffect(() => {
    if (!selectedEnquiry || !currentUser) return;
    const load = () =>
      api.getMessagesForEnquiry(selectedEnquiry.id).then(list => {
        setMessages(prev =>
          prev.length === list.length && prev[prev.length - 1]?.id === list[list.length - 1]?.id
            ? prev
            : list
        );
        api.markMessagesAsRead(selectedEnquiry.id, currentUser.id).catch(() => {});
      }).catch(() => {});

    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [selectedEnquiry?.id, currentUser?.id]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const otherUserId = (enq: Enquiry) =>
    idsEqual(enq.sender_id, currentUser?.id)
      ? enq.recipient_id || ''
      : enq.sender_id || enq.recipient_id || '';

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : inputText;
    if ((!rawText.trim() && !attachmentPreview) || !selectedEnquiry || !currentUser || isSending) return;

    const text = attachmentPreview
      ? rawText.trim()
        ? `${rawText.trim()}\n${attachmentPreview}`
        : attachmentPreview
      : rawText.trim();

    setInputText('');
    setAttachmentPreview(null);
    setShowEmojiPicker(false);
    setIsSending(true);
    atBottomRef.current = true;

    const recv = otherUserId(selectedEnquiry);
    const tmp: ChatMessage = {
      id: `tmp-${Date.now()}`,
      created_at: new Date().toISOString(),
      enquiry_id: selectedEnquiry.id,
      sender_id: currentUser.id,
      receiver_id: recv,
      message: text,
      read: false,
      sender: currentUser
    };

    setMessages(prev => [...prev, tmp]);

    try {
      const saved = await api.sendMessage({
        enquiry_id: selectedEnquiry.id,
        receiver_id: recv,
        message: text
      });
      setMessages(prev => prev.map(m => (m.id === tmp.id ? saved : m)));
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tmp.id));
      alert(`Failed to send: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  // Instagram Heart action: tap heart to send instant ❤️
  const handleSendHeart = () => {
    handleSendMessage('❤️');
  };

  // Double tap or click heart to react to a message (Instagram style)
  const handleToggleReaction = (messageId: string) => {
    setReactions(prev => {
      const current = prev[messageId];
      if (current === '❤️') {
        const next = { ...prev };
        delete next[messageId];
        return next;
      }
      return { ...prev, [messageId]: '❤️' };
    });
    setAnimatedHeartMsgId(messageId);
    setTimeout(() => setAnimatedHeartMsgId(null), 900);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be under 10 MB.');
      return;
    }
    setAttachmentUploading(true);
    setUploadProgress(0);
    setUploadEta(null);
    uploadStartRef.current = Date.now();

    try {
      const url = await uploadToCloudinary('properties', file, pct => {
        setUploadProgress(pct);
        const elapsed = (Date.now() - uploadStartRef.current) / 1000;
        if (pct > 5 && elapsed > 0) {
          setUploadEta(Math.max(0, Math.round(elapsed / (pct / 100) - elapsed)));
        }
      });
      setAttachmentPreview(url);
    } catch {
      alert('Image upload failed. Please try again.');
    } finally {
      setAttachmentUploading(false);
      setUploadProgress(0);
      setUploadEta(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStartNewChat = async (targetUser: Profile) => {
    if (!currentUser) return;
    setShowNewChatModal(false);
    try {
      const saved = await api.sendEnquiry({
        recipient_id: targetUser.id,
        name: currentUser.full_name,
        email: currentUser.email,
        phone: currentUser.phone || '',
        message: `Hi ${targetUser.full_name}, I'd like to connect.`
      });
      setConversations(prev => [saved, ...prev.filter(c => c.id !== saved.id)]);
      setSelectedEnquiry(saved);
    } catch {
      const syn: Enquiry = {
        id: `enq-${Date.now()}`,
        created_at: new Date().toISOString(),
        sender_id: currentUser.id,
        recipient_id: targetUser.id,
        name: currentUser.full_name,
        email: currentUser.email,
        phone: currentUser.phone || '',
        message: `Hi ${targetUser.full_name}, I'd like to connect.`,
        status: 'new',
        sender: currentUser
      };
      setConversations(prev => [syn, ...prev]);
      setSelectedEnquiry(syn);
    }
  };

  // Name resolution helpers
  const resolveName = (c: Enquiry): { name: string; sub: string; avatar: string; isOnline: boolean } => {
    if (!idsEqual(c.sender_id, currentUser?.id)) {
      return {
        name: c.sender?.full_name || c.name || 'Customer',
        sub: c.sender?.city ? `${(c.sender.role || '').toUpperCase()} · ${c.sender.city}` : 'Direct Lead',
        avatar:
          c.sender?.avatar_url ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.sender?.full_name || 'Customer'}`,
        isOnline: true
      };
    }
    const tp = allUsers.find(u => idsEqual(u.id, c.recipient_id));
    if (tp) {
      return {
        name: tp.full_name,
        sub: tp.agency_name || `${(tp.role || '').toUpperCase()} · ${tp.city || 'Mumbai'}`,
        avatar:
          tp.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tp.email}`,
        isOnline: true
      };
    }
    if (c.property?.owner?.full_name) {
      return {
        name: c.property.owner.full_name,
        sub: c.property.title,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.property.owner.full_name}`,
        isOnline: false
      };
    }
    return {
      name: 'Property Publisher',
      sub: 'You contacted',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=publisher`,
      isOnline: false
    };
  };

  const isImageUrl = (s: string) =>
    s.startsWith('https://') &&
    (s.includes('cloudinary.com') || /\.(jpg|jpeg|png|gif|webp)/i.test(s));

  const parseMsg = (msg: string) => {
    const parts = msg.split('\n');
    const imgUrl = parts.find(p => isImageUrl(p.trim())) ?? (isImageUrl(msg.trim()) ? msg.trim() : undefined);
    const caption = imgUrl ? parts.filter(p => p.trim() !== imgUrl.trim()).join('\n').trim() : msg;
    return { imgUrl, caption };
  };

  if (!currentUser) {
    return (
      <div className="max-w-sm mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-gradient-to-tr from-[#7138E8] to-[#9254f8] rounded-full flex items-center justify-center mx-auto text-white shadow-lg">
          <MessageCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Direct Messages</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Sign in to chat with brokers, buyers, and sellers with Instagram-style instant messaging.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-3 bg-gradient-to-r from-[#7138E8] to-[#9254f8] text-white font-bold text-sm rounded-2xl shadow-md w-full active:scale-95 transition"
        >
          Sign In
        </button>
      </div>
    );
  }

  const filteredConversations = conversations.filter(c => {
    if (inboxFilter === 'properties' && !c.property) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const { name } = resolveName(c);
    return (
      name.toLowerCase().includes(q) ||
      c.message.toLowerCase().includes(q) ||
      (c.property?.title || '').toLowerCase().includes(q)
    );
  });

  // Real estate quick suggestions
  const quickReplies = [
    { label: '📅 Book Site Visit', text: 'Hi! Can we schedule a site visit this weekend?' },
    { label: '💰 Best Price?', text: 'Hi! Is the price slightly negotiable for ready buyers?' },
    { label: '📄 Send Brochure', text: 'Could you please share the floor plan and brochure?' },
    { label: '📍 Exact Location', text: 'Can you please share the exact Google Maps location?' },
    { label: '📞 Request Call', text: 'I am interested in this listing. Please call me at your earliest.' }
  ];

  const popularEmojis = ['❤️', '👍', '🔥', '😊', '🏠', '📍', '🔑', '✨', '👏', '🙏', '💯', '🤝'];

  return (
    <div
      className="
        w-full h-full flex flex-col md:flex-row
        bg-white sm:rounded-3xl sm:border sm:border-slate-200/80 sm:shadow-xl
        overflow-hidden max-w-6xl mx-auto sm:my-3
      "
      style={{
        // On mobile, take full viewport height minus top navbar; on desktop, pleasant container height
        height: 'calc(100dvh - 4.5rem)',
        maxHeight: '100dvh'
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════════════
          LEFT COLUMN: INSTAGRAM-STYLE CONVERSATION INBOX
          Hidden on mobile when a chat is selected; visible on desktop always.
         ═══════════════════════════════════════════════════════════════════════════ */}
      <div
        className={`
          w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-100 bg-white
          ${selectedEnquiry ? 'hidden md:flex' : 'flex'}
          h-full min-h-0
        `}
      >
        {/* Header */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg text-slate-900 tracking-tight">Messages</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600">
              {conversations.length}
            </span>
          </div>
          <button
            onClick={() => setShowNewChatModal(true)}
            aria-label="New Message"
            className="w-8 h-8 bg-gradient-to-tr from-[#7138E8] to-[#9254f8] text-white rounded-full flex items-center justify-center hover:opacity-90 active:scale-95 transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-slate-50 bg-slate-50/50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search messages or listings…"
              className="w-full pl-9 pr-3 py-2 bg-white rounded-full text-xs text-slate-800 placeholder-slate-400 border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-[#7138E8]/20 transition"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={() => setInboxFilter('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                inboxFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setInboxFilter('properties')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                inboxFilter === 'properties'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Building className="w-3 h-3" />
              Properties
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 pb-16 md:pb-0">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3.5 p-4 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-100 rounded-full w-1/2" />
                  <div className="h-2.5 bg-slate-50 rounded-full w-3/4" />
                </div>
              </div>
            ))
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-3">
              <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 shadow-inner">
                <MessageCircle className="w-7 h-7" />
              </div>
              <p className="font-extrabold text-slate-800 text-sm">
                {searchQuery ? 'No matching conversations' : 'No messages yet'}
              </p>
              <p className="text-xs text-slate-400 max-w-[200px]">
                {searchQuery ? 'Try a different name or search term.' : 'Connect directly with buyers, brokers, or sellers.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="px-5 py-2 bg-gradient-to-r from-[#7138E8] to-[#9254f8] text-white text-xs font-bold rounded-2xl shadow-sm hover:opacity-95 transition cursor-pointer"
                >
                  Start a Chat
                </button>
              )}
            </div>
          ) : (
            filteredConversations.map(c => {
              const isSelected = selectedEnquiry?.id === c.id;
              const { name, sub, avatar, isOnline } = resolveName(c);
              const lastIsImg = isImageUrl(c.message.trim());

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedEnquiry(c)}
                  className={`w-full text-left flex items-center gap-3.5 px-4 py-3.5 transition cursor-pointer select-none ${
                    isSelected ? 'bg-indigo-50/70 border-r-2 border-[#7138E8]' : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Avatar + Online Dot */}
                  <div className="relative shrink-0">
                    <img
                      src={avatar}
                      alt={name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200/80 shadow-xs"
                    />
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white" />
                    )}
                  </div>

                  {/* Text details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm font-extrabold truncate ${isSelected ? 'text-[#7138E8]' : 'text-slate-900'}`}>
                        {name}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 ml-2 shrink-0">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 truncate leading-snug">
                      {lastIsImg ? '📷 Photo' : c.message}
                    </p>

                    {c.property && (
                      <p className="text-[10px] font-semibold text-indigo-600 truncate mt-0.5 flex items-center gap-1">
                        <Building className="w-2.5 h-2.5 shrink-0" />
                        <span>{c.property.title}</span>
                      </p>
                    )}
                    {!c.property && sub && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{sub}</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          RIGHT COLUMN: INSTAGRAM-STYLE ACTIVE CHAT THREAD
          Occupies 100% full screen on mobile when conversation is selected!
         ═══════════════════════════════════════════════════════════════════════════ */}
      <div
        className={`
          flex-1 flex flex-col min-w-0 bg-white h-full min-h-0
          ${selectedEnquiry ? 'flex' : 'hidden md:flex'}
        `}
      >
        {selectedEnquiry ? (
          (() => {
            const { name: chatName, sub: chatSub, avatar: chatAvatar } = resolveName(selectedEnquiry);

            return (
              <div className="flex-1 flex flex-col h-full min-h-0 relative">
                {/* ── Top Header (Instagram DM style) ── */}
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md z-30 shrink-0 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Back button (returns to conversation list on mobile) */}
                    <button
                      onClick={() => setSelectedEnquiry(null)}
                      className="md:hidden p-1.5 -ml-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition cursor-pointer"
                      aria-label="Back to messages"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>

                    {/* Contact Avatar + Online dot */}
                    <div className="relative shrink-0">
                      <img
                        src={chatAvatar}
                        alt={chatName}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200/80 shadow-xs"
                      />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
                    </div>

                    {/* Name + Status */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-extrabold text-sm sm:text-base text-slate-900 truncate leading-tight">
                          {chatName}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate leading-none mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-emerald-600 font-semibold">Active now</span>
                        {chatSub && (
                          <span className="text-slate-400 hidden sm:inline">· {chatSub}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Header Actions (Call / Video / Info) */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Audio Call */}
                    <button
                      onClick={() => setActiveCallModal('audio')}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                      title="Audio Call"
                    >
                      <Phone className="w-4.5 h-4.5" />
                    </button>

                    {/* Video Call */}
                    <button
                      onClick={() => setActiveCallModal('video')}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                      title="Video Call"
                    >
                      <Video className="w-4.5 h-4.5" />
                    </button>

                    {/* Info / Property button */}
                    <button
                      onClick={() => {
                        if (selectedEnquiry.property && onOpenProperty) {
                          onOpenProperty(selectedEnquiry.property);
                        } else {
                          setShowInfoModal(true);
                        }
                      }}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                      title="Details & Property"
                    >
                      <Info className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>

                {/* ── Optional Pinned Property Banner ── */}
                {selectedEnquiry.property && (
                  <div
                    onClick={() => onOpenProperty?.(selectedEnquiry.property!)}
                    className="px-3 py-1.5 bg-indigo-50/70 border-b border-indigo-100/70 flex items-center justify-between gap-2 cursor-pointer hover:bg-indigo-50 transition shrink-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="text-xs font-extrabold text-indigo-900 truncate">
                        {selectedEnquiry.property.title}
                      </span>
                      <span className="text-[11px] font-black text-indigo-700 shrink-0 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                        {formatPrice(selectedEnquiry.property.price, selectedEnquiry.property.listing_type)}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 hover:underline shrink-0">
                      View Listing →
                    </span>
                  </div>
                )}

                {/* ── Messages Stream (Instagram bubble style) ── */}
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-1.5 bg-slate-50/50"
                >
                  {/* Chat Beginning Profile Badge */}
                  <div className="py-6 text-center space-y-2">
                    <img
                      src={chatAvatar}
                      alt={chatName}
                      className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-white shadow-md"
                    />
                    <div>
                      <p className="font-extrabold text-sm text-slate-900">{chatName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{chatSub || 'IndoProperty User'}</p>
                    </div>
                    {selectedEnquiry.property && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200/80 rounded-full text-xs text-slate-700 font-semibold shadow-xs">
                        <Building className="w-3 h-3 text-indigo-600" />
                        <span>Enquiry regarding {selectedEnquiry.property.title}</span>
                      </div>
                    )}
                  </div>

                  {messages.length === 0 && (
                    <div className="py-8 text-center space-y-2">
                      <p className="text-xs text-slate-400 font-medium">No messages yet in this conversation</p>
                      <p className="text-xs font-bold text-indigo-600">Send a message or wave hello 👋</p>
                    </div>
                  )}

                  {/* Messages Mapping */}
                  {messages.map((m, idx) => {
                    const mine = idsEqual(m.sender_id, currentUser.id);
                    const { imgUrl, caption } = parseMsg(m.message);

                    // Instagram grouping logic:
                    // Check if next message is from same sender within 5 minutes
                    const nextMsg = messages[idx + 1];
                    const isLastInGroup =
                      !nextMsg ||
                      !idsEqual(nextMsg.sender_id, m.sender_id) ||
                      Math.abs(new Date(nextMsg.created_at).getTime() - new Date(m.created_at).getTime()) > 300000;

                    const reaction = reactions[m.id];
                    const isHeartAnimating = animatedHeartMsgId === m.id;

                    return (
                      <div
                        key={m.id}
                        onDoubleClick={() => handleToggleReaction(m.id)}
                        className={`group flex items-end gap-2 relative ${mine ? 'justify-end' : 'justify-start'} ${
                          isLastInGroup ? 'mb-2.5' : 'mb-0.5'
                        }`}
                      >
                        {/* Received message avatar: ONLY shown on the last message in a cluster */}
                        {!mine && (
                          <div className="w-7 h-7 shrink-0 mb-0.5">
                            {isLastInGroup ? (
                              <img
                                src={chatAvatar}
                                alt=""
                                className="w-7 h-7 rounded-full object-cover border border-slate-200/80 shadow-xs"
                              />
                            ) : (
                              <div className="w-7 h-7" />
                            )}
                          </div>
                        )}

                        {/* Speech Bubble */}
                        <div className="relative max-w-[78%] sm:max-w-[70%]">
                          <div
                            className={`
                              overflow-hidden transition-all shadow-xs select-text
                              ${
                                mine
                                  ? `bg-gradient-to-tr from-[#7138E8] to-[#9254f8] text-white ${
                                      isLastInGroup ? 'rounded-[20px] rounded-br-[4px]' : 'rounded-[20px] rounded-br-[18px]'
                                    }`
                                  : `bg-[#F0F2F5] text-slate-900 border border-slate-200/40 ${
                                      isLastInGroup ? 'rounded-[20px] rounded-bl-[4px]' : 'rounded-[20px] rounded-bl-[18px]'
                                    }`
                              }
                            `}
                          >
                            {/* Media image preview */}
                            {imgUrl && (
                              <div className="relative cursor-pointer overflow-hidden" onClick={() => window.open(imgUrl, '_blank')}>
                                <img
                                  src={imgUrl}
                                  alt="Shared"
                                  className="w-full max-w-[280px] sm:max-w-[320px] max-h-[340px] object-cover hover:opacity-95 transition"
                                  onError={e => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}

                            {/* Text / Caption */}
                            {(caption || !imgUrl) && (
                              <div className="px-3.5 py-2">
                                <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap font-normal break-words">
                                  {imgUrl ? caption : m.message}
                                </p>
                              </div>
                            )}

                            {/* Timestamp + checkmarks */}
                            <div
                              className={`px-3 pb-1.5 text-[10px] flex items-center gap-1 ${
                                mine ? 'justify-end text-white/70' : 'justify-end text-slate-400'
                              }`}
                            >
                              <span>
                                {new Date(m.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {mine && <CheckCheck className="w-3 h-3 text-white/90" />}
                            </div>
                          </div>

                          {/* Heart reaction badge attached to bubble (Instagram style) */}
                          {reaction && (
                            <div
                              onClick={() => handleToggleReaction(m.id)}
                              className={`
                                absolute -bottom-2 ${mine ? 'left-2' : 'right-2'}
                                bg-white border border-slate-200/80 rounded-full px-1.5 py-0.5
                                shadow-sm flex items-center justify-center text-[12px] cursor-pointer hover:scale-110 transition
                              `}
                            >
                              <span>{reaction}</span>
                            </div>
                          )}

                          {/* Animated floating heart on double-tap */}
                          {isHeartAnimating && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-out duration-700">
                              <Heart className="w-12 h-12 text-rose-500 fill-rose-500 drop-shadow-lg animate-ping" />
                            </div>
                          )}

                          {/* Hover action bar to react (desktop) */}
                          <button
                            onClick={() => handleToggleReaction(m.id)}
                            className={`
                              hidden group-hover:flex absolute -top-3 ${mine ? '-left-6' : '-right-6'}
                              w-6 h-6 rounded-full bg-white border border-slate-200 shadow-xs
                              items-center justify-center text-slate-400 hover:text-rose-500 hover:scale-110 transition cursor-pointer
                            `}
                            title="React with heart"
                          >
                            <Heart className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Quick Action Suggestion Chips ── */}
                <div className="px-3 py-1.5 bg-white/95 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#7138E8]" /> Quick:
                  </span>
                  {quickReplies.map((qr, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendMessage(qr.text)}
                      className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 transition cursor-pointer shrink-0 border border-slate-200/60 active:scale-95"
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>

                {/* ── Attachment Preview / Upload Progress ── */}
                {attachmentPreview && (
                  <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-3 shrink-0">
                    <div className="relative">
                      <img
                        src={attachmentPreview}
                        alt="Preview"
                        className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-xs"
                      />
                      <button
                        onClick={() => setAttachmentPreview(null)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-xs hover:scale-105 cursor-pointer"
                        title="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-800">Photo attached</p>
                      <p className="text-[11px] text-slate-400">Add a message or tap send</p>
                    </div>
                  </div>
                )}

                {attachmentUploading && (
                  <div className="px-3 py-2 bg-indigo-50/50 border-t border-indigo-100 shrink-0 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#7138E8] font-bold flex items-center gap-1.5">
                        <span className="w-3 h-3 border-2 border-[#7138E8]/30 border-t-[#7138E8] rounded-full animate-spin inline-block" />
                        Uploading photo…
                      </span>
                      <span className="font-extrabold text-slate-700">
                        {uploadProgress}%
                        {uploadEta !== null && (
                          <span className="text-slate-400 font-normal"> · ~{uploadEta}s</span>
                        )}
                      </span>
                    </div>
                    <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#7138E8] to-[#9254f8] rounded-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* ── Emoji Picker Popover ── */}
                {showEmojiPicker && (
                  <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 shadow-inner">
                    {popularEmojis.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setInputText(prev => prev + emoji)}
                        className="text-lg hover:scale-125 active:scale-95 transition p-1 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* ════════════════════════════════════════════════════════════════
                    INSTAGRAM-STYLE PINNED BOTTOM INPUT BAR
                    Guaranteed to stay pinned at the bottom and never cut off!
                   ════════════════════════════════════════════════════════════════ */}
                <div
                  className="
                    sticky bottom-0 inset-x-0 z-30 bg-white border-t border-slate-100/90
                    px-2.5 sm:px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]
                    shrink-0 shadow-lg sm:shadow-none
                  "
                >
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex items-center gap-1.5 sm:gap-2"
                  >
                    {/* Hidden file picker */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />

                    {/* Camera / Image Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={attachmentUploading}
                      className="w-9 h-9 flex items-center justify-center rounded-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition disabled:opacity-40 shrink-0 cursor-pointer"
                      title="Send photo"
                    >
                      <ImageIcon className="w-4.5 h-4.5" />
                    </button>

                    {/* Pill Input Container */}
                    <div className="flex-1 flex items-center bg-[#F0F2F5] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#7138E8]/25 border border-transparent focus-within:border-[#7138E8]/30 rounded-full px-3 py-1.5 transition">
                      <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder={attachmentPreview ? 'Add a caption…' : 'Message…'}
                        className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none min-w-0"
                      />

                      {/* Emoji toggle button */}
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(p => !p)}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer shrink-0"
                        title="Emojis"
                      >
                        <Smile className="w-4.5 h-4.5" />
                      </button>
                    </div>

                    {/* Dynamic Action: Heart/Mic when empty, Send button when text is entered! */}
                    {inputText.trim() || attachmentPreview ? (
                      <button
                        type="submit"
                        disabled={isSending || attachmentUploading}
                        className="px-4 h-9 flex items-center justify-center bg-gradient-to-r from-[#7138E8] to-[#9254f8] text-white rounded-full text-xs font-bold shadow-md hover:opacity-95 active:scale-95 transition disabled:opacity-40 shrink-0 cursor-pointer"
                      >
                        {isSending ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <span>Send</span>
                            <Send className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {/* Voice note memo button */}
                        <button
                          type="button"
                          onClick={() => handleSendMessage('🎤 [Voice Message 0:08]')}
                          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                          title="Record voice note"
                        >
                          <Mic className="w-4.5 h-4.5" />
                        </button>

                        {/* Instagram Heart Button: 1-tap instant heart! */}
                        <button
                          type="button"
                          onClick={handleSendHeart}
                          className="w-9 h-9 flex items-center justify-center rounded-full text-rose-500 hover:scale-115 active:scale-90 transition cursor-pointer"
                          title="Send Heart ❤️"
                        >
                          <Heart className="w-5 h-5 fill-rose-500" />
                        </button>
                      </div>
                    )}
                  </form>
                </div>

                {/* ── Simulated Call Modal (Audio/Video) ── */}
                {activeCallModal && (
                  <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-8 max-w-xs w-full text-center space-y-6 shadow-2xl">
                      <div className="relative mx-auto w-24 h-24">
                        <img
                          src={chatAvatar}
                          alt={chatName}
                          className="w-24 h-24 rounded-full object-cover ring-4 ring-[#7138E8]/40 shadow-xl"
                        />
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-ping" />
                      </div>

                      <div>
                        <h3 className="text-lg font-black">{chatName}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {activeCallModal === 'audio' ? 'Connecting Audio Call…' : 'Connecting Video Call…'}
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-4">
                        <button
                          onClick={() => setActiveCallModal(null)}
                          className="w-14 h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
                          title="End Call"
                        >
                          <Phone className="w-6 h-6 rotate-[135deg]" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Info Modal ── */}
                {showInfoModal && (
                  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-base text-slate-900">Contact Details</h3>
                        <button
                          onClick={() => setShowInfoModal(false)}
                          className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-center space-y-2 py-2">
                        <img
                          src={chatAvatar}
                          alt={chatName}
                          className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-indigo-100"
                        />
                        <p className="font-black text-slate-900 text-base">{chatName}</p>
                        <p className="text-xs text-slate-500">{chatSub}</p>
                      </div>
                      {selectedEnquiry.phone && (
                        <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
                          <span className="text-slate-400 font-bold block">Phone Number</span>
                          <span className="font-extrabold text-slate-800">{selectedEnquiry.phone}</span>
                        </div>
                      )}
                      {selectedEnquiry.email && (
                        <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
                          <span className="text-slate-400 font-bold block">Email</span>
                          <span className="font-extrabold text-slate-800">{selectedEnquiry.email}</span>
                        </div>
                      )}
                      <button
                        onClick={() => setShowInfoModal(false)}
                        className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          /* Desktop Placeholder when no chat is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-slate-50/30">
            <div className="w-20 h-20 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shadow-inner">
              <MessageCircle className="w-10 h-10" />
            </div>
            <div>
              <p className="font-extrabold text-slate-800 text-base">Your Messages</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                Select a conversation on the left or start a new chat with buyers and brokers.
              </p>
            </div>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="px-6 py-2.5 bg-gradient-to-r from-[#7138E8] to-[#9254f8] text-white font-bold text-xs rounded-2xl shadow-md hover:opacity-95 active:scale-95 transition cursor-pointer"
            >
              New Message
            </button>
          </div>
        )}
      </div>

      {/* ── New Chat Modal ── */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <span className="font-extrabold text-base text-slate-900">New Message</span>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/70 text-slate-600 text-sm hover:bg-slate-200 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-1">
              {allUsers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No other users available to message
                </div>
              ) : (
                allUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleStartNewChat(u)}
                    className="w-full text-left flex items-center gap-3.5 px-4 py-3 hover:bg-indigo-50/50 rounded-2xl transition cursor-pointer"
                  >
                    <img
                      src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`}
                      alt={u.full_name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-900 truncate">{u.full_name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {u.agency_name || `${(u.role || '').toUpperCase()} · ${u.city || 'Mumbai'}`}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
