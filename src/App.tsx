import { useState, useEffect } from 'react';
import { DeleteAccountPage } from './components/DeleteAccountPage';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { PropertyCard } from './components/PropertyCard';
import { PropertySearchFilter } from './components/PropertySearchFilter';
import type { FilterState } from './components/PropertySearchFilter';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import { EnquiryModal } from './components/EnquiryModal';
import { ReelsFeed } from './components/ReelsFeed';
import { ProfessionalDashboard } from './components/ProfessionalDashboard';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { CreatePropertyModal } from './components/CreatePropertyModal';
import { CreateReelModal } from './components/CreateReelModal';
import { ChatModal } from './components/ChatModal';
import { ChatInbox } from './components/ChatInbox';
import { ReportModal } from './components/ReportModal';
import { HomeLoanPage } from './components/HomeLoanPage';
import { ProfilePage } from './components/ProfilePage';
import { TokenPage } from './components/TokenPage';
import type { Profile, Property, Reel, Enquiry } from './types/database';
import { api, idsEqual } from './services/api';
import type { AppTab } from './components/Navbar';
import { Sparkles, Building2, Heart, Film } from 'lucide-react';

export function App() {
  // ── Public route: /delete-account ──────────────────────────────────────────
  // Checked before any auth/data loading so the page is accessible without
  // signing in — required by Google Play Store account-deletion policy.
  if (typeof window !== 'undefined' &&
      window.location.pathname === '/delete-account') {
    return <DeleteAccountPage />;
  }

  const [currentTab, setCurrentTab] = useState<AppTab>('reels');
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [reels, setReels] = useState<Reel[]>(() => api.getReelsSync());
  const [savedPropertyIds, setSavedPropertyIds] = useState<string[]>([]);
  const [savedSectionTab, setSavedSectionTab] = useState<'properties' | 'reels'>('properties');
  const [isLoading, setIsLoading] = useState(true);

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    city: 'all',
    propertyType: 'all',
    listingType: 'all',
    minPrice: 0,
    maxPrice: 100000000,
    bedrooms: 'any',
  });

  // Modal States
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [enquiryTarget, setEnquiryTarget] = useState<{ property?: Property | null; reel?: Reel | null } | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSupabaseConfigOpen, setIsSupabaseConfigOpen] = useState(false);
  const [isCreatePropertyOpen, setIsCreatePropertyOpen] = useState(false);
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);

  // TASK 6 - Chat modal state
  const [chatState, setChatState] = useState<{ open: boolean; enquiry: Enquiry | null; otherUserId: string }>({
    open: false, enquiry: null, otherUserId: ''
  });
  const handleOpenChat = (enquiry: Enquiry, otherUserId: string) => {
    setChatState({ open: true, enquiry, otherUserId: otherUserId || enquiry.sender_id || enquiry.recipient_id });
    if (enquiryTarget) setEnquiryTarget(null);
  };
  const handleCloseChat = () => setChatState(prev => ({ ...prev, open: false }));

  const handleOpenDirectChat = async (recipientId: string, property?: Property, reel?: Reel) => {
    if (!currentUser) {
      alert('Please sign in to chat directly with the publisher.');
      setIsAuthOpen(true);
      return;
    }
    const enquiryData = {
      property_id: property?.id,
      reel_id: reel?.id,
      recipient_id: recipientId,
      name: currentUser.full_name,
      email: currentUser.email,
      phone: currentUser.phone || '',
      message: `Hi, I would like to chat directly regarding ${property?.title || reel?.title || 'your listing'}.`
    };

    const resolveOtherId = (enq: Enquiry) => {
      if (!currentUser) return enq.recipient_id;
      return idsEqual(enq.sender_id, currentUser.id) ? enq.recipient_id : enq.sender_id;
    };

    try {
      const savedEnquiry = await api.sendEnquiry(enquiryData);
      setCurrentTab('chats');
      handleOpenChat(savedEnquiry, resolveOtherId(savedEnquiry) || savedEnquiry.recipient_id);
    } catch (_e) {
      const fallbackEnquiry: Enquiry = {
        id: `enq-direct-${Date.now()}`,
        created_at: new Date().toISOString(),
        sender_id: currentUser.id,
        recipient_id: recipientId,
        name: currentUser.full_name,
        email: currentUser.email,
        phone: currentUser.phone || '',
        message: enquiryData.message,
        status: 'new',
        property: property || undefined,
        reel: reel || undefined,
        sender: currentUser
      };
      setCurrentTab('chats');
      handleOpenChat(fallbackEnquiry, resolveOtherId(fallbackEnquiry) || recipientId);
    }
  };

  // TASK 8 - Report modal state
  const [reportState, setReportState] = useState<{
    open: boolean;
    target_type: 'property' | 'reel' | 'user' | 'comment';
    target_id: string;
    target_label?: string;
  }>({ open: false, target_type: 'property', target_id: '', target_label: undefined });
  const handleOpenReport = (
    target_type: 'property' | 'reel' | 'user' | 'comment',
    target_id: string,
    target_label?: string
  ) => {
    if (!currentUser) {
      alert('Please sign in to report content.');
      setIsAuthOpen(true);
      return;
    }
    setReportState({ open: true, target_type, target_id, target_label });
  };
  const handleCloseReport = () => setReportState(prev => ({ ...prev, open: false }));

  // Initial Data Load — reference preserving to prevent screen flickering
  const loadData = async (isInitialCall = false) => {
    if (isInitialCall && properties.length === 0) {
      setIsLoading(true);
    }
    try {
      const [user, profiles, propsList, reelsList, savedIds] = await Promise.all([
        api.getCurrentUser(),
        api.getAllUsers(),
        api.getProperties(filters),
        api.getReels(),
        api.getSavedPropertyIds(),
      ]);
      setCurrentUser(user);
      setAllProfiles(profiles);

      setProperties(prev => {
        if (prev.length > 0 && JSON.stringify(prev) === JSON.stringify(propsList)) return prev;
        return propsList;
      });
      setReels(prev => {
        if (prev.length > 0 && JSON.stringify(prev) === JSON.stringify(reelsList)) return prev;
        return reelsList;
      });
      setSavedPropertyIds(prev => {
        if (prev.length > 0 && JSON.stringify(prev) === JSON.stringify(savedIds)) return prev;
        return savedIds;
      });
    } finally {
      if (isInitialCall) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData(true);
    // Background polling every 12 seconds
    const interval = setInterval(() => {
      loadData(false);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api.getProperties(filters).then(props => {
      setProperties(prev => {
        if (JSON.stringify(prev) === JSON.stringify(props)) return prev;
        return props;
      });
    });
  }, [filters]);

  const handleSelectProperty = (property: Property) => {
    setSelectedProperty(property);
    api.incrementPropertyViews(property.id).then(() => {
      // Optimistically update view count in local state so dashboard reflects it immediately
      setProperties(prev => prev.map(p =>
        p.id === property.id ? { ...p, views_count: (p.views_count || 0) + 1 } : p
      ));
    });
  };

  const handleToggleSaveProperty = async (propertyId: string) => {
    await api.toggleSaveProperty(propertyId);
    const updatedSaved = await api.getSavedPropertyIds();
    setSavedPropertyIds(updatedSaved);
  };

  const handleRefreshReels = async () => {
    const updated = await api.getReels();
    setReels(updated);
  };

  // TASK 3 FIX: New reel injected at TOP of feed without full page/data refresh.
  const handleReelCreated = (newReel: Reel) => {
    setReels(prev => {
      // Avoid duplicates: remove any existing entry with the same id before prepending.
      const without = prev.filter(r => r.id !== newReel.id);
      return [newReel, ...without];
    });
    setTimeout(() => {
      api.getReels().then(fresh => setReels(fresh));
    }, 3000);
  };

  const handleRefreshProperties = async () => {
    const updatedProps = await api.getProperties(filters);
    setProperties(updatedProps);
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    loadData();
  };

  const handlePostPropertyAction = () => {
    if (!currentUser) {
      setIsAuthOpen(true);
    } else {
      setCurrentTab('professional');
      setIsCreatePropertyOpen(true);
    }
  };

  const savedPropertiesList = properties.filter(p => savedPropertyIds.includes(p.id));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-16 md:pb-6">
      {/* Top Navbar — hidden on mobile in Reels tab for immersive full-screen Instagram Reels experience */}
      {currentTab !== 'reels' && (
        <Navbar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          currentUser={currentUser}
          onOpenAuth={() => {
            if (currentUser) setIsProfileOpen(true);
            else setIsAuthOpen(true);
          }}
          savedCount={savedPropertyIds.length}
        />
      )}
      {currentTab === 'reels' && (
        <div className="hidden md:block">
          <Navbar
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            currentUser={currentUser}
            onOpenAuth={() => {
              if (currentUser) setIsProfileOpen(true);
              else setIsAuthOpen(true);
            }}
            savedCount={savedPropertyIds.length}
          />
        </div>
      )}

      {/* Hero Welcome Header */}
      {currentTab === 'properties' && (
        <section className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200/60 py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> IndoProperty — Real Estate for a Better Tomorrow
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Discover & Post Verified Homes with <span className="text-indigo-600">Video Reels</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl font-medium">
                Explore luxury apartments, sea-facing penthouses & villas with immersive vertical video walkthroughs and instant direct enquiries.
              </p>
              
              {/* Mainpage Post Button */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                <button
                  onClick={handlePostPropertyAction}
                  className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-500/25 flex items-center gap-2 transition active:scale-98 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" /> + Post Property to Dashboard
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Container */}
      {currentTab === 'reels' ? (
        <main className="flex-1 w-full bg-black flex flex-col justify-center items-center relative overflow-hidden">
          {reels.length === 0 ? (
            <div className="bg-slate-900 max-w-md mx-auto rounded-3xl p-10 text-center border border-slate-800 shadow-2xl space-y-4 text-white">
              <Heart className="w-12 h-12 text-purple-400 mx-auto" />
              <h3 className="font-bold text-lg">No Video Reels Available</h3>
              <p className="text-xs text-slate-400">Be the first to upload an immersive vertical property tour!</p>
              <button
                onClick={() => {
                  if (!currentUser) setIsAuthOpen(true);
                  else setIsCreateReelOpen(true);
                }}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-purple-500/30 active:scale-98"
              >
                + Upload First Reel
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-center">
              <ReelsFeed
                reels={reels}
                onOpenProperty={handleSelectProperty}
                onOpenEnquiry={(r) => setEnquiryTarget({ reel: r, property: r.property })}
                currentUser={currentUser}
                onRefreshReels={handleRefreshReels}
                onOpenCreateReel={() => {
                  if (!currentUser) setIsAuthOpen(true);
                  else setIsCreateReelOpen(true);
                }}
                onOpenDirectChat={handleOpenDirectChat}
                onOpenReport={handleOpenReport}
                onOpenAuth={() => setIsAuthOpen(true)}
              />
            </div>
          )}
        </main>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* TAB 1: PROPERTIES DISCOVERY & SEARCH */}
          {currentTab === 'properties' && (
            <div className="space-y-6">
              {/* Search & Filters */}
              <PropertySearchFilter
                filters={filters}
                onFilterChange={setFilters}
                totalResults={properties.length}
              />

              {/* Property Cards Grid */}
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
                      <div className="h-52 bg-slate-200" />
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-slate-200 rounded-full w-3/4" />
                        <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                        <div className="h-3 bg-slate-100 rounded-full w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : properties.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="font-bold text-lg text-slate-900">No properties available</h3>
                  <p className="text-xs text-slate-500">Sign in to list new properties or connect to Supabase.</p>
                  <button
                    onClick={() => setIsAuthOpen(true)}
                    className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-200"
                  >
                    Sign In / Create Account
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {properties.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      isSaved={savedPropertyIds.includes(property.id)}
                      onToggleSave={handleToggleSaveProperty}
                      onClick={handleSelectProperty}
                      onOpenDirectChat={handleOpenDirectChat}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INSTAGRAM-STYLE DIRECT MESSAGES INBOX */}
          {currentTab === 'chats' && (
            <ChatInbox
              currentUser={currentUser}
              onOpenAuth={() => setIsAuthOpen(true)}
              onOpenProperty={handleSelectProperty}
            />
          )}

        {/* TAB 3: SAVED PROPERTIES & REELS */}
        {currentTab === 'saved' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Saved Items</h2>
                <p className="text-xs text-slate-500">Your bookmarked properties & video reels for quick access</p>
              </div>
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold shrink-0">
                <button
                  onClick={() => setSavedSectionTab('properties')}
                  className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                    savedSectionTab === 'properties' ? 'bg-white text-indigo-600 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" /> Properties ({savedPropertiesList.length})
                </button>
                <button
                  onClick={() => setSavedSectionTab('reels')}
                  className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                    savedSectionTab === 'reels' ? 'bg-white text-purple-600 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" /> Video Reels ({reels.filter(r => r.is_saved_by_user).length})
                </button>
              </div>
            </div>

            {savedSectionTab === 'properties' ? (
              savedPropertiesList.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
                  <Heart className="w-12 h-12 text-rose-300 mx-auto" />
                  <h3 className="font-bold text-lg text-slate-900">No saved properties yet</h3>
                  <p className="text-xs text-slate-500">Click the heart icon on any property card to save it here.</p>
                  <button
                    onClick={() => setCurrentTab('properties')}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 cursor-pointer"
                  >
                    Explore Properties
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedPropertiesList.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      isSaved={true}
                      onToggleSave={handleToggleSaveProperty}
                      onClick={handleSelectProperty}
                    />
                  ))}
                </div>
              )
            ) : (
              reels.filter(r => r.is_saved_by_user).length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
                  <Film className="w-12 h-12 text-purple-300 mx-auto" />
                  <h3 className="font-bold text-lg text-slate-900">No saved video reels yet</h3>
                  <p className="text-xs text-slate-500">Click the bookmark icon on any reel in the video feed to save it here.</p>
                  <button
                    onClick={() => setCurrentTab('reels')}
                    className="px-5 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-200 cursor-pointer"
                  >
                    Watch Reels
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {reels.filter(r => r.is_saved_by_user).map((reel) => (
                    <div key={reel.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                      <div className="relative aspect-[9/16] bg-slate-900 overflow-hidden group">
                        <video
                          src={reel.video_url}
                          poster={reel.thumbnail_url}
                          className="w-full h-full object-cover"
                          muted
                          loop
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-between p-4 text-white">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase bg-purple-600/80 px-2 py-0.5 rounded-full">Reel</span>
                            <button
                              onClick={async () => {
                                await api.toggleSaveReel(reel.id);
                                handleRefreshReels();
                              }}
                              className="p-1.5 bg-black/60 rounded-full text-amber-400 hover:text-white transition cursor-pointer"
                              title="Unsave Reel"
                            >
                              <Heart className="w-4 h-4 fill-amber-400 text-amber-400" />
                            </button>
                          </div>
                          <div>
                            <h4 className="font-bold text-sm line-clamp-1">{reel.title}</h4>
                            {reel.caption && <p className="text-xs text-slate-300 line-clamp-1 mt-0.5">{reel.caption}</p>}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between bg-slate-50 border-t border-slate-100">
                        <span className="text-xs text-slate-500 font-medium">By {reel.creator?.full_name || 'Creator'}</span>
                        <button
                          onClick={() => setCurrentTab('reels')}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
                        >
                          View Feed
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* TAB 4: PROFESSIONAL DASHBOARD / PROFILE */}
        {currentTab === 'professional' && (
          currentUser ? (
            <ProfessionalDashboard
              currentUser={currentUser}
              onOpenCreateProperty={() => setIsCreatePropertyOpen(true)}
              onOpenCreateReel={() => setIsCreateReelOpen(true)}
              onSelectProperty={handleSelectProperty}
              onOpenChat={handleOpenChat}
            />
          ) : (
            <ProfilePage
              currentUser={null}
              onOpenAuth={() => setIsAuthOpen(true)}
              onOpenProfile={() => setIsProfileOpen(true)}
              onLogout={handleLogout}
              onTabChange={setCurrentTab}
            />
          )
        )}

        {/* TAB 5: ADMIN PANEL */}
        {currentTab === 'admin' && (
          <AdminPanel />
        )}

        {/* TAB 6: TOKEN WALLET + REFERRAL (unified) */}
        {currentTab === 'tokens' && (
          <TokenPage currentUser={currentUser} onOpenAuth={() => setIsAuthOpen(true)} />
        )}

        {/* TAB 7: HOME LOAN */}
        {currentTab === 'homeloan' && (
          currentUser ? (
            <HomeLoanPage currentUser={currentUser} />
          ) : (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 max-w-md mx-auto space-y-4 shadow-sm my-8">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-200 shadow-sm">
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Apply for Home Loan</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Check eligibility, calculate EMIs, and submit your home loan application for verification with authorized lending partners.
              </p>
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-200 hover:opacity-95 transition cursor-pointer"
              >
                Sign In to Apply
              </button>
            </div>
          )
        )}

        {/* TAB 8: REFER & EARN — now handled inside TokenPage, redirect there */}
        {currentTab === 'referral' && (
          <TokenPage currentUser={currentUser} onOpenAuth={() => setIsAuthOpen(true)} />
        )}
      </main>
      )}

      {/* Mobile Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        currentUser={currentUser}
        savedCount={savedPropertyIds.length}
      />

      {/* MODALS */}
      <PropertyDetailModal
        property={selectedProperty}
        isOpen={Boolean(selectedProperty)}
        onClose={() => setSelectedProperty(null)}
        isSaved={selectedProperty ? savedPropertyIds.includes(selectedProperty.id) : false}
        onToggleSave={handleToggleSaveProperty}
        onOpenEnquiry={(p) => {
          setSelectedProperty(null);
          setEnquiryTarget({ property: p });
        }}
        onOpenDirectChat={(recipientId, property) => {
          setSelectedProperty(null);
          handleOpenDirectChat(recipientId, property);
        }}
        onOpenReport={handleOpenReport}
      />

      <EnquiryModal
        isOpen={Boolean(enquiryTarget)}
        onClose={() => setEnquiryTarget(null)}
        property={enquiryTarget?.property}
        reel={enquiryTarget?.reel}
        currentUser={currentUser}
        onOpenChat={handleOpenChat}
      />

      {currentUser && chatState.open && chatState.enquiry && (
        <ChatModal
          isOpen={chatState.open}
          onClose={handleCloseChat}
          currentUser={currentUser}
          otherUserId={chatState.otherUserId || chatState.enquiry.sender_id || chatState.enquiry.recipient_id}
          enquiry={chatState.enquiry}
        />
      )}

      {reportState.open && (
        <ReportModal
          isOpen={reportState.open}
          onClose={handleCloseReport}
          currentUser={currentUser}
          target_type={reportState.target_type}
          target_id={reportState.target_id}
          target_label={reportState.target_label}
        />
      )}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          loadData();
        }}
        profilesList={allProfiles}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        onProfileUpdated={(updated) => {
          setCurrentUser(updated);
          loadData();
        }}
        onLogout={handleLogout}
      />

      <SupabaseConfigModal
        isOpen={isSupabaseConfigOpen}
        onClose={() => setIsSupabaseConfigOpen(false)}
      />

      {currentUser && (
        <>
          <CreatePropertyModal
            isOpen={isCreatePropertyOpen}
            onClose={() => setIsCreatePropertyOpen(false)}
            currentUser={currentUser}
            onSuccess={handleRefreshProperties}
          />

          <CreateReelModal
            isOpen={isCreateReelOpen}
            onClose={() => setIsCreateReelOpen(false)}
            currentUser={currentUser}
            userProperties={properties.filter(p => p.owner_id === currentUser.id)}
            onSuccess={handleReelCreated}
          />
        </>
      )}
    </div>
  );
}

export default App;
