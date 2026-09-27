import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, Building, Film, MessageCircle } from 'lucide-react';
import { api, idsEqual } from '../services/api';
import type { Property, Reel, Profile, Enquiry } from '../types/database';

interface EnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  property?: Property | null;
  reel?: Reel | null;
  currentUser: Profile | null;
  onOpenChat?: (enquiry: Enquiry, otherUserId: string) => void;
}

export const EnquiryModal: React.FC<EnquiryModalProps> = ({
  isOpen,
  onClose,
  property,
  reel,
  currentUser,
  onOpenChat
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdEnquiry, setCreatedEnquiry] = useState<Enquiry | null>(null);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.full_name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isOpen) {
      setSubmitted(false);
      setCreatedEnquiry(null);
      setMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const recipientId = property?.owner_id || reel?.user_id || reel?.creator?.id || '';
  const targetTitle = property?.title || reel?.title || 'Real Estate Inquiry';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const created = await api.sendEnquiry({
        property_id: property?.id,
        reel_id: reel?.id,
        recipient_id: recipientId,
        name,
        email,
        phone,
        message
      });
      setCreatedEnquiry(created);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = () => {
    if (!createdEnquiry || !onOpenChat || !currentUser) return;
    const otherId = idsEqual(createdEnquiry.sender_id, currentUser.id)
      ? createdEnquiry.recipient_id
      : createdEnquiry.sender_id;
    onOpenChat(createdEnquiry, otherId || createdEnquiry.recipient_id);
  };

  const handleReset = () => {
    setSubmitted(false);
    setCreatedEnquiry(null);
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
              Direct Enquiry
            </span>
            <h3 className="font-bold text-lg leading-tight mt-1 line-clamp-1">
              {targetTitle}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl font-bold px-2 py-1">
            ✕
          </button>
        </div>

        <div className="p-6">
          {submitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-lg">Enquiry Submitted!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  The property representative has been notified. You can also continue the conversation via chat below.
                </p>
              </div>
              <div className="space-y-2">
                {onOpenChat && createdEnquiry && (
                  <button
                    onClick={handleOpenChat}
                    className="w-full py-2.5 bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Continue Chat with Professional
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Linked Target Info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center gap-2.5">
                {property ? (
                  <Building className="w-4 h-4 text-indigo-600 shrink-0" />
                ) : (
                  <Film className="w-4 h-4 text-purple-600 shrink-0" />
                )}
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Inquiring About</span>
                  <span className="font-semibold text-slate-900 truncate">{targetTitle}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rahul Sharma"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Your Message / Visit Request</label>
                <textarea
                  rows={3}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="I am interested in this property. Please share availability for a site visit."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                {loading ? 'Submitting...' : <><Send className="w-4 h-4" /> Send Enquiry Now</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
