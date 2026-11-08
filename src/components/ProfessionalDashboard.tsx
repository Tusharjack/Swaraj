import React, { useState, useEffect } from 'react';
import { Building2, Plus, Film, Mail, Eye, TrendingUp, ShieldCheck, Trash2, MessageCircle, Coins, Star } from 'lucide-react';
import type { Profile, Property, Enquiry, Reel } from '../types/database';
import { api, idsEqual } from '../services/api';
import { formatPrice } from './PropertyCard';

interface ProfessionalDashboardProps {
  currentUser: Profile;
  onOpenCreateProperty: () => void;
  onOpenCreateReel: () => void;
  onSelectProperty: (property: Property) => void;
  onOpenChat?: (enquiry: Enquiry, otherUserId: string) => void;
}

export const ProfessionalDashboard: React.FC<ProfessionalDashboardProps> = ({
  currentUser,
  onOpenCreateProperty,
  onOpenCreateReel,
  onSelectProperty,
  onOpenChat
}) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [reels, setReels] = useState<Reel[]>(() => api.getReelsForUserSync(currentUser.id));
  const [totalViews, setTotalViews] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState<{ [k: string]: number }>({});
  const [activeTab, setActiveTab] = useState<'leads' | 'properties' | 'reels'>('leads');
  const [isLoading, setIsLoading] = useState(false);

  const loadFullDashboard = async () => {
    // Instant sync hydration first so Published Reels is NEVER 0
    const syncReels = api.getReelsForUserSync(currentUser.id);
    if (syncReels.length > 0 && reels.length === 0) {
      setReels(syncReels);
    }
    try {
      const dash = await api.getProfessionalDashboard(currentUser.id);
      setProperties(dash.properties);
      setEnquiries(dash.enquiries);
      if (dash.reels.length > 0) {
        setReels(dash.reels);
      } else if (syncReels.length > 0) {
        setReels(syncReels);
      }
      setTotalViews(dash.totalViews);
      try {
        const counts = await api.getUnreadCountsByEnquiry(currentUser.id);
        setUnreadCounts(counts);
      } catch (_e) {}
    } finally {
      setIsLoading(false);
    }
  };

  const pollEnquiries = async () => {
    const allEnqs = await api.getEnquiriesForUser(currentUser.id);
    // Only show leads received (recipient = me), not ones I sent
    const userEnqs = allEnqs.filter(e => e.recipient_id === currentUser.id);
    setEnquiries(prev => {
      if (JSON.stringify(prev) === JSON.stringify(userEnqs)) return prev;
      return userEnqs;
    });
    try {
      const counts = await api.getUnreadCountsByEnquiry(currentUser.id);
      setUnreadCounts(prev => {
        if (JSON.stringify(prev) === JSON.stringify(counts)) return prev;
        return counts;
      });
    } catch (_e) {}
  };

  useEffect(() => {
    loadFullDashboard();
    const handleEnquiryEvent = () => {
      pollEnquiries();
    };
    window.addEventListener('swaraj_enquiry_sent', handleEnquiryEvent);
    const timer = setInterval(pollEnquiries, 4000);
    return () => {
      window.removeEventListener('swaraj_enquiry_sent', handleEnquiryEvent);
      clearInterval(timer);
    };
  }, [currentUser]);

  const handleUpdateStatus = async (enquiryId: string, status: Enquiry['status']) => {
    await api.updateEnquiryStatus(enquiryId, status);
    setEnquiries(prev => prev.map(e => e.id === enquiryId ? { ...e, status } : e));
    pollEnquiries();
  };

  const handleDeleteEnquiry = async (enquiryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this lead?')) {
      setEnquiries(prev => prev.filter(e => e.id !== enquiryId));
      await api.deleteEnquiry(enquiryId);
      pollEnquiries();
    }
  };

  const handleDeleteProperty = async (propertyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this property listing?')) {
      await api.deleteProperty(propertyId);
      loadFullDashboard();
    }
  };

  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteMsg, setPromoteMsg] = useState<{ id: string; success: boolean; msg: string } | null>(null);

  const handlePromoteProperty = async (prop: Property, e: React.MouseEvent) => {
    e.stopPropagation();
    if (prop.featured) return;
    if (!confirm(`Promote "${prop.title}" for 50 platform credit tokens? This marks your listing as FEATURED, boosts visibility to buyers, and highlights it across IndoProperty.`)) {
      return;
    }
    setPromotingId(prop.id);
    try {
      await api.spendTokensForPromotion(prop.id, 50);
      setProperties(prev => prev.map(p => p.id === prop.id ? { ...p, featured: true } : p));
      setPromoteMsg({ id: prop.id, success: true, msg: '🎉 Promoted to Featured! Listing boosted.' });
      setTimeout(() => setPromoteMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Promotion failed. Make sure you have at least 50 tokens.');
    } finally {
      setPromotingId(null);
    }
  };

  const handleDeleteReel = async (reelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this video reel?')) {
      await api.deleteReel(reelId);
      loadFullDashboard();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Profile Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'}
            alt={currentUser.full_name}
            className="w-16 h-16 rounded-full object-cover border-2 border-indigo-400 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{currentUser.full_name}</h2>
              {currentUser.verified && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> {currentUser.badge || 'Verified Pro'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {currentUser.agency_name || `${currentUser.professional_type?.toUpperCase()} Professional`} • {currentUser.city || 'Mumbai'}
            </p>
            <p className="text-xs text-indigo-300 mt-1 line-clamp-1">{currentUser.bio || 'Verified professional listing manager.'}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={onOpenCreateProperty}
            className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> Add Property
          </button>
          <button
            onClick={onOpenCreateReel}
            className="flex-1 md:flex-none px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-500/30 flex items-center justify-center gap-1.5 transition"
          >
            <Film className="w-4 h-4" /> Upload Reel
          </button>
        </div>
      </div>

      {/* Analytics Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setActiveTab('properties')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1 text-left hover:border-indigo-400 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase">Active Listings</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          {isLoading ? (
            <div className="h-8 w-16 bg-slate-200 animate-pulse rounded-lg mt-1" />
          ) : (
            <div className="text-2xl font-black text-slate-900">{properties.length}</div>
          )}
          <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Tap to manage
          </p>
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1 text-left hover:border-purple-400 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase">Leads Received</span>
            <Mail className="w-4 h-4 text-purple-600" />
          </div>
          {isLoading ? (
            <div className="h-8 w-16 bg-slate-200 animate-pulse rounded-lg mt-1" />
          ) : (
            <div className="text-2xl font-black text-slate-900">{enquiries.length}</div>
          )}
          <p className="text-[11px] text-slate-500 font-medium">
            {isLoading ? '...' : `${enquiries.filter(e => e.status === 'new').length} new · Tap to view`}
          </p>
        </button>

        <button
          onClick={() => setActiveTab('properties')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1 text-left hover:border-blue-400 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase">Total Views</span>
            <Eye className="w-4 h-4 text-blue-600" />
          </div>
          {isLoading ? (
            <div className="h-8 w-16 bg-slate-200 animate-pulse rounded-lg mt-1" />
          ) : (
            <div className="text-2xl font-black text-slate-900">{totalViews}</div>
          )}
          <p className="text-[11px] text-slate-500 font-medium">Across all properties</p>
        </button>

        <button
          onClick={() => setActiveTab('reels')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1 text-left hover:border-rose-400 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase">Published Reels</span>
            <Film className="w-4 h-4 text-rose-600" />
          </div>
          {isLoading ? (
            <div className="h-8 w-16 bg-slate-200 animate-pulse rounded-lg mt-1" />
          ) : (
            <div className="text-2xl font-black text-slate-900">{reels.length}</div>
          )}
          <p className="text-[11px] text-slate-500 font-medium">Tap to manage reels</p>
        </button>
      </div>

      {/* Main Content Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setActiveTab('leads')}
            className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'leads'
                ? 'border-indigo-600 text-indigo-600 bg-white font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-4 h-4" /> Received Leads ({enquiries.length})
          </button>

          <button
            onClick={() => setActiveTab('properties')}
            className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'properties'
                ? 'border-indigo-600 text-indigo-600 bg-white font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" /> Managed Properties ({properties.length})
          </button>

          <button
            onClick={() => setActiveTab('reels')}
            className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'reels'
                ? 'border-indigo-600 text-indigo-600 bg-white font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Film className="w-4 h-4" /> Managed Reels ({reels.length})
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'leads' && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="animate-pulse flex gap-3 py-4 border-b border-slate-100">
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-slate-200 rounded-full w-1/3" />
                        <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                        <div className="h-8 bg-slate-100 rounded-xl w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : enquiries.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No leads received yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {enquiries.map((enq) => (
                    <div key={enq.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{enq.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            enq.status === 'new' ? 'bg-amber-100 text-amber-800' :
                            enq.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {enq.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{enq.phone} • {enq.email}</p>
                        <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 max-w-xl">
                          "{enq.message}"
                        </p>
                        {enq.property && (
                          <p className="text-[11px] text-indigo-600 font-semibold">
                            Regarding: {enq.property.title}
                          </p>
                        )}
                      </div>

                      {/* Status Selector & Delete */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          {onOpenChat && (
                            <button
                              onClick={() => {
                                const otherId = idsEqual(enq.recipient_id, currentUser.id)
                                  ? enq.sender_id
                                  : enq.recipient_id;
                                onOpenChat(enq, otherId || enq.sender_id || enq.recipient_id);
                              }}
                              className="relative px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              Chat
                              {unreadCounts[enq.id] ? (
                                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold rounded-full px-1.5 min-w-[18px] text-center border-2 border-white">
                                  {unreadCounts[enq.id]}
                                </span>
                              ) : null}
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateStatus(enq.id, 'contacted')}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition"
                          >
                            Mark Contacted
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(enq.id, 'closed')}
                            className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition"
                          >
                            Close Lead
                          </button>
                          <button
                            onClick={(e) => handleDeleteEnquiry(enq.id, e)}
                            title="Delete Lead"
                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'properties' && (
            <div className="space-y-4">
              {properties.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-xs text-slate-400">You haven't added any properties yet.</p>
                  <button
                    onClick={onOpenCreateProperty}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
                  >
                    Add Your First Property
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {properties.map((prop) => (
                    <div
                      key={prop.id}
                      onClick={() => onSelectProperty(prop)}
                      className="p-4 rounded-2xl border border-slate-200/80 hover:border-indigo-400 hover:shadow-md cursor-pointer transition flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={prop.media?.[0]?.url || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=300'}
                          alt={prop.title}
                          className="w-16 h-16 rounded-xl object-cover border"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{prop.title}</h4>
                            {prop.featured && (
                              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black uppercase rounded tracking-wider shrink-0 flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-white" /> Featured
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-extrabold text-indigo-600">
                            {formatPrice(prop.price, prop.listing_type)}
                          </p>
                          <p className="text-[11px] text-slate-400">{prop.location}, {prop.city}</p>
                          {promoteMsg?.id === prop.id && (
                            <p className="text-[10px] font-bold text-emerald-600 mt-1">{promoteMsg.msg}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!prop.featured ? (
                          <button
                            onClick={(e) => handlePromoteProperty(prop, e)}
                            disabled={promotingId === prop.id}
                            title="Boost listing using 50 platform tokens"
                            className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-[10px] font-black rounded-xl shadow-sm transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Coins className="w-3 h-3 text-amber-100" />
                            {promotingId === prop.id ? 'Promoting…' : 'Promote (50)'}
                          </button>
                        ) : (
                          <span className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-lg flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Boosted
                          </span>
                        )}

                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg uppercase">
                          {prop.status}
                        </span>
                        <button
                          onClick={(e) => handleDeleteProperty(prop.id, e)}
                          title="Delete Property"
                          className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reels' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {reels.map((reel) => (
                <div key={reel.id} className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 text-white p-3 flex flex-col justify-between group">
                  <img src={reel.thumbnail_url} alt={reel.title} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                  
                  <div className="relative z-10 flex items-center justify-between w-full">
                    <div className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-bold">
                      ❤️ {reel.likes_count}
                    </div>
                    <button
                      onClick={(e) => handleDeleteReel(reel.id, e)}
                      title="Delete Reel"
                      className="p-1.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition shadow-md"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="relative z-10">
                    <p className="text-xs font-bold line-clamp-1">{reel.title}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
