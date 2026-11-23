import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { TokenTransaction, TokenWallet, TokenTransactionType, PlatformSettings } from '../types/database';
import { STORAGE_KEYS, getLocalState, setLocalState } from './storage';

function getDefaultWallet(userId: string): TokenWallet {
  return {
    user_id: userId,
    balance: 50,
    total_earned: 50,
    total_spent: 0,
    updated_at: new Date().toISOString()
  };
}

export const tokenService = {

  /** Get wallet balance for the current user */
  async getMyWallet(): Promise<TokenWallet | null> {
    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const userId = sessionUser?.id || currentProfile?.id;
    if (!userId) return null;

    if (isSupabaseConfigured && sessionUser) {
      try {
        const { data, error } = await supabase
          .from('token_wallets')
          .select('*')
          .eq('user_id', sessionUser.id)
          .maybeSingle();

        if (!error && data) {
          const wallets = getLocalState<Record<string, TokenWallet>>(STORAGE_KEYS.TOKEN_WALLETS, {});
          wallets[userId] = data as TokenWallet;
          setLocalState(STORAGE_KEYS.TOKEN_WALLETS, wallets);
          return data as TokenWallet;
        }
      } catch (err) {
        console.warn('[Token] Supabase wallet query error, falling back to cached state:', err);
      }
    }

    // Local state fallback
    const wallets = getLocalState<Record<string, TokenWallet>>(STORAGE_KEYS.TOKEN_WALLETS, {});
    if (!wallets[userId]) {
      wallets[userId] = getDefaultWallet(userId);
      setLocalState(STORAGE_KEYS.TOKEN_WALLETS, wallets);
    }
    return wallets[userId];
  },

  /** Get transaction history for the current user */
  async getMyTransactions(): Promise<TokenTransaction[]> {
    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const userId = sessionUser?.id || currentProfile?.id;
    if (!userId) return [];

    if (isSupabaseConfigured && sessionUser) {
      try {
        const { data, error } = await supabase
          .from('token_transactions')
          .select('*, user:profiles(full_name, avatar_url, email)')
          .eq('user_id', sessionUser.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data && data.length > 0) {
          return data as TokenTransaction[];
        }
      } catch (err) {
        console.warn('[Token] Supabase tx query error:', err);
      }
    }

    // Local fallback
    const allTxns = getLocalState<TokenTransaction[]>(STORAGE_KEYS.TOKEN_TRANSACTIONS, [
      {
        id: `tx-welcome-${userId}`,
        created_at: new Date().toISOString(),
        user_id: userId,
        amount: 50,
        type: 'earned_referred',
        description: 'Welcome bonus platform credits'
      }
    ]);

    return allTxns.filter(t => t.user_id === userId);
  },

  /** Admin: get all transactions platform-wide */
  async getAllTransactions(): Promise<TokenTransaction[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('token_transactions')
          .select('*, user:profiles(full_name, avatar_url, email)')
          .order('created_at', { ascending: false })
          .limit(200);

        if (!error && data) return data as TokenTransaction[];
      } catch (_e) {}
    }

    return getLocalState<TokenTransaction[]>(STORAGE_KEYS.TOKEN_TRANSACTIONS, []);
  },

  /** Admin: get all wallets */
  async getAllWallets(): Promise<TokenWallet[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('token_wallets')
          .select('*')
          .order('balance', { ascending: false });

        if (!error && data) return data as TokenWallet[];
      } catch (_e) {}
    }

    const map = getLocalState<Record<string, TokenWallet>>(STORAGE_KEYS.TOKEN_WALLETS, {});
    return Object.values(map);
  },

  /** Admin: award or deduct tokens for a user */
  async adminAdjustTokens(
    userId: string,
    amount: number,
    type: TokenTransactionType,
    description: string
  ): Promise<void> {
    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const adminId = sessionUser?.id || currentProfile?.id || 'admin';

    if (isSupabaseConfigured) {
      try {
        await supabase.rpc('admin_adjust_tokens', {
          p_user_id: userId,
          p_amount: amount,
          p_type: type,
          p_description: description,
          p_admin_id: sessionUser?.id || adminId
        });
      } catch (_e) {}
    }

    // Always keep local state synchronized
    const wallets = getLocalState<Record<string, TokenWallet>>(STORAGE_KEYS.TOKEN_WALLETS, {});
    const w = wallets[userId] || getDefaultWallet(userId);
    const newBal = Math.max(0, w.balance + amount);
    wallets[userId] = {
      ...w,
      balance: newBal,
      total_earned: w.total_earned + (amount > 0 ? amount : 0),
      total_spent: w.total_spent + (amount < 0 ? Math.abs(amount) : 0),
      updated_at: new Date().toISOString()
    };
    setLocalState(STORAGE_KEYS.TOKEN_WALLETS, wallets);

    const txns = getLocalState<TokenTransaction[]>(STORAGE_KEYS.TOKEN_TRANSACTIONS, []);
    txns.unshift({
      id: `tx-admin-${Date.now()}`,
      created_at: new Date().toISOString(),
      user_id: userId,
      amount,
      type,
      description,
      admin_id: adminId
    });
    setLocalState(STORAGE_KEYS.TOKEN_TRANSACTIONS, txns);
  },

  /** Spend tokens to promote a property listing */
  async spendTokensForPromotion(
    propertyId: string,
    amount: number = 50
  ): Promise<void> {
    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const userId = sessionUser?.id || currentProfile?.id;
    if (!userId) throw new Error('You must be signed in to promote listings.');

    // Check balance first
    const wallet = await this.getMyWallet();
    if (!wallet || wallet.balance < amount) {
      throw new Error(`Insufficient tokens. You have ${wallet?.balance || 0} tokens, but ${amount} are required.`);
    }

    if (isSupabaseConfigured && sessionUser) {
      try {
        const { error } = await supabase.rpc('spend_tokens', {
          p_user_id: sessionUser.id,
          p_amount: amount,
          p_type: 'spent_promotion' as TokenTransactionType,
          p_description: `Premium property promotion`,
          p_reference_id: propertyId
        });

        if (!error) {
          // Update DB property featured status
          await supabase.from('properties').update({ featured: true }).eq('id', propertyId);
        }
      } catch (err) {
        console.warn('[Token] spend_tokens RPC fallback to client update:', err);
      }
    }

    // Update local wallet & transactions
    const wallets = getLocalState<Record<string, TokenWallet>>(STORAGE_KEYS.TOKEN_WALLETS, {});
    const w = wallets[userId] || getDefaultWallet(userId);
    wallets[userId] = {
      ...w,
      balance: Math.max(0, w.balance - amount),
      total_spent: w.total_spent + amount,
      updated_at: new Date().toISOString()
    };
    setLocalState(STORAGE_KEYS.TOKEN_WALLETS, wallets);

    const txns = getLocalState<TokenTransaction[]>(STORAGE_KEYS.TOKEN_TRANSACTIONS, []);
    txns.unshift({
      id: `tx-promo-${Date.now()}`,
      created_at: new Date().toISOString(),
      user_id: userId,
      amount: -amount,
      type: 'spent_promotion',
      description: `Promoted listing with ${amount} tokens`,
      reference_id: propertyId
    });
    setLocalState(STORAGE_KEYS.TOKEN_TRANSACTIONS, txns);
  },

  // ──────────────────────────────────────────────────────────────────────
  // PLATFORM SETTINGS — admin-configurable pricing for redemptions
  // ──────────────────────────────────────────────────────────────────────

  /** Get the admin-configurable pricing for featuring properties & boosting reels */
  async getPlatformSettings(): Promise<PlatformSettings> {
    const DEFAULTS: PlatformSettings = {
      id: 1,
      feature_property_cost: 50,
      feature_property_duration_days: 7,
      boost_reel_cost: 30,
      boost_reel_duration_days: 7,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (!error && data) return data as PlatformSettings;
      } catch (err) {
        console.warn('[Token] platform_settings query error, using defaults:', err);
      }
    }

    return DEFAULTS;
  },

  /** Admin: update platform pricing settings */
  async updatePlatformSettings(updates: Partial<PlatformSettings>): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('platform_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw new Error(`Failed to update settings: ${error.message}`);
    }
  },

  // ──────────────────────────────────────────────────────────────────────
  // GIFT COINS — peer-to-peer transfer via atomic Supabase RPC
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Gift coins to a friend using their registered email address.
   * Uses the `gift_coins` PostgreSQL RPC for an atomic, race-safe transfer
   * that validates the receiver, checks sender balance, prevents self-transfer,
   * and records both transactions + an in-app notification.
   *
   * Returns { success, receiverName, amount } on success.
   * Throws an Error with a human-readable message on any failure.
   */
  async giftCoins(
    receiverEmail: string,
    amount: number
  ): Promise<{ success: boolean; receiverName: string; amount: number }> {
    // ── Client-side validation (fast feedback before network round-trip) ──
    const cleanEmail = (receiverEmail || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter your friend\u2019s registered email address.');
    }
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('Please enter a valid whole-number coin amount.');
    }

    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    if (!sessionUser) {
      throw new Error('You must be signed in to gift coins.');
    }

    // Check balance before calling RPC (better UX error)
    const wallet = await this.getMyWallet();
    if (!wallet || wallet.balance < amount) {
      throw new Error(`Insufficient balance. You have ${wallet?.balance ?? 0} coins but tried to gift ${amount}.`);
    }

    if (isSupabaseConfigured && sessionUser) {
      const { data, error } = await supabase.rpc('gift_coins', {
        p_receiver_email: cleanEmail,
        p_amount: amount,
      });

      if (error) {
        // Supabase surfaces RAISE EXCEPTION messages in error.message
        throw new Error(error.message);
      }

      const result = (data || {}) as { success?: boolean; receiver_name?: string; amount?: number };
      return {
        success: true,
        receiverName: result.receiver_name || 'your friend',
        amount: result.amount ?? amount,
      };
    }

    // ── Local fallback (non-Supabase dev mode) ──────────────────────────
    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const senderId = sessionUser?.id || currentProfile?.id;
    const profiles = getLocalState<any[]>(STORAGE_KEYS.PROFILES, []);
    const receiver = profiles.find(
      (p) => (p.email || '').trim().toLowerCase() === cleanEmail
    );

    if (!receiver) throw new Error(`No registered user found with email ${cleanEmail}.`);
    if (receiver.id === senderId) throw new Error('You cannot gift coins to yourself.');

    const wallets = getLocalState<Record<string, TokenWallet>>(STORAGE_KEYS.TOKEN_WALLETS, {});
    const senderWallet = wallets[senderId] || getDefaultWallet(senderId);
    if (senderWallet.balance < amount) {
      throw new Error(`Insufficient balance. You have ${senderWallet.balance} coins but tried to gift ${amount}.`);
    }

    wallets[senderId] = {
      ...senderWallet,
      balance: senderWallet.balance - amount,
      total_spent: senderWallet.total_spent + amount,
      updated_at: new Date().toISOString(),
    };

    const receiverWallet = wallets[receiver.id] || getDefaultWallet(receiver.id);
    wallets[receiver.id] = {
      ...receiverWallet,
      balance: receiverWallet.balance + amount,
      total_earned: receiverWallet.total_earned + amount,
      updated_at: new Date().toISOString(),
    };
    setLocalState(STORAGE_KEYS.TOKEN_WALLETS, wallets);

    const txns = getLocalState<TokenTransaction[]>(STORAGE_KEYS.TOKEN_TRANSACTIONS, []);
    txns.unshift(
      {
        id: `tx-gift-out-${Date.now()}`,
        created_at: new Date().toISOString(),
        user_id: senderId,
        amount: -amount,
        type: 'gifted_sent',
        description: `Gifted ${amount} coins to ${receiver.full_name}`,
        reference_id: receiver.id,
      },
      {
        id: `tx-gift-in-${Date.now()}`,
        created_at: new Date().toISOString(),
        user_id: receiver.id,
        amount,
        type: 'gifted_received',
        description: `Received ${amount} coins as a gift from ${currentProfile?.full_name || 'a friend'}`,
        reference_id: senderId,
      }
    );
    setLocalState(STORAGE_KEYS.TOKEN_TRANSACTIONS, txns);

    // Local notification
    const notifs = getLocalState<any[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    notifs.unshift({
      id: `notif-gift-${Date.now()}`,
      created_at: new Date().toISOString(),
      user_id: receiver.id,
      title: '🎁 Coins Received!',
      message: `You received ${amount} Coins from ${currentProfile?.full_name || 'a friend'}!\nतुम्हाला ${currentProfile?.full_name || 'एक मित्र'} यांच्याकडून ${amount} कॉइन्स गिफ्ट मिळाले आहेत!`,
      type: 'system',
      read: false,
    });
    setLocalState(STORAGE_KEYS.NOTIFICATIONS, notifs);

    return { success: true, receiverName: receiver.full_name || 'your friend', amount };
  },

  /**
   * Gift coins to a friend using their registered phone number.
   * Mirrors giftCoins() but resolves the receiver via profiles.phone.
   * Requires the `gift_coins_by_phone(p_receiver_phone, p_amount)` RPC.
   */
  async giftCoinsByPhone(
    receiverPhone: string,
    amount: number
  ): Promise<{ success: boolean; receiverName: string; amount: number }> {
    const cleanPhone = (receiverPhone || '').trim().replace(/[^\d+]/g, '');
    if (!cleanPhone) {
      throw new Error('Please enter your friend\u2019s registered phone number.');
    }
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('Please enter a valid whole-number coin amount.');
    }

    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    if (!sessionUser) {
      throw new Error('You must be signed in to gift coins.');
    }

    const wallet = await this.getMyWallet();
    if (!wallet || wallet.balance < amount) {
      throw new Error(`Insufficient balance. You have ${wallet?.balance ?? 0} coins but tried to gift ${amount}.`);
    }

    if (isSupabaseConfigured && sessionUser) {
      const { data, error } = await supabase.rpc('gift_coins_by_phone', {
        p_receiver_phone: cleanPhone,
        p_amount: amount,
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = (data || {}) as { success?: boolean; receiver_name?: string; amount?: number };
      return {
        success: true,
        receiverName: result.receiver_name || 'your friend',
        amount: result.amount ?? amount,
      };
    }

    // ── Local fallback (non-Supabase dev mode) ──────────────────────────
    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const senderId = sessionUser?.id || currentProfile?.id;
    const profiles = getLocalState<any[]>(STORAGE_KEYS.PROFILES, []);
    const receiver = profiles.find((p) => (p.phone || '').replace(/[^\d+]/g, '') === cleanPhone);

    if (!receiver) throw new Error(`No registered user found with phone ${cleanPhone}.`);
    if (receiver.id === senderId) throw new Error('You cannot gift coins to yourself.');

    const wallets = getLocalState<Record<string, TokenWallet>>(STORAGE_KEYS.TOKEN_WALLETS, {});
    const senderWallet = wallets[senderId] || getDefaultWallet(senderId);
    if (senderWallet.balance < amount) {
      throw new Error(`Insufficient balance. You have ${senderWallet.balance} coins but tried to gift ${amount}.`);
    }

    wallets[senderId] = {
      ...senderWallet,
      balance: senderWallet.balance - amount,
      total_spent: senderWallet.total_spent + amount,
      updated_at: new Date().toISOString(),
    };

    const receiverWallet = wallets[receiver.id] || getDefaultWallet(receiver.id);
    wallets[receiver.id] = {
      ...receiverWallet,
      balance: receiverWallet.balance + amount,
      total_earned: receiverWallet.total_earned + amount,
      updated_at: new Date().toISOString(),
    };
    setLocalState(STORAGE_KEYS.TOKEN_WALLETS, wallets);

    const txns = getLocalState<TokenTransaction[]>(STORAGE_KEYS.TOKEN_TRANSACTIONS, []);
    txns.unshift(
      {
        id: `tx-gift-out-${Date.now()}`,
        created_at: new Date().toISOString(),
        user_id: senderId,
        amount: -amount,
        type: 'gifted_sent',
        description: `Gifted ${amount} coins to ${receiver.full_name}`,
        reference_id: receiver.id,
      },
      {
        id: `tx-gift-in-${Date.now()}`,
        created_at: new Date().toISOString(),
        user_id: receiver.id,
        amount,
        type: 'gifted_received',
        description: `Received ${amount} coins as a gift from ${currentProfile?.full_name || 'a friend'}`,
        reference_id: senderId,
      }
    );
    setLocalState(STORAGE_KEYS.TOKEN_TRANSACTIONS, txns);

    const notifs = getLocalState<any[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    notifs.unshift({
      id: `notif-gift-${Date.now()}`,
      created_at: new Date().toISOString(),
      user_id: receiver.id,
      title: '🎁 Coins Received!',
      message: `You received ${amount} Coins from ${currentProfile?.full_name || 'a friend'}!`,
      type: 'system',
      read: false,
    });
    setLocalState(STORAGE_KEYS.NOTIFICATIONS, notifs);

    return { success: true, receiverName: receiver.full_name || 'your friend', amount };
  },

  // ──────────────────────────────────────────────────────────────────────
  // USE COINS — redeem coins to feature listings & boost reels
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Redeem coins to feature a property listing.
   * Calls the `redeem_coins_for_feature` RPC which validates ownership,
   * deducts coins atomically, and sets featured + auto-expiry.
   */
  async redeemForFeature(propertyId: string): Promise<{ cost: number; durationDays: number }> {
    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    if (!sessionUser) throw new Error('You must be signed in to feature a listing.');

    if (isSupabaseConfigured && sessionUser) {
      const { data, error } = await supabase.rpc('redeem_coins_for_feature', {
        p_property_id: propertyId,
      });

      if (error) throw new Error(error.message);

      const result = (data || {}) as { success?: boolean; cost?: number; duration_days?: number };
      return { cost: result.cost ?? 50, durationDays: result.duration_days ?? 7 };
    }

    // ── Local fallback ────────────────────────────────────────────────────
    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const userId = sessionUser?.id || currentProfile?.id;
    if (!userId) throw new Error('You must be signed in to feature a listing.');

    const settings = await this.getPlatformSettings();
    const cost = settings.feature_property_cost;
    const wallet = await this.getMyWallet();
    if (!wallet || wallet.balance < cost) {
      throw new Error(`Insufficient coins. You need ${cost} coins but have ${wallet?.balance ?? 0}.`);
    }

    const wallets = getLocalState<Record<string, TokenWallet>>(STORAGE_KEYS.TOKEN_WALLETS, {});
    const w = wallets[userId] || getDefaultWallet(userId);
    wallets[userId] = {
      ...w,
      balance: Math.max(0, w.balance - cost),
      total_spent: w.total_spent + cost,
      updated_at: new Date().toISOString(),
    };
    setLocalState(STORAGE_KEYS.TOKEN_WALLETS, wallets);

    const txns = getLocalState<TokenTransaction[]>(STORAGE_KEYS.TOKEN_TRANSACTIONS, []);
    txns.unshift({
      id: `tx-feature-${Date.now()}`,
      created_at: new Date().toISOString(),
      user_id: userId,
      amount: -cost,
      type: 'spent_promotion',
      description: `Featured property listing for ${settings.feature_property_duration_days} days`,
      reference_id: propertyId,
    });
    setLocalState(STORAGE_KEYS.TOKEN_TRANSACTIONS, txns);

    return { cost, durationDays: settings.feature_property_duration_days };
  },

  /**
   * Redeem coins to boost a property reel.
   * Calls the `redeem_coins_for_boost` RPC which validates ownership,
   * deducts coins atomically, and sets boosted + auto-expiry.
   */
  async redeemForBoost(reelId: string): Promise<{ cost: number; durationDays: number }> {
    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    if (!sessionUser) throw new Error('You must be signed in to boost a reel.');

    if (isSupabaseConfigured && sessionUser) {
      const { data, error } = await supabase.rpc('redeem_coins_for_boost', {
        p_reel_id: reelId,
      });

      if (error) throw new Error(error.message);

      const result = (data || {}) as { success?: boolean; cost?: number; duration_days?: number };
      return { cost: result.cost ?? 30, durationDays: result.duration_days ?? 7 };
    }

    // ── Local fallback ────────────────────────────────────────────────────
    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const userId = sessionUser?.id || currentProfile?.id;
    if (!userId) throw new Error('You must be signed in to boost a reel.');

    const settings = await this.getPlatformSettings();
    const cost = settings.boost_reel_cost;
    const wallet = await this.getMyWallet();
    if (!wallet || wallet.balance < cost) {
      throw new Error(`Insufficient coins. You need ${cost} coins but have ${wallet?.balance ?? 0}.`);
    }

    const wallets = getLocalState<Record<string, TokenWallet>>(STORAGE_KEYS.TOKEN_WALLETS, {});
    const w = wallets[userId] || getDefaultWallet(userId);
    wallets[userId] = {
      ...w,
      balance: Math.max(0, w.balance - cost),
      total_spent: w.total_spent + cost,
      updated_at: new Date().toISOString(),
    };
    setLocalState(STORAGE_KEYS.TOKEN_WALLETS, wallets);

    const txns = getLocalState<TokenTransaction[]>(STORAGE_KEYS.TOKEN_TRANSACTIONS, []);
    txns.unshift({
      id: `tx-boost-${Date.now()}`,
      created_at: new Date().toISOString(),
      user_id: userId,
      amount: -cost,
      type: 'spent_boost',
      description: `Boosted reel for ${settings.boost_reel_duration_days} days`,
      reference_id: reelId,
    });
    setLocalState(STORAGE_KEYS.TOKEN_TRANSACTIONS, txns);

    return { cost, durationDays: settings.boost_reel_duration_days };
  },

  /** Call the expire_featured_boosted RPC to auto-expire featured listings & boosted reels */
  async expireFeaturedBoosted(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.rpc('expire_featured_boosted');
      } catch (_e) {
        // Non-fatal — expiry also happens on next query
      }
    }
  },
};
