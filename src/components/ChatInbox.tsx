import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Search, Building, CheckCheck, Plus, X, Image } from 'lucide-react';
import type { Profile, Enquiry, ChatMessage, Property } from '../types/database';
import { api, idsEqual } from '../services/api';
import { formatPrice } from './PropertyCard';
import { uploadToCloudinary } from '../lib/cloudinary';

interface ChatInboxProps {
  currentUser: Profile | null;
  onOpenAuth: () => void;
  onOpenProperty?: (property: Property) => void;
  activeEnquiryId?: string | null;
}

export const ChatInbox: React.FC<ChatInboxProps> = ({
  currentUser, onOpenAuth, onOpenProperty, activeEnquiryId
}) => {
  const [conversations, setConversations] = useState<Enquiry[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadEta, setUploadEta] = useState<number | null>(null);
  const uploadStartRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    if (!currentUser) return;
    try {
      const [enqs, users] = await Promise.all([
        api.getEnquiriesForUser(currentUser.id),
        api.getAllUsers()
      ]);
      setConversations(enqs);
      setAllUsers(users.filter(u => u.id !== currentUser.id));
      if (enqs.length > 0 && !selectedEnquiry) {
        const target = activeEnquiryId ? enqs.find(e => e.id === activeEnquiryId) : null;
        setSelectedEnquiry(target ?? enqs[0]);
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

  useEffect(() => {
    if (!selectedEnquiry || !currentUser) return;
    const load = () => api.getMessagesForEnquiry(selectedEnquiry.id).then(list => {
      setMessages(prev => (prev.length === list.length && prev[prev.length-1]?.id === list[list.length-1]?.id) ? prev : list);
      api.markMessagesAsRead(selectedEnquiry.id, currentUser.id).catch(() => {});
    }).catch(() => {});
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [selectedEnquiry?.id, currentUser?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const otherUserId = (enq: Enquiry) => idsEqual(enq.sender_id, currentUser?.id)
    ? (enq.recipient_id || '')
    : (enq.sender_id || enq.recipient_id || '');

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !attachmentPreview) || !selectedEnquiry || !currentUser || isSending) return;
    const text = attachmentPreview
      ? (inputText.trim() ? `${inputText.trim()}\n${attachmentPreview}` : attachmentPreview)
      : inputText.trim();
    setInputText(''); setAttachmentPreview(null); setIsSending(true);
    const recv = otherUserId(selectedEnquiry);
    const tmp: ChatMessage = {
      id: `tmp-${Date.now()}`, created_at: new Date().toISOString(),
      enquiry_id: selectedEnquiry.id, sender_id: currentUser.id,
      receiver_id: recv, message: text, read: false, sender: currentUser
    };
    setMessages(prev => [...prev, tmp]);
    try {
      const saved = await api.sendMessage({ enquiry_id: selectedEnquiry.id, receiver_id: recv, message: text });
      setMessages(prev => prev.map(m => m.id === tmp.id ? saved : m));
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tmp.id));
      alert(`Failed to send: ${err?.message || 'Unknown error'}`);
    } finally { setIsSending(false); }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10 MB.'); return; }
    setAttachmentUploading(true); setUploadProgress(0); setUploadEta(null);
    uploadStartRef.current = Date.now();
    try {
      const url = await uploadToCloudinary('properties', file, (pct) => {
        setUploadProgress(pct);
        const elapsed = (Date.now() - uploadStartRef.current) / 1000;
        if (pct > 5 && elapsed > 0) setUploadEta(Math.max(0, Math.round(elapsed / (pct / 100) - elapsed)));
      });
      setAttachmentPreview(url);
    } catch { alert('Image upload failed. Please try again.'); }
    finally { setAttachmentUploading(false); setUploadProgress(0); setUploadEta(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleStartNewChat = async (targetUser: Profile) => {
    if (!currentUser) return;
    setShowNewChatModal(false);
    try {
      const saved = await api.sendEnquiry({
        recipient_id: targetUser.id, name: currentUser.full_name,
        email: currentUser.email, phone: currentUser.phone || '',
        message: `Hi ${targetUser.full_name}, I'd like to connect.`
      });
      setConversations(prev => [saved, ...prev.filter(c => c.id !== saved.id)]);
      setSelectedEnquiry(saved);
    } catch {
      const syn: Enquiry = {
        id: `enq-${Date.now()}`, created_at: new Date().toISOString(),
        sender_id: currentUser.id, recipient_id: targetUser.id,
        name: currentUser.full_name, email: currentUser.email, phone: currentUser.phone || '',
        message: `Hi ${targetUser.full_name}, I'd like to connect.`, status: 'new', sender: currentUser
      };
      setConversations(prev => [syn, ...prev]); setSelectedEnquiry(syn);
    }
  };

  // Name resolution helpers
  const resolveName = (c: Enquiry): { name: string; sub: string; avatar: string } => {
    if (!idsEqual(c.sender_id, currentUser?.id)) {
      return {
        name: c.sender?.full_name || c.name || 'Customer',
        sub: c.sender?.city ? `${(c.sender.role||'').toUpperCase()} · ${c.sender.city}` : 'Direct Lead',
        avatar: c.sender?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.sender?.full_name}`
      };
    }
    const tp = allUsers.find(u => idsEqual(u.id, c.recipient_id));
    if (tp) return { name: tp.full_name, sub: tp.agency_name || `${(tp.role||'').toUpperCase()} · ${tp.city||'Mumbai'}`, avatar: tp.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tp.email}` };
    if (c.property?.owner?.full_name) return { name: c.property.owner.full_name, sub: c.property.title, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.property.owner.full_name}` };
    return { name: 'Property Publisher', sub: 'You contacted', avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=publisher` };
  };

  const isImageUrl = (s: string) => s.startsWith('https://') && (s.includes('cloudinary.com') || /\.(jpg|jpeg|png|gif|webp)/i.test(s));

  const parseMsg = (msg: string) => {
    const parts = msg.split('\n');
    const imgUrl = parts.find(p => isImageUrl(p.trim())) ?? (isImageUrl(msg.trim()) ? msg.trim() : undefined);
    const caption = imgUrl ? parts.filter(p => p.trim() !== imgUrl.trim()).join('\n').trim() : msg;
    return { imgUrl, caption };
  };

  if (!currentUser) {
    return (
      <div className="max-w-sm mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-[#7138E8] rounded-full flex items-center justify-center mx-auto text-white shadow-lg">
          <MessageCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-black text-slate-900">Direct Messages</h2>
        <p className="text-xs text-slate-500">Sign in to chat with brokers, buyers and sellers.</p>
        <button onClick={onOpenAuth} className="px-6 py-3 bg-[#7138E8] text-white font-bold text-sm rounded-2xl shadow-md w-full">Sign In</button>
      </div>
    );
  }

  const filtered = conversations.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const { name } = resolveName(c);
    return name.toLowerCase().includes(q) || c.message.toLowerCase().includes(q) || (c.property?.title||'').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex flex-col md:flex-row my-4"
      style={{ height: 'calc(100dvh - 140px)', minHeight: 520 }}>

      {/* ─── LEFT: conversation list ─── */}
      <div className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-100 ${selectedEnquiry ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100">
          <span className="font-black text-lg text-slate-900">Messages</span>
          <button onClick={() => setShowNewChatModal(true)}
            className="w-8 h-8 bg-[#7138E8] text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition shadow">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {/* Search */}
        <div className="px-3 py-2.5 border-b border-slate-50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
              className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-[#7138E8]/20" />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {isLoading ? (
            Array.from({length:3}).map((_,i) => (
              <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2"><div className="h-3 bg-slate-100 rounded-full w-1/2" /><div className="h-2.5 bg-slate-50 rounded-full w-3/4" /></div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center px-6">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-slate-300" />
              </div>
              <p className="font-bold text-slate-500 text-sm">{searchQuery ? 'No results' : 'No messages yet'}</p>
              {!searchQuery && <button onClick={() => setShowNewChatModal(true)} className="px-4 py-2 bg-[#7138E8] text-white text-xs font-bold rounded-2xl shadow-md">Start a Chat</button>}
            </div>
          ) : filtered.map(c => {
            const isSelected = selectedEnquiry?.id === c.id;
            const { name, sub, avatar } = resolveName(c);
            const lastIsImg = isImageUrl(c.message.trim());
            return (
              <button key={c.id} onClick={() => setSelectedEnquiry(c)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3.5 transition ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                <div className="relative shrink-0">
                  <img src={avatar} alt={name} className="w-12 h-12 rounded-full object-cover border border-slate-100" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-sm font-bold truncate ${isSelected ? 'text-[#7138E8]' : 'text-slate-900'}`}>{name}</span>
                    <span className="text-[10px] text-slate-400 ml-2 shrink-0">now</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{lastIsImg ? '📷 Photo' : c.message}</p>
                  {sub && <p className="text-[10px] text-slate-400 truncate mt-0.5">{sub}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── RIGHT: chat panel ─── */}
      <div className={`flex-1 flex-col min-w-0 ${selectedEnquiry ? 'flex' : 'hidden md:flex'}`}>
        {selectedEnquiry ? (() => {
          const { name: chatName, sub: chatSub, avatar: chatAvatar } = resolveName(selectedEnquiry);
          return (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-white">
                <button onClick={() => setSelectedEnquiry(null)} className="md:hidden p-1.5 text-slate-400 -ml-1 text-lg">←</button>
                <img src={chatAvatar} alt={chatName} className="w-10 h-10 rounded-full object-cover border border-slate-100 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{chatName}</p>
                  {chatSub && <p className="text-[11px] text-slate-400 truncate">{chatSub}</p>}
                </div>
                {selectedEnquiry.property && (
                  <button onClick={() => onOpenProperty && onOpenProperty(selectedEnquiry.property!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 font-semibold shrink-0">
                    <Building className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline max-w-[100px] truncate">{selectedEnquiry.property.title}</span>
                    <span className="text-[11px] font-black text-indigo-600 hidden sm:inline">{formatPrice(selectedEnquiry.property.price, selectedEnquiry.property.listing_type)}</span>
                  </button>
                )}
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50/40">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-xs font-semibold text-slate-400">No messages yet</p>
                    <p className="text-[11px] text-slate-400">Say hello 👋</p>
                  </div>
                )}
                {messages.map(m => {
                  const mine = idsEqual(m.sender_id, currentUser.id);
                  const { imgUrl, caption } = parseMsg(m.message);
                  return (
                    <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                      {!mine && <img src={chatAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mb-1 border border-slate-100" />}
                      <div className={`max-w-[72%] rounded-2xl overflow-hidden shadow-sm ${mine ? 'bg-[#7138E8] text-white rounded-br-sm' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm'}`}>
                        {imgUrl && (
                          <img src={imgUrl} alt="photo" className="w-full max-w-[240px] object-cover cursor-pointer"
                            onClick={() => window.open(imgUrl, '_blank')}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        {(caption || !imgUrl) && (
                          <div className="px-3.5 py-2.5">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{imgUrl ? caption : m.message}</p>
                          </div>
                        )}
                        <div className={`px-3.5 pb-2 text-[10px] flex items-center gap-1 ${mine ? 'justify-end text-white/60' : 'text-slate-400'}`}>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {mine && <CheckCheck className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="border-t border-slate-100 bg-white px-3 pt-2 pb-3 space-y-2">
                {attachmentPreview && (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <img src={attachmentPreview} alt="" className="w-14 h-14 rounded-2xl object-cover border border-slate-200" />
                      <button onClick={() => setAttachmentPreview(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">Photo ready to send</p>
                  </div>
                )}
                {attachmentUploading && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#7138E8] font-semibold flex items-center gap-1.5">
                        <span className="w-3 h-3 border-2 border-[#7138E8]/30 border-t-[#7138E8] rounded-full animate-spin inline-block" /> Uploading…
                      </span>
                      <span className="font-bold text-slate-600">{uploadProgress}%{uploadEta !== null && <span className="text-slate-400 font-normal"> · ~{uploadEta < 60 ? `${uploadEta}s` : `${Math.ceil(uploadEta/60)}m`}</span>}</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#7138E8] rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={attachmentUploading}
                    className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition disabled:opacity-40 shrink-0">
                    <Image className="w-4 h-4" />
                  </button>
                  <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder={attachmentPreview ? 'Add a caption…' : 'Message…'}
                    className="flex-1 px-4 py-2.5 bg-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#7138E8]/20" />
                  <button type="submit" disabled={(!inputText.trim() && !attachmentPreview) || isSending || attachmentUploading}
                    className="w-9 h-9 flex items-center justify-center bg-[#7138E8] text-white rounded-full shadow-md disabled:opacity-40 hover:bg-indigo-700 transition shrink-0">
                    {isSending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </div>
            </>
          );
        })() : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
              <MessageCircle className="w-10 h-10 text-slate-300" />
            </div>
            <div>
              <p className="font-bold text-slate-700">Your messages</p>
              <p className="text-xs text-slate-400 mt-1">Select a conversation or start a new one</p>
            </div>
            <button onClick={() => setShowNewChatModal(true)}
              className="px-5 py-2.5 bg-[#7138E8] text-white font-bold text-sm rounded-2xl shadow-md hover:bg-indigo-700 transition">
              New Message
            </button>
          </div>
        )}
      </div>

      {/* New chat modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <span className="font-black text-base text-slate-900">New Message</span>
              <button onClick={() => setShowNewChatModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-sm">✕</button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
              {allUsers.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No users available</p>
              ) : allUsers.map(u => (
                <button key={u.id} onClick={() => handleStartNewChat(u)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition">
                  <img src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`}
                    alt={u.full_name} className="w-10 h-10 rounded-full object-cover border border-slate-100 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{u.full_name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{u.agency_name || `${(u.role||'').toUpperCase()} · ${u.city || 'Mumbai'}`}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
