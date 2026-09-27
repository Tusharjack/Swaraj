import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, UserCircle2 } from 'lucide-react';
import { api, idsEqual } from '../services/api';
import type { Enquiry, ChatMessage, Profile } from '../types/database';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile;
  otherUserId: string;
  enquiry: Enquiry;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  otherUserId,
  enquiry
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const list = await api.getMessagesForEnquiry(enquiry.id);
      setMessages(list);
      if (currentUser.id) {
        await api.markMessagesAsRead(enquiry.id, currentUser.id);
      }
    } catch (_e) { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadMessages();
    // Poll every 2.5s for new messages from other side (lightweight local poll)
    const interval = setInterval(() => {
      api.getMessagesForEnquiry(enquiry.id).then(list => {
        setMessages(prev => {
          if (prev.length === list.length && prev[prev.length - 1]?.id === list[list.length - 1]?.id) return prev;
          return list;
        });
      });
      if (currentUser.id) api.markMessagesAsRead(enquiry.id, currentUser.id);
    }, 2500);
    return () => clearInterval(interval);
  }, [isOpen, enquiry.id, currentUser.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    // Optimistic local insertion
    const tmp: ChatMessage = {
      id: `tmp-${Date.now()}`,
      created_at: new Date().toISOString(),
      enquiry_id: enquiry.id,
      sender_id: currentUser.id,
      receiver_id: otherUserId,
      message: text,
      read: false,
      sender: currentUser
    };
    setMessages(prev => [...prev, tmp]);
    try {
      const saved = await api.sendMessage({
        enquiry_id: enquiry.id,
        receiver_id: otherUserId,
        message: text
      });
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tmp.id);
        if (filtered.some(m => m.id === saved.id)) return filtered;
        return [...filtered, saved];
      });
    } catch (_e) {
      alert('Failed to send message. Please try again.');
    }
  };

  if (!isOpen) return null;

  const otherPartyLabel =
    (enquiry.sender && !idsEqual(enquiry.sender_id, currentUser.id))
      ? `${enquiry.sender.full_name || 'Sender'}${enquiry.sender.email ? ` · ${enquiry.sender.email}` : ''}`
      : enquiry.name || otherUserId || 'Conversation';

  const initialEnquiryMsg: ChatMessage = {
    id: `initial-${enquiry.id}`,
    created_at: enquiry.created_at,
    enquiry_id: enquiry.id,
    sender_id: enquiry.sender_id || otherUserId,
    receiver_id: idsEqual(currentUser.id, otherUserId) ? (enquiry.recipient_id || otherUserId) : (enquiry.recipient_id || ''),
    message: enquiry.message,
    read: true
  };

  const displayMessages = messages.some(m => m.id === initialEnquiryMsg.id)
    ? messages
    : [initialEnquiryMsg, ...messages];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                <UserCircle2 className="w-4 h-4 text-indigo-600" />
                {otherPartyLabel}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                Re: {enquiry.property?.title || enquiry.reel?.title || 'Direct Enquiry'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white rounded-xl text-slate-500 hover:text-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {loading && displayMessages.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-8">Loading messages…</div>
          ) : (
            displayMessages.map(msg => {
              const mine = idsEqual(msg.sender_id, currentUser.id);
              const isInitial = msg.id.startsWith('initial-');
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                    mine
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-md'
                      : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md'
                  }`}>
                    {isInitial && (
                      <div className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${mine ? 'text-indigo-200' : 'text-indigo-500'}`}>
                        Enquiry
                      </div>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    <div className={`text-[10px] mt-1 flex items-center gap-1 ${mine ? 'text-indigo-200 justify-end' : 'text-slate-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {mine && <span>· {msg.read ? '✓✓' : '✓'}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Type a message…"
            className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-200 border border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
