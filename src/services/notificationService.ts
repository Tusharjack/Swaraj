import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Notification } from '../types/database';
import { STORAGE_KEYS, getLocalState, setLocalState } from './storage';

// ---------------------------------------------------------------------------
// NOTIFICATION SERVICE
// In-app notifications are generated server-side by database triggers (see
// NOTIFICATIONS_UPGRADE.sql). This service reads them, tracks read/unread
// state, and subscribes to realtime inserts so the badge updates instantly.
// When Supabase is not configured it falls back to localStorage so the UI
// still works in dev/demo mode.
// ---------------------------------------------------------------------------

function readLocal(userId: string): Notification[] {
  const all = getLocalState<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  return all.filter(n => n.user_id === userId);
}

export const notificationService = {
  /** All notifications for a user, newest first. */
  async getNotifications(userId: string): Promise<Notification[]> {
    if (!isSupabaseConfigured || !userId) return readLocal(userId);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(`Failed to load notifications: ${error.message}`);
    return (data ?? []) as Notification[];
  },

  /** Number of unread notifications (drives the badge / unread count). */
  async getUnreadCount(userId: string): Promise<number> {
    if (!isSupabaseConfigured || !userId) {
      return readLocal(userId).filter(n => !n.read).length;
    }
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) return 0;
    return count ?? 0;
  },

  async markAsRead(notificationId: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const all = getLocalState<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
      setLocalState(STORAGE_KEYS.NOTIFICATIONS, all.map(n => n.id === notificationId ? { ...n, read: true } : n));
      return;
    }
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    if (error) throw new Error(`Failed to update notification: ${error.message}`);
  },

  async markAllAsRead(userId: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const all = getLocalState<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
      setLocalState(STORAGE_KEYS.NOTIFICATIONS, all.map(n => n.user_id === userId ? { ...n, read: true } : n));
      return;
    }
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw new Error(`Failed to mark notifications as read: ${error.message}`);
  },

  async deleteNotification(notificationId: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const all = getLocalState<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
      setLocalState(STORAGE_KEYS.NOTIFICATIONS, all.filter(n => n.id !== notificationId));
      return;
    }
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    if (error) throw new Error(`Failed to delete notification: ${error.message}`);
  },

  /**
   * Realtime subscription for new notifications.
   * Returns an unsubscribe function.
   */
  subscribeToNotifications(
    userId: string,
    onInsert: (n: Notification) => void
  ): () => void {
    if (!isSupabaseConfigured || !userId) return () => {};
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => onInsert(payload.new as Notification)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },

  // ── Saved search preferences (property-match notifications) ───────────────
  async getPreferences(userId: string): Promise<Record<string, unknown> | null> {
    if (!isSupabaseConfigured || !userId) return null;
    const { data } = await supabase
      .from('saved_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return data ?? null;
  },

  async savePreferences(userId: string, prefs: {
    city?: string | null;
    min_price?: number | null;
    max_price?: number | null;
    property_type?: string | null;
    listing_type?: string | null;
    bedrooms?: number | null;
    notify_matches?: boolean;
  }): Promise<void> {
    if (!isSupabaseConfigured || !userId) return;
    const { error } = await supabase
      .from('saved_preferences')
      .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw new Error(`Failed to save preferences: ${error.message}`);
  },
};
