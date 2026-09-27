import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Search, Building, CheckCheck, Plus, Sparkles } from 'lucide-react';
import type { Profile, Enquiry, ChatMessage, Property } from '../types/database';
import { api, idsEqual } from '../services/api';
import { formatPrice } from './PropertyCard';

interface ChatInboxProps {
  currentUser: Profile | null;
  onOpenAuth: () => void;
  onOpenProperty?: (property: Property) => void;
  activeEnquiryId?: string | null;
}

export const ChatInbox: React.FC<ChatInboxProps> = ({
  currentUser,
  onOpenAuth,
  onOpenProperty,
  activeEnquiryId
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load all user conversations
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
        if (activeEnquiryId) {
          const target = enqs.find(e => e.id === activeEnquiryId);
          if (target) setSelectedEnquiry(target);
          else setSelectedEnquiry(enqs[0]);
        } else {
          setSelectedEnquiry(enqs[0]);
        }
      }
    } catch (err) {
      console.error('[Chat] loadConversations failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(() => {
      if (currentUser) {
        api.getEnquiriesForUser(currentUser.id).then(enqs => {
          setConversations(enqs);
        });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Fetch active conversation messages
  const loadActiveMessages = async () => {
    if (!selectedEnquiry || !currentUser) return;
    try {
      const list = await api.getMessagesForEnquiry(selectedEnquiry.id);
      setMessages(list);
      api.markMessagesAsRead(selectedEnquiry.id, currentUser.id).catch(err =>
        console.error('[Chat] markMessagesAsRead failed:', err)
      );
    } catch (err) {
      console.error('[Chat] loadActiveMessages failed:', err);
    }
  };

  useEffect(() => {
    if (!selectedEnquiry) return;
    loadActiveMessages();
    const timer = setInterval(() => {
      if (!selectedEnquiry || !currentUser) return;
      api.getMessagesForEnquiry(selectedEnquiry.id)
        .then(list => {
          setMessages(prev => {
            if (
              prev.length === list.length &&
              prev[prev.length - 1]?.id === list[list.length - 1]?.id
            ) return prev;
            return list;
          });
        })
        .catch(err => console.error('[Chat] poll getMessagesForEnquiry failed:', err));
    }, 2500);
    return () => clearInterval(timer);
  }, [selectedEnquiry?.id, currentUser?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedEnquiry || !currentUser || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);

    const otherUserId = idsEqual(selectedEnquiry.sender_id, currentUser.id)
      ? (selectedEnquiry.recipient_id || (allUsers.find(u => idsEqual(u.id, selectedEnquiry.recipient_id) || (selectedEnquiry.recipient_email && u.email?.toLowerCase() === selectedEnquiry.recipient_email.toLowerCase()))?.id) || '')
      : (selectedEnquiry.sender_id || selectedEnquiry.recipient_id || '');

    const tempMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      created_at: new Date().toISOString(),
      enquiry_id: selectedEnquiry.id,
      sender_id: currentUser.id,
      receiver_id: otherUserId,
      message: text,
      read: false,
      sender: currentUser
    };

    setMessages(prev => [...prev, tempMsg]);

    try {
      const saved = await api.sendMessage({
        enquiry_id: selectedEnquiry.id,
        receiver_id: otherUserId,
        message: text
      });
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? saved : m));
    } catch (err: any) {
      console.error('[Chat] sendMessage failed:', err);
      // Remove the optimistic message and alert the user so the error is visible
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      alert(`Message failed to send: ${err?.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartNewChat = async (targetUser: Profile) => {
    if (!currentUser) return;
    setShowNewChatModal(false);

    try {
      const savedEnquiry = await api.sendEnquiry({
        recipient_id: targetUser.id,
        name: currentUser.full_name,
        email: currentUser.email,
        phone: currentUser.phone || '',
        message: `Hi ${targetUser.full_name}, I'm interested in chatting directly.`
      });
      setConversations(prev => [savedEnquiry, ...prev.filter(c => c.id !== savedEnquiry.id)]);
      setSelectedEnquiry(savedEnquiry);
    } catch (_e) {
      const syntheticEnquiry: Enquiry = {
        id: `enq-direct-${Date.now()}`,
        created_at: new Date().toISOString(),
        sender_id: currentUser.id,
        recipient_id: targetUser.id,
        name: currentUser.full_name,
        email: currentUser.email,
        phone: currentUser.phone || '',
        message: `Hi ${targetUser.full_name}, I'm interested in chatting directly.`,
        status: 'new',
        sender: currentUser
      };
      setConversations(prev => [syntheticEnquiry, ...prev]);
      setSelectedEnquiry(syntheticEnquiry);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-purple-500/30">
          <MessageCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Instagram-Style Direct Messaging</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Sign in to connect directly with property publishers, verified brokers, builders, and direct buyers in real time.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/30 transition cursor-pointer"
        >
          Sign In to Access Messages
        </button>
      </div>
    );
  }

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const otherName = (idsEqual(c.sender_id, currentUser.id) ? c.name : c.sender?.full_name) || '';
    return otherName.toLowerCase().includes(q) || c.message.toLowerCase().includes(q) || (c.property?.title || '').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] min-h-[550px] bg-white rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden flex flex-col md:flex-row my-4">
      {/* LEFT SIDEBAR: Conversations List (Instagram DM Style) */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50/50 ${selectedEnquiry ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-slate-900 flex items-center gap-1.5">
              <MessageCircle className="w-5 h-5 text-indigo-600" /> Direct Messages
            </span>
          </div>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition cursor-pointer"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-white border-b border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats, brokers & listings..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-100/80 border border-slate-200/80 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-slate-400 animate-pulse">Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <MessageCircle className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold">No direct messages yet</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow"
              >
                Start New Chat
              </button>
            </div>
          ) : (
            filteredConversations.map(c => {
              const isSelected = selectedEnquiry?.id === c.id;
              
              // Helper to resolve clean human-readable name for publisher or buyer
              let otherName = 'Publisher';
              let otherSubtext = '';
              if (!idsEqual(c.sender_id, currentUser.id)) {
                otherName = c.sender?.full_name || c.name || 'Customer';
                otherSubtext = c.email ? `Buyer • ${c.email}` : 'Direct Lead';
              } else {
                const targetProf = allUsers.find(
                  u => idsEqual(u.id, c.recipient_id) || (c.recipient_email && u.email?.toLowerCase() === c.recipient_email.toLowerCase())
                );
                if (targetProf) {
                  otherName = targetProf.full_name;
                  otherSubtext = targetProf.agency_name || `${targetProf.role?.toUpperCase()} • ${targetProf.city || 'Mumbai'}`;
                } else if (c.property?.title) {
                  otherName = `${c.property.title} Publisher`;
                  otherSubtext = 'Property Listing Owner';
                } else if (c.reel?.title) {
                  otherName = `${c.reel.title} Creator`;
                  otherSubtext = 'Video Tour Publisher';
                } else if (c.recipient_id && c.recipient_id !== 'undefined') {
                  const cleanName = c.recipient_id.replace(/^user-/, '').replace(/-/g, ' ');
                  otherName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
                  otherSubtext = 'Verified Listing Owner';
                } else {
                  otherName = 'Verified Property Publisher';
                  otherSubtext = 'Real Estate Professional';
                }
              }

              const avatar = c.sender?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherName}`;
              
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedEnquiry(c)}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition ${
                    isSelected ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-white'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img src={avatar} alt={otherName} className="w-11 h-11 rounded-full object-cover border border-slate-200" />
                    <span className="w-3 h-3 bg-emerald-500 border-2 border-white rounded-full absolute bottom-0 right-0" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-900 truncate">{otherName}</h4>
                      <span className="text-[10px] text-slate-400 font-medium">Just now</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{c.message}</p>
                    {otherSubtext && (
                      <p className="text-[10px] text-indigo-600 font-semibold truncate mt-0.5">{otherSubtext}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT MAIN PANEL: Live Chat Window */}
      <div className={`flex-1 flex-col bg-white ${selectedEnquiry ? 'flex' : 'hidden md:flex'}`}>
        {selectedEnquiry ? (
          (() => {
            let activeChatTitle = 'Publisher';
            let activeChatSubtitle = 'Direct Conversation';
            let activeAvatar = selectedEnquiry.sender?.avatar_url;

            if (!idsEqual(selectedEnquiry.sender_id, currentUser.id)) {
              activeChatTitle = selectedEnquiry.sender?.full_name || selectedEnquiry.name || 'Customer';
              activeChatSubtitle = selectedEnquiry.email ? `Buyer • ${selectedEnquiry.email}` : 'Direct Lead';
              activeAvatar = selectedEnquiry.sender?.avatar_url;
            } else {
              const targetProf = allUsers.find(
                u => idsEqual(u.id, selectedEnquiry.recipient_id) || (selectedEnquiry.recipient_email && u.email?.toLowerCase() === selectedEnquiry.recipient_email.toLowerCase())
              );
              if (targetProf) {
                activeChatTitle = targetProf.full_name;
                activeChatSubtitle = targetProf.agency_name || `${targetProf.role?.toUpperCase()} • ${targetProf.city || 'Mumbai'}`;
                activeAvatar = targetProf.avatar_url;
              } else if (selectedEnquiry.property?.title) {
                activeChatTitle = `${selectedEnquiry.property.title} Publisher`;
                activeChatSubtitle = 'Property Listing Owner';
              } else if (selectedEnquiry.reel?.title) {
                activeChatTitle = `${selectedEnquiry.reel.title} Creator`;
                activeChatSubtitle = 'Video Tour Publisher';
              } else if (selectedEnquiry.recipient_id && selectedEnquiry.recipient_id !== 'undefined') {
                const clean = selectedEnquiry.recipient_id.replace(/^user-/, '').replace(/-/g, ' ');
                activeChatTitle = clean.charAt(0).toUpperCase() + clean.slice(1);
                activeChatSubtitle = 'Verified Listing Owner';
              } else {
                activeChatTitle = 'Verified Property Publisher';
                activeChatSubtitle = 'Real Estate Professional';
              }
            }
            if (!activeAvatar) activeAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChatTitle}`;

            return (
              <>
                {/* Header */}
                <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedEnquiry(null)}
                      className="md:hidden text-xs text-indigo-300 font-bold pr-2"
                    >
                      ← Back
                    </button>
                    <img
                      src={activeAvatar}
                      alt={activeChatTitle}
                      className="w-10 h-10 rounded-full object-cover border-2 border-indigo-400"
                    />
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                        {activeChatTitle}
                        <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-extrabold">Active</span>
                      </h3>
                      <p className="text-[11px] text-indigo-200 leading-tight">{activeChatSubtitle}</p>
                    </div>
                  </div>

              {/* Linked Property or Reel Badge */}
              {selectedEnquiry.property && (
                <div
                  onClick={() => onOpenProperty && onOpenProperty(selectedEnquiry.property!)}
                  className="hidden sm:flex items-center gap-2 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/20 cursor-pointer transition"
                >
                  <Building className="w-4 h-4 text-indigo-400" />
                  <div className="text-left text-xs">
                    <span className="font-bold block truncate max-w-[140px] text-white">{selectedEnquiry.property.title}</span>
                    <span className="text-[10px] text-emerald-300 font-extrabold">
                      {formatPrice(selectedEnquiry.property.price, selectedEnquiry.property.listing_type)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Messages Thread */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
              {/* Initial Enquiry Speech Bubble */}
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-indigo-50 border border-indigo-100 text-slate-800 p-3.5 rounded-2xl rounded-bl-sm text-xs shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                    <span>Initial Request</span>
                  </div>
                  <p className="leading-relaxed">{selectedEnquiry.message}</p>
                </div>
              </div>

              {messages.map(m => {
                const isMine = idsEqual(m.sender_id, currentUser.id);
                return (
                  <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs shadow-sm ${
                      isMine
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                    }`}>
                      <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
                      <div className={`text-[9px] mt-1 text-right flex items-center justify-end gap-1 ${
                        isMine ? 'text-indigo-200' : 'text-slate-400'
                      }`}>
                        <span>Just now</span>
                        {isMine && <CheckCheck className="w-3 h-3 text-emerald-300" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Message direct..."
                className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="p-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl shadow-md hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
              </>
            );
          })()
        ) : (
          /* Empty Active Window Placeholder (Instagram DM Style) */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/40 space-y-4">
            <div className="p-6 bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 rounded-full text-white shadow-2xl shadow-purple-500/30">
              <MessageCircle className="w-12 h-12" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-xl font-black text-slate-900">Your Direct Messages</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Send private messages, negotiate prices, and chat directly with verified brokers, builders, and customers.
              </p>
            </div>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-500/30 transition cursor-pointer"
            >
              Start a Conversation
            </button>
          </div>
        )}
      </div>

      {/* NEW CHAT MODAL */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Start Direct Chat
              </h3>
              <button onClick={() => setShowNewChatModal(false)} className="text-slate-400 font-bold text-sm">✕</button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {allUsers.map(u => (
                <div
                  key={u.id}
                  onClick={() => handleStartNewChat(u)}
                  className="p-3 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-200/60 flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <img src={u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'} alt={u.full_name} className="w-9 h-9 rounded-full object-cover" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{u.full_name}</h4>
                      <p className="text-[10px] text-slate-500">{u.agency_name || `${u.role?.toUpperCase()} • ${u.city || 'Mumbai'}`}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg shadow">Chat</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
