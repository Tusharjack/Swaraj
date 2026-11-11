/**
 * Coin Wallet, Referral & Redemption Tests
 *
 * Validates the requirements:
 *  1. Gift Coins — validation (empty phone, zero amount, insufficient balance, self-transfer)
 *  2. Referral correction — referrer gets +50, referred user gets 25 (from trigger, not duplicate)
 *  3. Redemption — feature property & boost reel deduct correct coins
 *  4. Platform settings — defaults returned when Supabase not configured
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase — declared BEFORE imports so module picks it up
// ---------------------------------------------------------------------------
vi.mock('../../lib/supabase', () => {
  function makeQb(overrides: Record<string, any> = {}): any {
    const qb: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      ...overrides,
    };
    return qb;
  }

  const defaultQb = makeQb();

  const supabaseMock = {
    from: vi.fn(() => defaultQb),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'sender-uuid-123' } } },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/f.jpg' } }),
      })),
    },
    _makeQb: makeQb,
  };

  return {
    supabase: supabaseMock,
    isSupabaseConfigured: true,
    uploadFileToSupabase: vi.fn().mockResolvedValue('https://example.com/f.jpg'),
    fileToBase64: vi.fn().mockResolvedValue('data:image/png;base64,abc'),
  };
});

// Import AFTER mock declaration
import { api } from '../api';
import { supabase } from '../../lib/supabase';
import { tokenService } from '../tokenService';
import { referralService } from '../referralService';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const STORAGE_KEYS = {
  CURRENT_USER: 'SWARAJ_CURRENT_USER',
  PROFILES: 'SWARAJ_PROFILES_STATE',
  TOKEN_WALLETS: 'SWARAJ_TOKEN_WALLETS_STATE',
  TOKEN_TRANSACTIONS: 'SWARAJ_TOKEN_TRANSACTIONS_STATE',
  REFERRALS: 'SWARAJ_REFERRALS_STATE',
  NOTIFICATIONS: 'SWARAJ_NOTIFICATIONS_STATE',
};

function ls(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper: set up a logged-in sender with a wallet balance
function setupSender(balance: number = 100) {
  const senderId = 'sender-uuid-123';
  ls(STORAGE_KEYS.CURRENT_USER, {
    id: senderId,
    email: 'sender@test.com',
    full_name: 'Test Sender',
    role: 'professional',
    phone: '+919876543210',
    verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  ls(STORAGE_KEYS.TOKEN_WALLETS, {
    [senderId]: { user_id: senderId, balance, total_earned: balance, total_spent: 0, updated_at: new Date().toISOString() },
  });
  return senderId;
}

// ===========================================================================
// GIFT COINS — validation & transfer
// ===========================================================================
describe('Gift Coins — input validation', () => {
  it('rejects an empty email address', async () => {
    setupSender(100);
    await expect(api.giftCoins('', 10)).rejects.toThrow(/email/i);
  });

  it('rejects a zero or negative amount', async () => {
    setupSender(100);
    await expect(api.giftCoins('friend@example.com', 0)).rejects.toThrow(/valid.*amount/i);
    await expect(api.giftCoins('friend@example.com', -5)).rejects.toThrow(/valid.*amount/i);
  });

  it('rejects when sender has insufficient balance', async () => {
    setupSender(5); // only 5 coins
    await expect(api.giftCoins('friend@example.com', 50)).rejects.toThrow(/insufficient balance/i);
  });
});

describe('Gift Coins — Supabase RPC transfer', () => {
  it('calls gift_coins RPC and returns success on valid transfer', async () => {
    setupSender(100);

    // Mock the wallet query to return a balance of 100
    const walletQb = (supabase as any)._makeQb({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { user_id: 'sender-uuid-123', balance: 100, total_earned: 100, total_spent: 0 },
        error: null,
      }),
    });
    (supabase as any).from = vi.fn(() => walletQb);

    // Mock the RPC to succeed
    (supabase as any).rpc = vi.fn().mockResolvedValue({
      data: { success: true, receiver_id: 'receiver-uuid-456', receiver_name: 'Test Friend', amount: 25 },
      error: null,
    });

    const result = await api.giftCoins('friend@example.com', 25);

    expect(result.success).toBe(true);
    expect(result.receiverName).toBe('Test Friend');
    expect(result.amount).toBe(25);
    // Verify RPC was called with the correct function name + params
    expect(supabase.rpc).toHaveBeenCalledWith('gift_coins', {
      p_receiver_email: 'friend@example.com',
      p_amount: 25,
    });
  });

  it('surfaces the RPC error message on failure (e.g. self-transfer)', async () => {
    setupSender(100);

    const walletQb = (supabase as any)._makeQb({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { user_id: 'sender-uuid-123', balance: 100, total_earned: 100, total_spent: 0 },
        error: null,
      }),
    });
    (supabase as any).from = vi.fn(() => walletQb);

    (supabase as any).rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'You cannot gift coins to yourself.' },
    });

    await expect(api.giftCoins('friend@example.com', 10)).rejects.toThrow(/cannot gift coins to yourself/i);
  });

  it('surfaces "user not found" when receiver email is not registered', async () => {
    setupSender(100);

    const walletQb = (supabase as any)._makeQb({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { user_id: 'sender-uuid-123', balance: 100, total_earned: 100, total_spent: 0 },
        error: null,
      }),
    });
    (supabase as any).from = vi.fn(() => walletQb);

    (supabase as any).rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'No registered user found with email nobody@example.com.' },
    });

    await expect(api.giftCoins('nobody@example.com', 10)).rejects.toThrow(/no registered user/i);
  });
});

// ===========================================================================
// REDEMPTION — feature property & boost reel
// ===========================================================================
describe('Redeem Coins — feature property', () => {
  it('calls redeem_coins_for_feature RPC with the property ID', async () => {
    setupSender(100);

    // Mock wallet balance check
    const walletQb = (supabase as any)._makeQb({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { user_id: 'sender-uuid-123', balance: 100, total_earned: 100, total_spent: 0 },
        error: null,
      }),
    });
    (supabase as any).from = vi.fn(() => walletQb);

    (supabase as any).rpc = vi.fn().mockResolvedValue({
      data: { success: true, cost: 50, duration_days: 7, expires_at: '2026-11-16T00:00:00Z' },
      error: null,
    });

    const result = await api.redeemForFeature('property-uuid-789');

    expect(result.cost).toBe(50);
    expect(result.durationDays).toBe(7);
    expect(supabase.rpc).toHaveBeenCalledWith('redeem_coins_for_feature', {
      p_property_id: 'property-uuid-789',
    });
  });

  it('surfaces insufficient coins error from RPC', async () => {
    setupSender(10);

    const walletQb = (supabase as any)._makeQb({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { user_id: 'sender-uuid-123', balance: 10, total_earned: 10, total_spent: 0 },
        error: null,
      }),
    });
    (supabase as any).from = vi.fn(() => walletQb);

    (supabase as any).rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Insufficient coins. You need 50 coins but have 10.' },
    });

    await expect(api.redeemForFeature('property-uuid-789')).rejects.toThrow(/insufficient coins/i);
  });
});

describe('Redeem Coins — boost reel', () => {
  it('calls redeem_coins_for_boost RPC with the reel ID', async () => {
    setupSender(100);

    const walletQb = (supabase as any)._makeQb({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { user_id: 'sender-uuid-123', balance: 100, total_earned: 100, total_spent: 0 },
        error: null,
      }),
    });
    (supabase as any).from = vi.fn(() => walletQb);

    (supabase as any).rpc = vi.fn().mockResolvedValue({
      data: { success: true, cost: 30, duration_days: 7, expires_at: '2026-11-16T00:00:00Z' },
      error: null,
    });

    const result = await api.redeemForBoost('reel-uuid-abc');

    expect(result.cost).toBe(30);
    expect(result.durationDays).toBe(7);
    expect(supabase.rpc).toHaveBeenCalledWith('redeem_coins_for_boost', {
      p_reel_id: 'reel-uuid-abc',
    });
  });
});

// ===========================================================================
// PLATFORM SETTINGS
// ===========================================================================
describe('Platform Settings', () => {
  it('returns default pricing when DB query returns no data', async () => {
    const settingsQb = (supabase as any)._makeQb({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (supabase as any).from = vi.fn(() => settingsQb);

    const settings = await api.getPlatformSettings();

    expect(settings.feature_property_cost).toBe(50);
    expect(settings.feature_property_duration_days).toBe(7);
    expect(settings.boost_reel_cost).toBe(30);
    expect(settings.boost_reel_duration_days).toBe(7);
  });

  it('returns DB values when available', async () => {
    const settingsQb = (supabase as any)._makeQb({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 1,
          feature_property_cost: 75,
          feature_property_duration_days: 14,
          boost_reel_cost: 45,
          boost_reel_duration_days: 10,
          updated_at: '2026-11-09T00:00:00Z',
        },
        error: null,
      }),
    });
    (supabase as any).from = vi.fn(() => settingsQb);

    const settings = await api.getPlatformSettings();

    expect(settings.feature_property_cost).toBe(75);
    expect(settings.feature_property_duration_days).toBe(14);
    expect(settings.boost_reel_cost).toBe(45);
    expect(settings.boost_reel_duration_days).toBe(10);
  });
});

// ===========================================================================
// REFERRAL CORRECTION — referrer +50, referred gets 25 from trigger only
// ===========================================================================
describe('Referral correction — applyReferralCode', () => {
  it('awards referrer +50 via RPC (not the referred user)', async () => {
    setupSender(100);

    // Mock the apply_referral_code RPC to succeed
    (supabase as any).rpc = vi.fn().mockResolvedValue({
      data: 'Referral applied! 50 coins credited to your friend. You received 25 welcome coins on signup.',
      error: null,
    });

    const result = await api.applyReferralCode('IP-ABCDEF');

    expect(result.success).toBe(true);
    expect(result.message).toContain('50 coins');
    // The RPC is the authority — verify it was called
    expect(supabase.rpc).toHaveBeenCalledWith('apply_referral_code', {
      p_code: 'IP-ABCDEF',
      p_referred_id: 'sender-uuid-123',
    });
  });

  it('rejects self-referral via RPC error', async () => {
    setupSender(100);

    (supabase as any).rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'You cannot use your own referral code.' },
    });

    const result = await api.applyReferralCode('IP-SEN123');

    expect(result.success).toBe(false);
    expect(result.message).toContain('own referral code');
  });

  it('rejects duplicate referral redemption via RPC error', async () => {
    setupSender(100);

    (supabase as any).rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'You have already redeemed a referral reward on this account.' },
    });

    const result = await api.applyReferralCode('IP-ABCDEF');

    expect(result.success).toBe(false);
    expect(result.message).toContain('already redeemed');
  });
});

// ===========================================================================
// REFERRAL — local fallback (non-Supabase mode)
// Tests the client-side logic that awards referrer +50 only (no duplicate 25)
// ===========================================================================
describe('Referral — local fallback (no Supabase)', () => {
  it('awards referrer exactly +50 and does NOT add +25 to referred user', async () => {
    // This tests the corrected client-side fallback path.
    // We simulate the local-only mode by having the RPC fail and fall through.
    const referrerId = 'referrer-uuid-001';
    const referredId = 'referred-uuid-002';

    ls(STORAGE_KEYS.CURRENT_USER, {
      id: referredId,
      email: 'referred@test.com',
      full_name: 'New User',
      role: 'professional',
      phone: '+919999999999',
      verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    ls(STORAGE_KEYS.PROFILES, [
      { id: referrerId, email: 'referrer@test.com', full_name: 'Referrer', phone: '+918888888888' },
      { id: referredId, email: 'referred@test.com', full_name: 'New User', phone: '+919999999999' },
    ]);

    ls(STORAGE_KEYS.TOKEN_WALLETS, {
      [referrerId]: { user_id: referrerId, balance: 25, total_earned: 25, total_spent: 0, updated_at: new Date().toISOString() },
      [referredId]: { user_id: referredId, balance: 25, total_earned: 25, total_spent: 0, updated_at: new Date().toISOString() },
    });

    ls(STORAGE_KEYS.REFERRALS, [
      {
        id: 'ref-pending-1',
        created_at: new Date().toISOString(),
        referrer_id: referrerId,
        referral_code: 'IP-ABCDEF',
        status: 'pending',
        reward_tokens: 50,
      },
    ]);

    // Make the RPC fail so it falls through to the local fallback
    (supabase as any).rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'function does not exist' },
    });

    // Mock adminAdjustTokens to succeed (it also falls through to local)
    (supabase as any).from = vi.fn(() => (supabase as any)._makeQb());

    const result = await referralService.applyReferralCode('IP-ABCDEF');

    expect(result.success).toBe(true);

    // Verify referrer got +50
    const wallets = JSON.parse(localStorage.getItem(STORAGE_KEYS.TOKEN_WALLETS) || '{}');
    expect(wallets[referrerId].balance).toBe(75); // 25 + 50 = 75

    // Verify referred user did NOT get an extra +25 (stays at 25 from trigger)
    expect(wallets[referredId].balance).toBe(25); // unchanged — no duplicate

    // Verify only 1 admin adjust call (for referrer), not 2 (would include referred)
    // The referral record should be marked as rewarded
    const refs = JSON.parse(localStorage.getItem(STORAGE_KEYS.REFERRALS) || '[]');
    const rewarded = refs.find((r: any) => r.status === 'rewarded');
    expect(rewarded).toBeDefined();
    expect(rewarded.reward_tokens).toBe(50);
  });
});

// ===========================================================================
// AUTH STATE — session persistence listener
// ===========================================================================
describe('Auth state listener', () => {
  it('onAuthStateChange returns an unsubscribe function', () => {
    const callback = vi.fn();
    const unsubscribe = api.onAuthStateChange(callback);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});
