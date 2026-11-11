import { supabase, isSupabaseConfigured, uploadFileToSupabase } from '../lib/supabase';
import type { Reel, ReelComment } from '../types/database';
import { STORAGE_KEYS, getLocalState, setLocalState } from './storage';
import { authService } from './authService';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Attach client-side flags (liked/saved/following) to a reel array. */
function attachClientFlags(reels: Reel[], likes: string[], saves: string[], following: string[]): Reel[] {
  return reels.map((r) => ({
    ...r,
    is_liked_by_user: likes.includes(r.id),
    is_saved_by_user: saves.includes(r.id),
    is_following_creator: r.user_id ? following.includes(r.user_id) : false
  }));
}

// ---------------------------------------------------------------------------
// SERVICE
// ---------------------------------------------------------------------------

export const reelService = {
  /**
   * Synchronous snapshot from Supabase is not possible; return an empty array.
   * App.tsx initialises reels state with this, then loadData() populates it.
   */
  getReelsSync(): Reel[] {
    return [];
  },

  /** Returns reels owned by userId from the local Supabase-fetched state if available. */
  getReelsForUserSync(userId: string): Reel[] {
    if (!userId) return [];
    // We no longer seed localStorage with reels, so nothing to return synchronously.
    return [];
  },

  /**
   * Fetch all published reels from Supabase with live cross-platform likes & comments counts.
   */
  async getReels(): Promise<Reel[]> {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      );
    }

    // Auto-expire any boosted reels whose boosted_until has passed
    try { await supabase.rpc('expire_featured_boosted'); } catch (_e) { /* non-fatal */ }

    const currentUser = await authService.getCurrentUser().catch(() => null);

    const { data: rawReels, error } = await supabase
      .from('reels')
      .select('*, creator:profiles(*), property:properties(*)')
      .order('boosted', { ascending: false })   // boosted reels first
      .order('created_at', { ascending: false }); // then newest first

    if (error) {
      throw new Error(`Failed to load reels: ${error.message}`);
    }

    // Fetch all likes, comments, and user interaction states in parallel for 100% accurate counts across platforms
    const [allLikesRes, allCommentsRes, userLikesRes, userSavesRes, userFollowsRes] = await Promise.all([
      supabase.from('reel_likes').select('reel_id'),
      supabase.from('reel_comments').select('reel_id'),
      currentUser ? supabase.from('reel_likes').select('reel_id').eq('user_id', currentUser.id) : Promise.resolve({ data: [] }),
      currentUser ? supabase.from('reel_saves').select('reel_id').eq('user_id', currentUser.id) : Promise.resolve({ data: [] }),
      currentUser ? supabase.from('followers').select('following_id').eq('follower_id', currentUser.id) : Promise.resolve({ data: [] }),
    ]);

    // Build real-time likes count per reel
    const likesCountMap: { [reelId: string]: number } = {};
    if (allLikesRes.data) {
      allLikesRes.data.forEach((row: any) => {
        if (row.reel_id) {
          likesCountMap[row.reel_id] = (likesCountMap[row.reel_id] || 0) + 1;
        }
      });
    }

    // Build real-time comments count per reel
    const commentsCountMap: { [reelId: string]: number } = {};
    if (allCommentsRes.data) {
      allCommentsRes.data.forEach((row: any) => {
        if (row.reel_id) {
          commentsCountMap[row.reel_id] = (commentsCountMap[row.reel_id] || 0) + 1;
        }
      });
    }

    const userLikes = userLikesRes.data ? (userLikesRes.data as any[]).map((r: any) => r.reel_id).filter(Boolean) : [];
    const userSaves = userSavesRes.data ? (userSavesRes.data as any[]).map((r: any) => r.reel_id).filter(Boolean) : [];
    const userFollows = userFollowsRes.data ? (userFollowsRes.data as any[]).map((r: any) => r.following_id).filter(Boolean) : [];

    const processedReels = (rawReels ?? []).map((reel: any) => {
      const realLikes = likesCountMap[reel.id] !== undefined ? likesCountMap[reel.id] : (reel.likes_count || 0);
      const realComments = commentsCountMap[reel.id] !== undefined ? commentsCountMap[reel.id] : (reel.comments_count || 0);
      return {
        ...reel,
        likes_count: realLikes,
        comments_count: realComments,
        is_liked_by_user: userLikes.includes(reel.id),
        is_saved_by_user: userSaves.includes(reel.id),
        is_following_creator: reel.user_id ? userFollows.includes(reel.user_id) : false
      };
    });

    return processedReels as Reel[];
  },

  async getReelById(id: string): Promise<Reel | null> {
    if (!id) return null;

    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('reels')
      .select('*, creator:profiles(*), property:properties(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load reel: ${error.message}`);
    }
    return data as Reel | null;
  },

  /**
   * Fetch reels belonging to a specific user (for the Professional Dashboard).
   * Filters strictly by user_id — no fuzzy email matching or catch-all fallthrough.
   */
  async getReelsForUser(userId: string): Promise<Reel[]> {
    if (!userId) return [];

    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('reels')
      .select('*, creator:profiles(*), property:properties(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load reels for user: ${error.message}`);
    }

    const likes = getLocalState<string[]>(STORAGE_KEYS.REEL_LIKES, []);
    const saves = getLocalState<string[]>(STORAGE_KEYS.REEL_SAVES, []);
    const following = getLocalState<string[]>(STORAGE_KEYS.FOLLOWERS, []);

    return attachClientFlags((data ?? []) as Reel[], likes, saves, following);
  },

  /**
   * Create a reel. video_url MUST be a publicly accessible HTTPS URL (from
   * Supabase Storage). Throws if not authenticated, not configured, or if the
   * video URL is a local blob/idb reference that other users cannot access.
   */
  async createReel(reelData: {
    title: string;
    caption?: string;
    video_url: string;
    thumbnail_url?: string;
    property_id?: string;
  }): Promise<Reel> {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Cannot upload reel. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      );
    }

    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to upload a video reel.');
    }

    // Reject local-only URLs — they cannot be shared with other users
    if (
      reelData.video_url.startsWith('idb://') ||
      reelData.video_url.startsWith('blob:') ||
      reelData.video_url.startsWith('data:')
    ) {
      throw new Error(
        'Video upload failed: the video must be stored in Supabase Storage to be visible to other users. ' +
        'Ensure Supabase Storage is configured and accessible.'
      );
    }

    // Resolve the linked property UUID if provided
    const propertyId = reelData.property_id ?? null;

    const { data, error } = await supabase
      .from('reels')
      .insert({
        user_id: currentUser.id,
        property_id: propertyId,
        video_url: reelData.video_url,
        thumbnail_url:
          reelData.thumbnail_url ||
          'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600',
        title: reelData.title,
        caption: reelData.caption || reelData.title,
        status: 'published',
        likes_count: 0,
        comments_count: 0,
        saves_count: 0,
        shares_count: 0,
        views_count: 0
      })
      .select('*, creator:profiles(*), property:properties(*)')
      .single();

    if (error) {
      throw new Error(
        `Failed to create reel: ${error.message}${error.details ? ` (${error.details})` : ''}`
      );
    }

    const reel = data as Reel;
    return {
      ...reel,
      creator: (data as any).creator ?? currentUser,
      property: (data as any).property ?? undefined,
      is_liked_by_user: false,
      is_saved_by_user: false,
      is_following_creator: false
    };
  },

  async toggleLikeReel(reelId: string): Promise<{ isLiked: boolean; count: number }> {
    if (!isSupabaseConfigured) {
      // UI-only fallback when Supabase not configured
      const likes = getLocalState<string[]>(STORAGE_KEYS.REEL_LIKES, []);
      const isLiked = likes.includes(reelId);
      setLocalState(
        STORAGE_KEYS.REEL_LIKES,
        isLiked ? likes.filter((id) => id !== reelId) : [...likes, reelId]
      );
      return { isLiked: !isLiked, count: 0 };
    }

    const currentUser = await authService.getCurrentUser();
    if (!currentUser) throw new Error('You must be logged in to like reels.');

    const { data: existing } = await supabase
      .from('reel_likes')
      .select('id')
      .eq('reel_id', reelId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    let isLiked: boolean;
    if (existing) {
      await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', currentUser.id);
      isLiked = false;
    } else {
      await supabase.from('reel_likes').insert({ reel_id: reelId, user_id: currentUser.id });
      isLiked = true;
    }

    // Get accurate count from DB
    const { count } = await supabase
      .from('reel_likes')
      .select('*', { count: 'exact', head: true })
      .eq('reel_id', reelId);

    const realCount = count ?? 0;
    // Update denormalised count column
    await supabase.from('reels').update({ likes_count: realCount }).eq('id', reelId);

    // Update local flag cache
    const likes = getLocalState<string[]>(STORAGE_KEYS.REEL_LIKES, []);
    setLocalState(
      STORAGE_KEYS.REEL_LIKES,
      isLiked ? [...likes, reelId] : likes.filter((id) => id !== reelId)
    );

    return { isLiked, count: realCount };
  },

  async toggleSaveReel(reelId: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      const saves = getLocalState<string[]>(STORAGE_KEYS.REEL_SAVES, []);
      const isSaved = saves.includes(reelId);
      setLocalState(
        STORAGE_KEYS.REEL_SAVES,
        isSaved ? saves.filter((id) => id !== reelId) : [...saves, reelId]
      );
      return !isSaved;
    }

    const currentUser = await authService.getCurrentUser();
    if (!currentUser) throw new Error('You must be logged in to save reels.');

    const { data: existing } = await supabase
      .from('reel_saves')
      .select('id')
      .eq('reel_id', reelId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    let isSaved: boolean;
    if (existing) {
      await supabase.from('reel_saves').delete().eq('reel_id', reelId).eq('user_id', currentUser.id);
      isSaved = false;
    } else {
      await supabase.from('reel_saves').insert({ reel_id: reelId, user_id: currentUser.id });
      isSaved = true;
    }

    const saves = getLocalState<string[]>(STORAGE_KEYS.REEL_SAVES, []);
    setLocalState(
      STORAGE_KEYS.REEL_SAVES,
      isSaved ? [...saves, reelId] : saves.filter((id) => id !== reelId)
    );
    return isSaved;
  },

  async toggleFollowCreator(creatorId: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      const following = getLocalState<string[]>(STORAGE_KEYS.FOLLOWERS, []);
      const isFollowing = following.includes(creatorId);
      setLocalState(
        STORAGE_KEYS.FOLLOWERS,
        isFollowing ? following.filter((id) => id !== creatorId) : [...following, creatorId]
      );
      return !isFollowing;
    }

    const currentUser = await authService.getCurrentUser();
    if (!currentUser) throw new Error('You must be logged in to follow creators.');

    const { data: existing } = await supabase
      .from('followers')
      .select('id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', creatorId)
      .maybeSingle();

    let isFollowing: boolean;
    if (existing) {
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', creatorId);
      isFollowing = false;
    } else {
      await supabase
        .from('followers')
        .insert({ follower_id: currentUser.id, following_id: creatorId });
      isFollowing = true;
    }

    const following = getLocalState<string[]>(STORAGE_KEYS.FOLLOWERS, []);
    setLocalState(
      STORAGE_KEYS.FOLLOWERS,
      isFollowing ? [...following, creatorId] : following.filter((id) => id !== creatorId)
    );
    return isFollowing;
  },

  async getReelComments(reelId: string): Promise<ReelComment[]> {
    if (!isSupabaseConfigured) {
      return getLocalState<ReelComment[]>(STORAGE_KEYS.REEL_COMMENTS, []).filter(
        (c) => c.reel_id === reelId
      );
    }

    const { data, error } = await supabase
      .from('reel_comments')
      .select('*, user:profiles(*)')
      .eq('reel_id', reelId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load comments: ${error.message}`);
    }
    return (data ?? []) as ReelComment[];
  },

  async addReelComment(reelId: string, content: string): Promise<ReelComment> {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) throw new Error('You must be logged in to comment.');

    if (!isSupabaseConfigured) {
      // Fallback for non-configured env (comment visible only to commenter)
      const comment: ReelComment = {
        id: `comm-${Date.now()}`,
        created_at: new Date().toISOString(),
        reel_id: reelId,
        user_id: currentUser.id,
        content,
        user: currentUser
      };
      const comments = getLocalState<ReelComment[]>(STORAGE_KEYS.REEL_COMMENTS, []);
      comments.push(comment);
      setLocalState(STORAGE_KEYS.REEL_COMMENTS, comments);
      return comment;
    }

    const { data, error } = await supabase
      .from('reel_comments')
      .insert({ reel_id: reelId, user_id: currentUser.id, content })
      .select('*, user:profiles(*)')
      .single();

    if (error) {
      throw new Error(`Failed to post comment: ${error.message}`);
    }

    // Update denormalised count
    supabase
      .from('reels')
      .select('comments_count')
      .eq('id', reelId)
      .maybeSingle()
      .then(({ data: reel }) => {
        if (reel) {
          supabase
            .from('reels')
            .update({ comments_count: (reel.comments_count || 0) + 1 })
            .eq('id', reelId);
        }
      });

    return data as ReelComment;
  },

  async incrementReelViews(reelId: string): Promise<void> {
    if (!isSupabaseConfigured || !reelId) return;
    // Fire-and-forget
    supabase
      .from('reels')
      .select('views_count')
      .eq('id', reelId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          supabase
            .from('reels')
            .update({ views_count: (data.views_count || 0) + 1 })
            .eq('id', reelId);
        }
      });
  },

  /**
   * Upload a video file to Supabase Storage. Returns a public HTTPS URL.
   * Throws if Supabase is not configured — there is no local fallback because
   * local blobs cannot be shared with other users.
   */
  async uploadReelMedia(videoFile: File): Promise<string> {
    return uploadFileToSupabase('reels', videoFile);
  },

  async deleteReel(reelId: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('reels').delete().eq('id', reelId);
      if (error) {
        console.error('Supabase deleteReel error:', error.message);
      }
    }
    const cached = getLocalState<Reel[]>(STORAGE_KEYS.REELS, []);
    const filtered = cached.filter(r => r.id !== reelId);
    setLocalState(STORAGE_KEYS.REELS, filtered);
  }
};
