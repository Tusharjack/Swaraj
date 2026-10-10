import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Bookmark, Share2, Send, Building, Volume2, VolumeX, Plus, Check, Play, ShieldCheck, MessageSquare, Camera, Music, MoreVertical } from 'lucide-react';
import type { Reel, ReelComment, Property, Profile } from '../types/database';
import { api } from '../services/api';
import { formatPrice } from './PropertyCard';
import { resolveMediaUrl } from '../services/mediaStore';
import { ShareModal } from './ShareModal';

export const ReelVideoPlayer: React.FC<{
  reel: Reel;
  isMuted: boolean;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onClick: () => void;
  onDoubleClick: () => void;
}> = React.memo(({ reel, isMuted, onVideoRef, onClick, onDoubleClick }) => {
  const [videoSrc, setVideoSrc] = useState<string>(reel.video_url);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reel.video_url?.startsWith('idb://')) {
      resolveMediaUrl(reel.video_url).then(resolved => setVideoSrc(resolved));
    } else {
      setVideoSrc(reel.video_url);
    }
  }, [reel.video_url]);

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
      src={videoSrc}
      poster={reel.thumbnail_url}
      loop
      muted={isMuted}
      playsInline
      preload="auto"
      onClick={handleClick}
      className="w-full h-full object-cover cursor-pointer select-none"
    />
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.reel.id === nextProps.reel.id &&
    prevProps.reel.video_url === nextProps.reel.video_url &&
    prevProps.isMuted === nextProps.isMuted
  );
});

interface ReelsFeedProps {
  reels: Reel[];
  onOpenProperty: (property: Property) => void;
  onOpenEnquiry: (reel: Reel) => void;
  currentUser: Profile | null;
  onRefreshReels: () => void;
  onOpenCreateReel?: () => void;
  onOpenDirectChat?: (recipientId: string, property?: Property, reel?: Reel) => void;
  onOpenReport?: (target_type: 'reel' | 'property' | 'user' | 'comment', target_id: string, target_label?: string) => void;
  onOpenAuth?: () => void;
}

export const ReelsFeed: React.FC<ReelsFeedProps> = ({
  reels,
  onOpenProperty,
  onOpenEnquiry,
  currentUser,
  onRefreshReels,
  onOpenCreateReel,
  onOpenDirectChat,
  onOpenReport,
  onOpenAuth
}) => {
  const [activeReelIdx, setActiveReelIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
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

  const pendingLikesRef = useRef<Set<string>>(new Set());
  const pendingSavesRef = useRef<Set<string>>(new Set());

  // Autoplay visible reel using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const reelId = entry.target.getAttribute('data-reel-id');
          if (!reelId) return;

          const videoEl = videoRefs.current[reelId];
          if (videoEl) {
            if (entry.isIntersecting) {
              videoEl.play().catch(() => {});
              setIsPlaying(true);
              const idx = reels.findIndex(r => r.id === reelId);
              if (idx !== -1) setActiveReelIdx(idx);
            } else {
              videoEl.pause();
            }
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

  const handleToggleLike = async (reel: Reel) => {
    if (!currentUser) {
      if (onOpenAuth) onOpenAuth();
      else alert('Please sign in to like reels.');
      return;
    }
    if (pendingLikesRef.current.has(reel.id)) return;
    pendingLikesRef.current.add(reel.id);

    const currentIsLiked = localLikeStates[reel.id]?.isLiked ?? reel.is_liked_by_user ?? false;
    const currentCount = localLikeStates[reel.id]?.count ?? reel.likes_count ?? 0;
    const nextIsLiked = !currentIsLiked;
    const nextCount = Math.max(0, currentCount + (nextIsLiked ? 1 : -1));

    setLocalLikeStates(prev => ({
      ...prev,
      [reel.id]: { isLiked: nextIsLiked, count: nextCount }
    }));

    try {
      const { isLiked, count } = await api.toggleLikeReel(reel.id);
      setLocalLikeStates(prev => ({
        ...prev,
        [reel.id]: { isLiked, count: typeof count === 'number' ? count : nextCount }
      }));
    } catch (_e) {
      // Optimistic update retained
    } finally {
      pendingLikesRef.current.delete(reel.id);
    }
  };

  const handleDoubleTap = (reel: Reel) => {
    setDoubleTapHeart({ reelId: reel.id, show: true });
    setTimeout(() => {
      setDoubleTapHeart({ reelId: '', show: false });
    }, 1000);

    const currentIsLiked = localLikeStates[reel.id]?.isLiked ?? reel.is_liked_by_user ?? false;
    if (!currentIsLiked) {
      handleToggleLike(reel);
    }
  };

  const handleToggleSave = async (reel: Reel) => {
    if (!currentUser) {
      if (onOpenAuth) onOpenAuth();
      else alert('Please sign in to save reels.');
      return;
    }
    if (pendingSavesRef.current.has(reel.id)) return;
    pendingSavesRef.current.add(reel.id);

    const currentIsSaved = localSaveStates[reel.id] ?? reel.is_saved_by_user ?? false;
    const nextIsSaved = !currentIsSaved;
    setLocalSaveStates(prev => ({ ...prev, [reel.id]: nextIsSaved }));

    try {
      const nowSaved = await api.toggleSaveReel(reel.id);
      setLocalSaveStates(prev => ({ ...prev, [reel.id]: nowSaved }));
    } catch (_e) {
      // Optimistic update retained
    } finally {
      pendingSavesRef.current.delete(reel.id);
    }
  };

  const handleToggleFollow = async (creatorId: string) => {
    if (!currentUser) {
      if (onOpenAuth) onOpenAuth();
      else alert('Please sign in to follow creators.');
      return;
    }
    await api.toggleFollowCreator(creatorId);
    onRefreshReels();
  };

  const handleOpenComments = async (reel: Reel) => {
    setCommentDrawerReel(reel);
    try {
      const comments = await api.getReelComments(reel.id);
      setCommentsList(comments);
    } catch (_e) {
      setCommentsList([]);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !commentDrawerReel) return;
    if (!currentUser) {
      if (onOpenAuth) onOpenAuth();
      else alert('Please sign in to post comments.');
      return;
    }
    const text = newCommentText.trim();
    setNewCommentText('');

    const tempComment: ReelComment = {
      id: `comm-${Date.now()}`,
      created_at: new Date().toISOString(),
      reel_id: commentDrawerReel.id,
      user_id: currentUser.id,
      content: text,
      user: currentUser
    };

    setCommentsList(prev => [...prev, tempComment]);
    setLocalCommentCounts(prev => ({
      ...prev,
      [commentDrawerReel.id]: (prev[commentDrawerReel.id] ?? commentDrawerReel.comments_count ?? 0) + 1
    }));

    try {
      await api.addReelComment(commentDrawerReel.id, text);
      const updated = await api.getReelComments(commentDrawerReel.id);
      setCommentsList(updated);
    } catch (_e) {
      // Temp comment stays visible locally
    }
  };

  const handleShare = (reel: Reel) => {
    setShareModalReel(reel);
  };

  return (
    <div className="relative w-full h-full md:max-w-[430px] bg-black md:rounded-3xl overflow-hidden shadow-2xl border border-slate-800/80 font-sans select-none">
      {/* Top Header Overlay Bar (Instagram Style) */}
      <div className="absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm tracking-wide text-white drop-shadow flex items-center gap-1.5">
            Reels
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenCreateReel && (
            <button
              onClick={onOpenCreateReel}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-90 text-white font-extrabold text-xs rounded-full shadow-lg shadow-rose-500/30 flex items-center gap-1 transition active:scale-95 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" /> + Reel
            </button>
          )}

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 bg-black/40 backdrop-blur-md text-white rounded-full hover:bg-black/60 transition cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Vertical Snap Scroll Container */}
      <div className="w-full h-full overflow-y-scroll snap-y-mandatory no-scrollbar">
        {reels.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white bg-slate-950 space-y-4">
            <div className="p-5 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 rounded-full shadow-2xl shadow-rose-500/40 animate-pulse">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h3 className="text-lg font-black tracking-wide">No Video Reels Available</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                There are no published property reels yet. Be the first to upload an Instagram-style short property video tour!
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onRefreshReels}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Refresh Feed
              </button>
              {onOpenCreateReel && (
                <button
                  onClick={onOpenCreateReel}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-500/30 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Post Reel
                </button>
              )}
            </div>
          </div>
        ) : (
          reels.map((reel, idx) => {
            const isLiked = localLikeStates[reel.id]?.isLiked ?? reel.is_liked_by_user ?? false;
            const likesCount = localLikeStates[reel.id]?.count ?? reel.likes_count ?? 0;
            const isSaved = localSaveStates[reel.id] ?? reel.is_saved_by_user ?? false;
            const commentsCount = localCommentCounts[reel.id] ?? reel.comments_count ?? 0;

            return (
              <div
                key={reel.id}
                id={`reel-container-${reel.id}`}
                data-reel-id={reel.id}
                className="relative w-full h-full snap-start-reel shrink-0 flex items-center justify-center bg-slate-900 overflow-hidden"
              >
                {/* Video Element */}
                <ReelVideoPlayer
                  reel={reel}
                  isMuted={isMuted}
                  onVideoRef={(el) => {
                    videoRefs.current[reel.id] = el;
                  }}
                  onClick={() => {
                    const el = videoRefs.current[reel.id];
                    if (el) {
                      if (el.paused) {
                        el.play().catch(() => {});
                        setIsPlaying(true);
                      } else {
                        el.pause();
                        setIsPlaying(false);
                      }
                    }
                  }}
                  onDoubleClick={() => handleDoubleTap(reel)}
                />

                {/* Double Tap Floating Heart Animation (Instagram Signature!) */}
                {doubleTapHeart.show && doubleTapHeart.reelId === reel.id && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    <Heart className="w-28 h-28 text-rose-500 fill-rose-500 animate-in zoom-in-50 fade-in duration-300 drop-shadow-2xl" />
                  </div>
                )}

                {/* Play/Pause overlay indicator when tapped */}
                {!isPlaying && activeReelIdx === idx && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                    <div className="p-4 bg-black/60 backdrop-blur-md rounded-full text-white">
                      <Play className="w-8 h-8 fill-current translate-x-0.5" />
                    </div>
                  </div>
                )}

                {/* Gradient Overlay at Bottom for Readable Text */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                {/* Right Action Sidebar (Instagram Style: Like, Comment, Save, Share, Report) */}
                <div className="absolute right-3 bottom-16 z-20 flex flex-col items-center gap-4 text-white">
                  {/* Creator Avatar with Instagram Story Ring */}
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
                        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full p-0.5 shadow transition ${
                          reel.is_following_creator ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                        }`}
                      >
                        {reel.is_following_creator ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      </button>
                    </div>
                  )}

                  {/* Like Button */}
                  <button
                    onClick={() => handleToggleLike(reel)}
                    className="flex flex-col items-center gap-1 group cursor-pointer"
                  >
                    <div className={`p-2.5 rounded-full backdrop-blur-md transition group-active:scale-125 ${
                      isLiked ? 'text-rose-500' : 'text-white hover:text-slate-300'
                    }`}>
                      <Heart className={`w-7 h-7 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </div>
                    <span className="text-[11px] font-bold drop-shadow">{likesCount}</span>
                  </button>

                  {/* Comment Button */}
                  <button
                    onClick={() => handleOpenComments(reel)}
                    className="flex flex-col items-center gap-1 group cursor-pointer"
                  >
                    <div className="p-2.5 text-white hover:text-slate-300 backdrop-blur-md rounded-full transition group-active:scale-110">
                      <MessageCircle className="w-7 h-7" />
                    </div>
                    <span className="text-[11px] font-bold drop-shadow">{commentsCount}</span>
                  </button>

                  {/* Save Reel Button */}
                  <button
                    onClick={() => handleToggleSave(reel)}
                    className="flex flex-col items-center gap-1 group cursor-pointer"
                  >
                    <div className={`p-2.5 rounded-full backdrop-blur-md transition group-active:scale-110 ${
                      isSaved ? 'text-amber-400' : 'text-white hover:text-slate-300'
                    }`}>
                      <Bookmark className={`w-7 h-7 ${isSaved ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </div>
                    <span className="text-[11px] font-bold drop-shadow">{reel.saves_count}</span>
                  </button>

                  {/* Share Button (Instagram Paper Plane) */}
                  <button
                    onClick={() => handleShare(reel)}
                    className="flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <div className="p-2.5 text-white hover:text-slate-300 backdrop-blur-md rounded-full transition">
                      <Share2 className="w-7 h-7" />
                    </div>
                    <span className="text-[11px] font-bold drop-shadow">{reel.shares_count}</span>
                  </button>

                  {/* Report Button / 3 Dots */}
                  {onOpenReport && (
                    <button
                      onClick={() => onOpenReport('reel', reel.id, reel.title)}
                      className="flex flex-col items-center gap-1 cursor-pointer"
                      title="More options / Report"
                    >
                      <div className="p-2 text-white/80 hover:text-white transition">
                        <MoreVertical className="w-6 h-6" />
                      </div>
                    </button>
                  )}

                  {/* Instagram Vinyl Audio Sound Disc */}
                  <div className="relative mt-1">
                    <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-700 overflow-hidden animate-spin duration-3000 flex items-center justify-center shadow-lg">
                      <img
                        src={reel.creator?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'}
                        alt="Audio track"
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Content Area (Title, Creator, Audio Ticker, Linked Property, Action Buttons) */}
                <div className="absolute left-4 right-16 bottom-6 z-20 space-y-2 text-white">
                  {/* Creator Info */}
                  {reel.creator && (
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-white drop-shadow">
                        @{reel.creator.agency_name || reel.creator.full_name}
                      </span>
                      {reel.creator.verified && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase bg-emerald-500 text-white px-1.5 py-0.2 rounded-full">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                  )}

                  {/* Title & Caption */}
                  <h3 className="font-bold text-sm line-clamp-1 drop-shadow-sm">{reel.title}</h3>
                  {reel.caption && (
                    <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed opacity-95">
                      {reel.caption}
                    </p>
                  )}

                  {/* Audio Ticker (Instagram Style Audio Bar) */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-300 font-medium">
                    <Music className="w-3.5 h-3.5 text-slate-200 animate-pulse shrink-0" />
                    <span className="truncate">Original Audio - @{reel.creator?.full_name || 'IndoProperty'}</span>
                  </div>

                  {/* LINKED PROPERTY PILL - Reel -> Property linkage */}
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
                      <span className="px-2.5 py-1 bg-white text-slate-900 font-bold text-[10px] rounded-lg shrink-0">
                        View
                      </span>
                    </div>
                  )}

                  {/* Send Direct Enquiry & Direct Chat Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {onOpenDirectChat && (
                      <button
                        onClick={() => onOpenDirectChat(reel.user_id || reel.creator?.id || 'user-broker-1', reel.property, reel)}
                        className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Direct Chat
                      </button>
                    )}
                    <button
                      onClick={() => onOpenEnquiry(reel)}
                      className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> Send Enquiry
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* COMMENTS DRAWER MODAL */}
      {commentDrawerReel && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-in slide-in-from-bottom duration-300">
          <div className="bg-white rounded-t-3xl p-5 max-h-[70%] flex flex-col text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" /> Comments ({commentsList.length})
              </h4>
              <button onClick={() => setCommentDrawerReel(null)} className="text-slate-400 hover:text-slate-800 font-bold">
                ✕
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {commentsList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Be the first to comment on this Reel!</p>
              ) : (
                commentsList.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5 text-xs">
                    <img
                      src={c.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                      alt={c.user?.full_name || 'User'}
                      className="w-7 h-7 rounded-full object-cover border mt-0.5"
                    />
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900 font-semibold">{c.user?.full_name || 'User'}</strong>
                        <span className="text-[10px] text-slate-400">Just now</span>
                      </div>
                      <p className="text-slate-700 mt-1">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input Form */}
            <form onSubmit={handlePostComment} className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Add a public comment..."
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-40 transition"
              >
                Post
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      <ShareModal
        isOpen={Boolean(shareModalReel)}
        onClose={() => setShareModalReel(null)}
        title={shareModalReel?.title || 'Property Reel'}
        text={shareModalReel?.caption || shareModalReel?.title}
        url={window.location.href}
        imageUrl={shareModalReel?.thumbnail_url}
      />
    </div>
  );
};
