import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Bookmark, Share2, Building, Plus, Check, Play, ShieldCheck, MessageSquare, Camera, Music, MoreVertical, Coins, Star } from 'lucide-react';
import type { Reel, ReelComment, Property, Profile } from '../types/database';
import { api } from '../services/api';
import { formatPrice } from './PropertyCard';
import { resolveMediaUrl } from '../services/mediaStore';
import { ShareModal } from './ShareModal';

// ─── Video Player ─────────────────────────────────────────────────────────────
// No `muted` attribute — volume follows device physical volume buttons.
// Autoplay without sound is blocked by Android/browser policy, so the first
// play() call may be silently caught; users can always tap the screen to play.
export const ReelVideoPlayer: React.FC<{
  reel: Reel;
  shouldLoad: boolean;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onClick: () => void;
  onDoubleClick: () => void;
}> = React.memo(({ reel, shouldLoad, onVideoRef, onClick, onDoubleClick }) => {
  const [videoSrc, setVideoSrc] = useState<string>(reel.video_url?.startsWith('idb://') ? '' : reel.video_url);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lazy loading: only fetch the video source once this reel (or a neighbour)
  // is near the viewport. Far-away reels show their poster image only — this
  // dramatically cuts bandwidth and speeds up the first paint of the feed.
  useEffect(() => {
    if (!shouldLoad) return;
    if (reel.video_url?.startsWith('idb://')) {
      resolveMediaUrl(reel.video_url).then(resolved => setVideoSrc(resolved));
    } else {
      setVideoSrc(reel.video_url);
    }
  }, [reel.video_url, shouldLoad]);

  const handleClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      onDoubleClick();
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        onClick();
      }, 250);
    }
  };

  return (
    <video
      ref={onVideoRef}
      src={shouldLoad ? videoSrc : undefined}
      poster={reel.thumbnail_url}
      loop
      playsInline
      preload={shouldLoad ? 'auto' : 'none'}
      onClick={handleClick}
      className="w-full h-full object-cover cursor-pointer select-none"
    />
  );
}, (prevProps, nextProps) =>
  prevProps.reel.id === nextProps.reel.id &&
  prevProps.reel.video_url === nextProps.reel.video_url &&
  prevProps.shouldLoad === nextProps.shouldLoad
);

// ─── Props ────────────────────────────────────────────────────────────────────
interface ReelsFeedProps {
  reels: Reel[];
  onOpenProperty: (property: Property) => void;
  currentUser: Profile | null;
  onRefreshReels: () => void;
  onOpenCreateReel?: () => void;
  onOpenDirectChat?: (recipientId: string, property?: Property, reel?: Reel) => void;
  onOpenReport?: (target_type: 'reel' | 'property' | 'user' | 'comment', target_id: string, target_label?: string) => void;
  onOpenAuth?: () => void;
}

// ─── Feed ─────────────────────────────────────────────────────────────────────
export const ReelsFeed: React.FC<ReelsFeedProps> = ({
  reels,
  onOpenProperty,
  currentUser,
  onRefreshReels,
  onOpenCreateReel,
  onOpenDirectChat,
  onOpenReport,
  onOpenAuth
}) => {
  const [activeReelIdx, setActiveReelIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [commentDrawerReel, setCommentDrawerReel] = useState<Reel | null>(null);
  const [shareModalReel, setShareModalReel] = useState<Reel | null>(null);
  const [commentsList, setCommentsList] = useState<ReelComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [doubleTapHeart, setDoubleTapHeart] = useState<{ reelId: string; show: boolean }>({ reelId: '', show: false });
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  const [localLikeStates, setLocalLikeStates] = useState<{ [id: string]: { isLiked: boolean; count: number } }>({});
  const [localSaveStates, setLocalSaveStates] = useState<{ [id: string]: boolean }>({});
  const [localCommentCounts, setLocalCommentCounts] = useState<{ [id: string]: number }>({});
  const [boostingReelId, setBoostingReelId] = useState<string | null>(null);
  const [boostedReelIds, setBoostedReelIds] = useState<Set<string>>(new Set());

  const pendingLikesRef = useRef<Set<string>>(new Set());
  const pendingSavesRef = useRef<Set<string>>(new Set());

  // Autoplay the visible reel via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const reelId = entry.target.getAttribute('data-reel-id');
          if (!reelId) return;
          const videoEl = videoRefs.current[reelId];
          if (!videoEl) return;
          if (entry.isIntersecting) {
            videoEl.play().catch(() => {});
            setIsPlaying(true);
            const idx = reels.findIndex(r => r.id === reelId);
            if (idx !== -1) setActiveReelIdx(idx);
          } else {
            videoEl.pause();
          }
        });
      },
      { threshold: 0.35 }
    );
    Object.keys(videoRefs.current).forEach((reelId) => {
      const el = document.getElementById(`reel-container-${reelId}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [reels]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleToggleLike = async (reel: Reel) => {
    if (!currentUser) { if (onOpenAuth) onOpenAuth(); return; }
    if (pendingLikesRef.current.has(reel.id)) return;
    pendingLikesRef.current.add(reel.id);
    const currentIsLiked = localLikeStates[reel.id]?.isLiked ?? reel.is_liked_by_user ?? false;
    const currentCount = localLikeStates[reel.id]?.count ?? reel.likes_count ?? 0;
    const nextIsLiked = !currentIsLiked;
    const nextCount = Math.max(0, currentCount + (nextIsLiked ? 1 : -1));
    setLocalLikeStates(prev => ({ ...prev, [reel.id]: { isLiked: nextIsLiked, count: nextCount } }));
    try {
      const { isLiked, count } = await api.toggleLikeReel(reel.id);
      setLocalLikeStates(prev => ({ ...prev, [reel.id]: { isLiked, count: typeof count === 'number' ? count : nextCount } }));
    } catch (_e) {/* optimistic update retained */} finally { pendingLikesRef.current.delete(reel.id); }
  };

  const handleDoubleTap = (reel: Reel) => {
    setDoubleTapHeart({ reelId: reel.id, show: true });
    setTimeout(() => setDoubleTapHeart({ reelId: '', show: false }), 1000);
    const currentIsLiked = localLikeStates[reel.id]?.isLiked ?? reel.is_liked_by_user ?? false;
    if (!currentIsLiked) handleToggleLike(reel);
  };

  const handleToggleSave = async (reel: Reel) => {
    if (!currentUser) { if (onOpenAuth) onOpenAuth(); return; }
    if (pendingSavesRef.current.has(reel.id)) return;
    pendingSavesRef.current.add(reel.id);
    const currentIsSaved = localSaveStates[reel.id] ?? reel.is_saved_by_user ?? false;
    setLocalSaveStates(prev => ({ ...prev, [reel.id]: !currentIsSaved }));
    try {
      const nowSaved = await api.toggleSaveReel(reel.id);
      setLocalSaveStates(prev => ({ ...prev, [reel.id]: nowSaved }));
    } catch (_e) {/* optimistic update retained */} finally { pendingSavesRef.current.delete(reel.id); }
  };

  const handleToggleFollow = async (creatorId: string) => {
    if (!currentUser) { if (onOpenAuth) onOpenAuth(); return; }
    await api.toggleFollowCreator(creatorId);
    onRefreshReels();
  };

  const handleBoostReel = async (reel: Reel) => {
    if (!currentUser) { if (onOpenAuth) onOpenAuth(); return; }
    if (boostingReelId === reel.id) return;
    const isBoosted = boostedReelIds.has(reel.id) || reel.boosted;
    if (isBoosted) return;
    if (!confirm(`Boost this reel for 30 platform credit tokens? Boosted reels get higher visibility in the feed for 7 days.`)) {
      return;
    }
    setBoostingReelId(reel.id);
    try {
      await api.redeemForBoost(reel.id);
      setBoostedReelIds(prev => new Set(prev).add(reel.id));
      alert('🎉 Reel boosted successfully! It will appear higher in the feed.');
      onRefreshReels();
    } catch (err: any) {
      alert(err.message || 'Boost failed. Make sure you have at least 30 tokens.');
    } finally {
      setBoostingReelId(null);
    }
  };

  const handleOpenComments = async (reel: Reel) => {
    setCommentDrawerReel(reel);
    try { setCommentsList(await api.getReelComments(reel.id)); }
    catch (_e) { setCommentsList([]); }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !commentDrawerReel) return;
    if (!currentUser) { if (onOpenAuth) onOpenAuth(); return; }
    const text = newCommentText.trim();
    setNewCommentText('');
    const tempComment: ReelComment = {
      id: `comm-${Date.now()}`, created_at: new Date().toISOString(),
      reel_id: commentDrawerReel.id, user_id: currentUser.id,
      content: text, user: currentUser
    };
    setCommentsList(prev => [...prev, tempComment]);
    setLocalCommentCounts(prev => ({
      ...prev,
      [commentDrawerReel.id]: (prev[commentDrawerReel.id] ?? commentDrawerReel.comments_count ?? 0) + 1
    }));
    try {
      await api.addReelComment(commentDrawerReel.id, text);
      setCommentsList(await api.getReelComments(commentDrawerReel.id));
    } catch (_e) {/* temp comment stays */}
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    // Full-screen container: 100dvh fills the exact visible phone screen (accounts
    // for bottom nav bar and Android system bars on all devices)
    <div className="relative w-full bg-black overflow-hidden font-sans select-none"
      style={{ height: '100dvh' }}>

      {/* Top Header Overlay */}
      <div className="absolute top-0 inset-x-0 z-30 px-4 pt-safe-top pb-3 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-auto"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <span className="font-extrabold text-sm tracking-wide text-white drop-shadow">
          Reels
        </span>
        {onOpenCreateReel && (
          <button
            onClick={onOpenCreateReel}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-extrabold text-xs rounded-full shadow-lg shadow-rose-500/30 flex items-center gap-1 active:scale-95 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" /> + Reel
          </button>
        )}
      </div>

      {/* Vertical Snap Scroll — fills full screen height */}
      <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar reels-scroll">
        {reels.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white bg-slate-950 space-y-4">
            <div className="p-5 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 rounded-full shadow-2xl shadow-rose-500/40 animate-pulse">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h3 className="text-lg font-black tracking-wide">No Video Reels Available</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Be the first to upload a property video reel!
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={onRefreshReels}
                className="px-4 py-2 bg-white/10 text-white border border-white/20 text-xs font-bold rounded-xl cursor-pointer">
                Refresh Feed
              </button>
              {onOpenCreateReel && (
                <button onClick={onOpenCreateReel}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer">
                  <Plus className="w-4 h-4" /> Post Reel
                </button>
              )}
            </div>
          </div>
        ) : (
          reels.map((reel, idx) => {
            const isLiked    = localLikeStates[reel.id]?.isLiked ?? reel.is_liked_by_user ?? false;
            const likesCount = localLikeStates[reel.id]?.count ?? reel.likes_count ?? 0;
            const isSaved    = localSaveStates[reel.id] ?? reel.is_saved_by_user ?? false;
            const commentsCount = localCommentCounts[reel.id] ?? reel.comments_count ?? 0;

            return (
              <div
                key={reel.id}
                id={`reel-container-${reel.id}`}
                data-reel-id={reel.id}
                className="relative w-full snap-start shrink-0 flex items-center justify-center bg-slate-900 overflow-hidden"
                style={{ height: '100dvh' }}
              >
                {/* Video */}
                <ReelVideoPlayer
                  reel={reel}
                  shouldLoad={Math.abs(idx - activeReelIdx) <= 1}
                  onVideoRef={(el) => { videoRefs.current[reel.id] = el; }}
                  onClick={() => {
                    const el = videoRefs.current[reel.id];
                    if (!el) return;
                    if (el.paused) { el.play().catch(() => {}); setIsPlaying(true); }
                    else { el.pause(); setIsPlaying(false); }
                  }}
                  onDoubleClick={() => handleDoubleTap(reel)}
                />

                {/* Double-tap heart */}
                {doubleTapHeart.show && doubleTapHeart.reelId === reel.id && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    <Heart className="w-28 h-28 text-rose-500 fill-rose-500 animate-in zoom-in-50 fade-in duration-300 drop-shadow-2xl" />
                  </div>
                )}

                {/* Play/Pause indicator */}
                {!isPlaying && activeReelIdx === idx && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                    <div className="p-4 bg-black/60 backdrop-blur-md rounded-full text-white">
                      <Play className="w-8 h-8 fill-current translate-x-0.5" />
                    </div>
                  </div>
                )}

                {/* Bottom gradient */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                {/* Right action bar */}
                <div className="absolute right-3 z-20 flex flex-col items-center gap-4 text-white"
                  style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.5rem)' }}>
                  {/* Creator avatar */}
                  {reel.creator && (
                    <div className="relative mb-1">
                      <div className="p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 rounded-full shadow-lg">
                        <img
                          src={reel.creator.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={reel.creator.full_name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-black"
                        />
                      </div>
                      <button
                        onClick={() => handleToggleFollow(reel.user_id)}
                        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full p-0.5 shadow transition ${reel.is_following_creator ? 'bg-emerald-500' : 'bg-rose-500'} text-white`}
                      >
                        {reel.is_following_creator ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      </button>
                    </div>
                  )}

                  {/* Like */}
                  <button onClick={() => handleToggleLike(reel)} className="flex flex-col items-center gap-1 group cursor-pointer">
                    <div className={`p-2.5 rounded-full backdrop-blur-md transition group-active:scale-125 ${isLiked ? 'text-rose-500' : 'text-white'}`}>
                      <Heart className={`w-7 h-7 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </div>
                    <span className="text-[11px] font-bold drop-shadow">{likesCount}</span>
                  </button>

                  {/* Comment */}
                  <button onClick={() => handleOpenComments(reel)} className="flex flex-col items-center gap-1 cursor-pointer">
                    <div className="p-2.5 text-white backdrop-blur-md rounded-full transition group-active:scale-110">
                      <MessageCircle className="w-7 h-7" />
                    </div>
                    <span className="text-[11px] font-bold drop-shadow">{commentsCount}</span>
                  </button>

                  {/* Save */}
                  <button onClick={() => handleToggleSave(reel)} className="flex flex-col items-center gap-1 cursor-pointer">
                    <div className={`p-2.5 rounded-full backdrop-blur-md transition group-active:scale-110 ${isSaved ? 'text-amber-400' : 'text-white'}`}>
                      <Bookmark className={`w-7 h-7 ${isSaved ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </div>
                    <span className="text-[11px] font-bold drop-shadow">{reel.saves_count}</span>
                  </button>

                  {/* Share */}
                  <button onClick={() => setShareModalReel(reel)} className="flex flex-col items-center gap-1 cursor-pointer">
                    <div className="p-2.5 text-white backdrop-blur-md rounded-full transition">
                      <Share2 className="w-7 h-7" />
                    </div>
                    <span className="text-[11px] font-bold drop-shadow">{reel.shares_count}</span>
                  </button>

                  {/* Report */}
                  {onOpenReport && (
                    <button onClick={() => onOpenReport('reel', reel.id, reel.title)} className="cursor-pointer">
                      <div className="p-2 text-white/80 hover:text-white transition">
                        <MoreVertical className="w-6 h-6" />
                      </div>
                    </button>
                  )}

                  {/* Spinning vinyl disc */}
                  <div className="relative mt-1">
                    <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-700 overflow-hidden animate-spin flex items-center justify-center shadow-lg" style={{ animationDuration: '3s' }}>
                      <img
                        src={reel.creator?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'}
                        alt="track"
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom content — title, creator, property pill, action buttons */}
                <div className="absolute left-4 right-16 z-20 space-y-2 text-white"
                  style={{
                    bottom: 'calc(env(safe-area-inset-bottom) + 4rem)',
                  }}>
                  {reel.creator && (
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-white drop-shadow">
                        @{reel.creator.agency_name || reel.creator.full_name}
                      </span>
                      {reel.creator.verified && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase bg-emerald-500 text-white px-1.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                  )}

                  <h3 className="font-bold text-sm line-clamp-1 drop-shadow-sm">{reel.title}</h3>
                  {reel.caption && (
                    <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">{reel.caption}</p>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-slate-300 font-medium">
                    <Music className="w-3.5 h-3.5 animate-pulse shrink-0" />
                    <span className="truncate">Original Audio · @{reel.creator?.full_name || 'IndoProperty'}</span>
                  </div>

                  {reel.property && (
                    <div
                      onClick={() => onOpenProperty(reel.property!)}
                      className="p-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-2xl border border-white/20 cursor-pointer transition flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                          <Building className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <span className="font-bold block truncate">{reel.property.title}</span>
                          <span className="text-[11px] text-emerald-300 font-extrabold">
                            {formatPrice(reel.property.price, reel.property.listing_type)}
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-white text-slate-900 font-bold text-[10px] rounded-lg shrink-0">View</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {onOpenDirectChat && (
                      <button
                        onClick={() => onOpenDirectChat(reel.user_id || reel.creator?.id || '', reel.property, reel)}
                        className="flex-1 py-2.5 bg-purple-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Direct Chat
                      </button>
                    )}
                    {(() => {
                      const isBoosted = boostedReelIds.has(reel.id) || reel.boosted;
                      const isBoosting = boostingReelId === reel.id;
                      return (
                        <button
                          onClick={() => handleBoostReel(reel)}
                          disabled={isBoosted || isBoosting}
                          className={`flex-1 py-2.5 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition ${
                            isBoosted
                              ? 'bg-amber-100 text-amber-700 border border-amber-300'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 hover:opacity-95'
                          } disabled:cursor-not-allowed`}
                        >
                          {isBoosted ? (
                            <><Star className="w-3.5 h-3.5 fill-amber-500" /> Boosted</>
                          ) : isBoosting ? (
                            <><Coins className="w-3.5 h-3.5 animate-pulse" /> Boosting…</>
                          ) : (
                            <><Coins className="w-3.5 h-3.5" /> Boost (30)</>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Comments drawer */}
      {commentDrawerReel && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-in slide-in-from-bottom duration-300">
          <div className="bg-white rounded-t-3xl p-5 max-h-[70%] flex flex-col text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" /> Comments ({commentsList.length})
              </h4>
              <button onClick={() => setCommentDrawerReel(null)} className="text-slate-400 hover:text-slate-800 font-bold">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {commentsList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Be the first to comment!</p>
              ) : commentsList.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5 text-xs">
                  <img src={c.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                    alt={c.user?.full_name || 'User'} className="w-7 h-7 rounded-full object-cover border mt-0.5" />
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 font-semibold">{c.user?.full_name || 'User'}</strong>
                      <span className="text-[10px] text-slate-400">Just now</span>
                    </div>
                    <p className="text-slate-700 mt-1">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handlePostComment} className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <input
                type="text" value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Add a public comment..."
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button type="submit" disabled={!newCommentText.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold disabled:opacity-40">
                Post
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Share modal */}
      <ShareModal
        isOpen={Boolean(shareModalReel)}
        onClose={() => setShareModalReel(null)}
        title={shareModalReel?.title || 'Property Reel'}
        text={shareModalReel?.caption || shareModalReel?.title}
        url="https://play.google.com/store/apps/details?id=com.swaraj.realestate&pcampaignid=web_share"
        imageUrl={shareModalReel?.thumbnail_url}
      />
    </div>
  );
};
