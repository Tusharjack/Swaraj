import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { TokenTransaction, TokenWallet, TokenTransactionType } from '../types/database';
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
};
