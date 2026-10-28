import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Referral } from '../types/database';
import { STORAGE_KEYS, getLocalState, setLocalState } from './storage';
import { tokenService } from './tokenService';

/** Deterministic referral code from a UUID or ID — e.g. "IP-A1B2C3" */
function makeReferralCode(userId: string): string {
  const clean = userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return 'IP-' + (clean.slice(0, 6).padEnd(6, 'X'));
}

export const referralService = {

  /** Get or create the referral code for the current user */
  async getMyReferralCode(): Promise<string> {
    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const userId = sessionUser?.id || currentProfile?.id;
    if (!userId) return 'IP-GUEST';

    const defaultCode = makeReferralCode(userId);

    if (isSupabaseConfigured && sessionUser) {
      try {
        // Check if user already has a pending referral row
        const { data: existing } = await supabase
          .from('referrals')
          .select('referral_code')
          .eq('referrer_id', sessionUser.id)
          .eq('status', 'pending')
          .limit(1)
          .maybeSingle();

        if (existing?.referral_code) return existing.referral_code;

        // Generate code and insert placeholder pending referral row
        await supabase.from('referrals').insert({
          referrer_id: sessionUser.id,
          referral_code: defaultCode,
          status: 'pending',
          reward_tokens: 50,
        });
      } catch (err) {
        console.warn('[Referral] Supabase code query error, using deterministic code:', err);
      }
    }

    // Local state fallback
    const allRefs = getLocalState<Referral[]>(STORAGE_KEYS.REFERRALS, []);
    let userPending = allRefs.find(r => r.referrer_id === userId && r.status === 'pending');
    if (!userPending) {
      userPending = {
        id: `ref-${Date.now()}`,
        created_at: new Date().toISOString(),
        referrer_id: userId,
        referral_code: defaultCode,
        status: 'pending',
        reward_tokens: 50
      };
      allRefs.push(userPending);
      setLocalState(STORAGE_KEYS.REFERRALS, allRefs);
    }

    return userPending.referral_code || defaultCode;
  },

  /** Get all referrals made by the current user */
  async getMyReferrals(): Promise<Referral[]> {
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
          .from('referrals')
          .select('*, referred:profiles!referred_id(full_name, email, avatar_url)')
          .eq('referrer_id', sessionUser.id)
          .order('created_at', { ascending: false });

        if (!error && data) return data as Referral[];
      } catch (err) {
        console.warn('[Referral] Supabase getMyReferrals error:', err);
      }
    }

    const all = getLocalState<Referral[]>(STORAGE_KEYS.REFERRALS, []);
    return all.filter(r => r.referrer_id === userId);
  },

  /**
   * Apply a referral code during/after signup.
   * Handles fraud prevention (anti-abuse, self-referral, duplicate prevention).
   */
  async applyReferralCode(code: string): Promise<{ success: boolean; message: string }> {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return { success: false, message: 'Please enter a valid referral code.' };

    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const userId = sessionUser?.id || currentProfile?.id;
    if (!userId) return { success: false, message: 'You must be signed in to apply a referral code.' };

    // Try RPC first if Supabase is connected
    if (isSupabaseConfigured && sessionUser) {
      try {
        const { data, error } = await supabase.rpc('apply_referral_code', {
          p_code: cleanCode,
          p_referred_id: sessionUser.id
        });

        if (!error) {
          return { success: true, message: data ?? 'Referral applied successfully! 25 bonus tokens credited.' };
        } else if (error.message.includes('already redeemed') || error.message.includes('own referral code') || error.message.includes('not found')) {
          return { success: false, message: error.message };
        }
      } catch (err: any) {
        console.warn('[Referral] RPC error, testing local fallback:', err?.message);
      }
    }

    // Local / Client-side anti-fraud fallback
    const allRefs = getLocalState<Referral[]>(STORAGE_KEYS.REFERRALS, []);
    const profiles = getLocalState<any[]>(STORAGE_KEYS.PROFILES, []);

    // 1. Anti-abuse: Check if user already redeemed a referral
    const alreadyUsed = allRefs.some(r => r.referred_id === userId && (r.status === 'rewarded' || r.status === 'completed'));
    if (alreadyUsed) {
      return { success: false, message: 'You have already redeemed a referral code on this account.' };
    }

    // 2. Find referrer
    let referrerId: string | null = null;
    const matchingRef = allRefs.find(r => r.referral_code.toUpperCase() === cleanCode && r.status !== 'invalid');
    if (matchingRef) {
      referrerId = matchingRef.referrer_id;
    } else {
      const matchProf = profiles.find(p => makeReferralCode(p.id) === cleanCode);
      if (matchProf) referrerId = matchProf.id;
    }

    if (!referrerId) {
      // Allow demo code IP-DEMO01
      if (cleanCode === 'IP-DEMO01') referrerId = 'demo-referrer';
      else return { success: false, message: `Referral code "${cleanCode}" was not found or is invalid.` };
    }

    // 3. Self-referral prohibition
    if (referrerId === userId) {
      return { success: false, message: 'You cannot use your own referral code.' };
    }

    // 4. Reward both users
    await tokenService.adminAdjustTokens(referrerId, 50, 'earned_referral', `Referral bonus for inviting new user`);
    await tokenService.adminAdjustTokens(userId, 25, 'earned_referred', `Welcome bonus for using referral code ${cleanCode}`);

    // 5. Update referrals table
    allRefs.unshift({
      id: `ref-reward-${Date.now()}`,
      created_at: new Date().toISOString(),
      referrer_id: referrerId,
      referred_id: userId,
      referral_code: cleanCode,
      status: 'rewarded',
      reward_tokens: 50,
      rewarded_at: new Date().toISOString(),
      referred_email: currentProfile?.email
    });
    setLocalState(STORAGE_KEYS.REFERRALS, allRefs);

    return { success: true, message: 'Referral applied successfully! 25 bonus tokens have been added to your wallet.' };
  },

  /** Admin: get all referrals platform-wide */
  async getAllReferrals(): Promise<Referral[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('referrals')
          .select(`
            *,
            referrer:profiles!referrer_id(full_name, email, avatar_url),
            referred:profiles!referred_id(full_name, email, avatar_url)
          `)
          .order('created_at', { ascending: false });

        if (!error && data) return data as Referral[];
      } catch (err) {
        console.warn('[Referral] Supabase getAllReferrals error:', err);
      }
    }

    return getLocalState<Referral[]>(STORAGE_KEYS.REFERRALS, []);
  },

  /** Admin: mark referral invalid (fake/duplicate detection) */
  async invalidateReferral(referralId: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('referrals')
          .update({ status: 'invalid' })
          .eq('id', referralId);
      } catch (_e) {}
    }

    const all = getLocalState<Referral[]>(STORAGE_KEYS.REFERRALS, []);
    const updated = all.map(r => r.id === referralId ? { ...r, status: 'invalid' as const } : r);
    setLocalState(STORAGE_KEYS.REFERRALS, updated);
  },
};
