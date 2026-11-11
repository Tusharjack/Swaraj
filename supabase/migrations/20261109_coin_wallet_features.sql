-- =============================================================================
-- MIGRATION: 20261109_coin_wallet_features.sql
-- IndoProperty — Coin Wallet (Gift + Use Coins), Redemption, Referral Fix
-- =============================================================================
-- This migration is IDEMPOTENT — safe to run multiple times on an existing
-- database. It does NOT drop any tables or data.
--
-- Changes:
--   1.  properties.featured_until  — auto-expiry timestamp for featured listings
--   2.  reels.boosted / boosted_until — boost status + auto-expiry for reels
--   3.  platform_settings table     — admin-configurable pricing for redemptions
--   4.  token_transactions type     — add 'gifted_sent' & 'gifted_received'
--   5.  gift_coins() RPC            — atomic peer-to-peer coin transfer
--   6.  redeem_coins_for_feature()  — spend coins to feature a property listing
--   7.  redeem_coins_for_boost()    — spend coins to boost a property reel
--   8.  expire_featured_boosted()   — auto-expire featured/boosted status
--   9.  apply_referral_code() FIX   — referrer +50, new user gets 25 (trigger only)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROPERTIES: add featured_until for auto-expiry of featured listings
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'featured_until'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN featured_until TIMESTAMPTZ;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. REELS: add boosted + boosted_until for reel boosts
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reels' AND column_name = 'boosted'
  ) THEN
    ALTER TABLE public.reels ADD COLUMN boosted BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reels' AND column_name = 'boosted_until'
  ) THEN
    ALTER TABLE public.reels ADD COLUMN boosted_until TIMESTAMPTZ;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. PLATFORM SETTINGS — admin-configurable pricing for coin redemptions
--    Single-row table (id = 1) holding the cost & duration of each redemption.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                          INTEGER PRIMARY KEY DEFAULT 1,
  feature_property_cost       INTEGER NOT NULL DEFAULT 50,
  feature_property_duration_days  INTEGER NOT NULL DEFAULT 7,
  boost_reel_cost              INTEGER NOT NULL DEFAULT 30,
  boost_reel_duration_days    INTEGER NOT NULL DEFAULT 7,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_settings_single_row CHECK (id = 1)
);

INSERT INTO public.platform_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read pricing; only admins can update
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'platform_settings_select_all' AND tablename = 'platform_settings') THEN
    CREATE POLICY "platform_settings_select_all" ON public.platform_settings
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'platform_settings_admin_update' AND tablename = 'platform_settings') THEN
    CREATE POLICY "platform_settings_admin_update" ON public.platform_settings
      FOR UPDATE USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. TOKEN TRANSACTIONS: extend the type CHECK to include gift types
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the existing CHECK constraint on token_transactions.type
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
  WHERE nsp.nspname = 'public'
    AND cls.relname = 'token_transactions'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%earned_referral%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.token_transactions DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  -- Recreate with the extended type list
  ALTER TABLE public.token_transactions
    ADD CONSTRAINT token_transactions_type_check CHECK (type IN (
      'earned_referral',
      'earned_referred',
      'earned_admin',
      'spent_promotion',
      'spent_featured',
      'spent_boost',
      'deducted_admin',
      'gifted_sent',
      'gifted_received'
    ));
EXCEPTION WHEN OTHERS THEN
  -- If constraint already updated or other harmless error, continue
  RAISE NOTICE 'token_transactions type constraint update: %', SQLERRM;
END $$;

-- Ensure is_admin helper exists (created by prior migration)
CREATE OR REPLACE FUNCTION public.is_admin(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_uid AND role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. gift_coins() — atomic peer-to-peer coin transfer
--    Sender (auth.uid()) gifts coins to a receiver identified by phone number.
--    Prevents: self-transfer, insufficient balance, negative amounts,
--              unregistered receivers, duplicate concurrent transfers.
--    Records:  two transactions (debit sender, credit receiver) + notification.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gift_coins(
  p_receiver_phone TEXT,
  p_amount         INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id      UUID := auth.uid();
  v_receiver_id    UUID;
  v_sender_balance INTEGER;
  v_sender_name    TEXT;
  v_receiver_name  TEXT;
  v_clean_phone    TEXT;
BEGIN
  -- ── Validation ──────────────────────────────────────────────────────────
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to gift coins.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Gift amount must be greater than zero.';
  END IF;

  -- Normalise phone: strip spaces/dashes, keep digits and leading +
  v_clean_phone := REGEXP_REPLACE(TRIM(p_receiver_phone), '[\s\-()]', '', 'g');

  IF v_clean_phone = '' THEN
    RAISE EXCEPTION 'Please enter a valid mobile number.';
  END IF;

  -- ── Find receiver by phone ─────────────────────────────────────────────
  SELECT id, full_name INTO v_receiver_id, v_receiver_name
  FROM public.profiles
  WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[\s\-()]', '', 'g') = v_clean_phone
  LIMIT 1;

  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'No registered user found with mobile number %. Ask your friend to register on IndoProperty first.', v_clean_phone;
  END IF;

  -- ── Prevent self-transfer ──────────────────────────────────────────────
  IF v_receiver_id = v_sender_id THEN
    RAISE EXCEPTION 'You cannot gift coins to yourself.';
  END IF;

  -- ── Ensure sender wallet exists, then lock for update ──────────────────
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_sender_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_sender_balance
  FROM public.token_wallets
  WHERE user_id = v_sender_id
  FOR UPDATE;  -- row lock prevents concurrent duplicate transfers

  IF v_sender_balance IS NULL THEN
    RAISE EXCEPTION 'Your wallet could not be loaded. Please try again.';
  END IF;

  IF v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. You have % coins but tried to gift %.', v_sender_balance, p_amount;
  END IF;

  -- ── Get sender display name ────────────────────────────────────────────
  SELECT full_name INTO v_sender_name
  FROM public.profiles WHERE id = v_sender_id;

  IF v_sender_name IS NULL THEN
    v_sender_name := 'A friend';
  END IF;

  -- ── Ensure receiver wallet exists ──────────────────────────────────────
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_receiver_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock receiver wallet too
  PERFORM 1 FROM public.token_wallets WHERE user_id = v_receiver_id FOR UPDATE;

  -- ── Atomic transfer: debit sender ──────────────────────────────────────
  UPDATE public.token_wallets
  SET balance     = balance - p_amount,
      total_spent = total_spent + p_amount,
      updated_at  = NOW()
  WHERE user_id = v_sender_id;

  -- ── Atomic transfer: credit receiver ────────────────────────────────────
  UPDATE public.token_wallets
  SET balance      = balance + p_amount,
      total_earned = total_earned + p_amount,
      updated_at   = NOW()
  WHERE user_id = v_receiver_id;

  -- ── Record transactions (audit trail) ──────────────────────────────────
  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (
    v_sender_id, -p_amount, 'gifted_sent',
    'Gifted ' || p_amount || ' coins to ' || v_receiver_name,
    v_receiver_id::TEXT
  );

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (
    v_receiver_id, p_amount, 'gifted_received',
    'Received ' || p_amount || ' coins as a gift from ' || v_sender_name,
    v_sender_id::TEXT
  );

  -- ── In-app notification (English + Marathi) ─────────────────────────────
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_receiver_id,
      '🎁 Coins Received!',
      'You received ' || p_amount || ' Coins from ' || v_sender_name || '!' ||
      E'\n' ||
      'तुम्हाला ' || v_sender_name || ' यांच्याकडून ' || p_amount || ' कॉइन्स गिफ्ट मिळाले आहेत!',
      'system'
    );
  EXCEPTION WHEN OTHERS THEN
    -- notifications table may not exist in all environments
    RAISE NOTICE 'Notification insert skipped: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',     true,
    'receiver_id', v_receiver_id,
    'receiver_name', v_receiver_name,
    'amount',      p_amount
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. redeem_coins_for_feature() — spend coins to feature a property listing
--    Validates ownership, checks balance, deducts coins, sets featured + expiry.
--    Pricing is read from platform_settings (admin-configurable).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_coins_for_feature(
  p_property_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_balance        INTEGER;
  v_cost           INTEGER;
  v_duration_days  INTEGER;
  v_property_owner UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to feature a listing.';
  END IF;

  -- Read admin-configurable pricing
  SELECT feature_property_cost, feature_property_duration_days
  INTO v_cost, v_duration_days
  FROM public.platform_settings WHERE id = 1;

  IF v_cost IS NULL THEN
    v_cost := 50;
    v_duration_days := 7;
  END IF;

  -- Verify the property exists and belongs to the caller
  SELECT owner_id INTO v_property_owner
  FROM public.properties WHERE id = p_property_id;

  IF v_property_owner IS NULL THEN
    RAISE EXCEPTION 'Property not found.';
  END IF;

  IF v_property_owner != v_user_id THEN
    RAISE EXCEPTION 'You can only feature your own listings.';
  END IF;

  -- Ensure wallet exists & lock
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_user_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.token_wallets WHERE user_id = v_user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient coins. You need % coins but have %. Visit your wallet to earn more.', v_cost, COALESCE(v_balance, 0);
  END IF;

  -- Deduct coins
  UPDATE public.token_wallets
  SET balance     = balance - v_cost,
      total_spent = total_spent + v_cost,
      updated_at  = NOW()
  WHERE user_id = v_user_id;

  -- Record transaction
  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_user_id, -v_cost, 'spent_promotion',
          'Featured property listing for ' || v_duration_days || ' days',
          p_property_id::TEXT);

  -- Set featured + auto-expiry timestamp
  UPDATE public.properties
  SET featured      = TRUE,
      featured_until = NOW() + (v_duration_days || ' days')::INTERVAL,
      updated_at     = NOW()
  WHERE id = p_property_id;

  RETURN jsonb_build_object(
    'success',       true,
    'cost',           v_cost,
    'duration_days',  v_duration_days,
    'expires_at',     NOW() + (v_duration_days || ' days')::INTERVAL
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. redeem_coins_for_boost() — spend coins to boost a property reel
--    Validates ownership, checks balance, deducts coins, sets boosted + expiry.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_coins_for_boost(
  p_reel_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_balance        INTEGER;
  v_cost           INTEGER;
  v_duration_days  INTEGER;
  v_reel_owner     UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to boost a reel.';
  END IF;

  -- Read admin-configurable pricing
  SELECT boost_reel_cost, boost_reel_duration_days
  INTO v_cost, v_duration_days
  FROM public.platform_settings WHERE id = 1;

  IF v_cost IS NULL THEN
    v_cost := 30;
    v_duration_days := 7;
  END IF;

  -- Verify the reel exists and belongs to the caller
  SELECT user_id INTO v_reel_owner FROM public.reels WHERE id = p_reel_id;

  IF v_reel_owner IS NULL THEN
    RAISE EXCEPTION 'Reel not found.';
  END IF;

  IF v_reel_owner != v_user_id THEN
    RAISE EXCEPTION 'You can only boost your own reels.';
  END IF;

  -- Ensure wallet exists & lock
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_user_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.token_wallets WHERE user_id = v_user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient coins. You need % coins but have %. Visit your wallet to earn more.', v_cost, COALESCE(v_balance, 0);
  END IF;

  -- Deduct coins
  UPDATE public.token_wallets
  SET balance     = balance - v_cost,
      total_spent = total_spent + v_cost,
      updated_at  = NOW()
  WHERE user_id = v_user_id;

  -- Record transaction
  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_user_id, -v_cost, 'spent_boost',
          'Boosted reel for ' || v_duration_days || ' days',
          p_reel_id::TEXT);

  -- Set boosted + auto-expiry timestamp
  UPDATE public.reels
  SET boosted       = TRUE,
      boosted_until = NOW() + (v_duration_days || ' days')::INTERVAL,
      updated_at    = NOW()
  WHERE id = p_reel_id;

  RETURN jsonb_build_object(
    'success',       true,
    'cost',           v_cost,
    'duration_days',  v_duration_days,
    'expires_at',     NOW() + (v_duration_days || ' days')::INTERVAL
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. expire_featured_boosted() — auto-expire featured listings & boosted reels
--    Call this from the app before fetching properties/reels. It resets
--    featured/boosted to false when the expiry timestamp has passed.
--    SECURITY DEFINER so the anon/authenticated caller can run UPDATE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_featured_boosted()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Expire featured properties whose featured_until has passed
  UPDATE public.properties
  SET featured      = FALSE,
      featured_until = NULL,
      updated_at     = NOW()
  WHERE featured = TRUE
    AND featured_until IS NOT NULL
    AND featured_until < NOW();

  -- Expire boosted reels whose boosted_until has passed
  UPDATE public.reels
  SET boosted       = FALSE,
      boosted_until = NULL,
      updated_at    = NOW()
  WHERE boosted = TRUE
    AND boosted_until IS NOT NULL
    AND boosted_until < NOW();
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. FIX apply_referral_code() — referral reward correction
--    Referrer receives exactly 50 coins.
--    New registered user receives exactly 25 welcome coins (from the
--    handle_new_user trigger ONLY — this function no longer adds a duplicate
--    25 to the referred user, which previously gave them 50 total).
--    Preserves existing wallet balances (only affects future referrals).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_code        TEXT,
  p_referred_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_code    TEXT;
  v_referrer_id   UUID;
  v_referral_id   UUID;
  v_ref_status    TEXT;
  v_reward_tokens INTEGER := 50;
BEGIN
  -- Validate caller
  IF auth.uid() IS NULL OR (auth.uid() != p_referred_id AND NOT public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to apply referral code for this user.';
  END IF;

  v_clean_code := UPPER(TRIM(p_code));

  IF v_clean_code = '' THEN
    RAISE EXCEPTION 'Please provide a valid referral code.';
  END IF;

  -- 1. Anti-abuse: has this user already redeemed a referral reward?
  IF EXISTS (
    SELECT 1 FROM public.referrals
    WHERE referred_id = p_referred_id AND status IN ('completed', 'rewarded')
  ) THEN
    RAISE EXCEPTION 'You have already redeemed a referral reward on this account.';
  END IF;

  -- 2. Find the referral record or owner of the code
  SELECT id, referrer_id, status, reward_tokens
  INTO v_referral_id, v_referrer_id, v_ref_status, v_reward_tokens
  FROM public.referrals
  WHERE UPPER(referral_code) = v_clean_code AND status != 'invalid'
  ORDER BY created_at ASC
  LIMIT 1;

  -- If not in referrals table, derive referrer from deterministic code pattern
  IF v_referrer_id IS NULL THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE 'IP-' || UPPER(SUBSTRING(REPLACE(id::TEXT, '-', '') FROM 1 FOR 6)) = v_clean_code;
  END IF;

  IF v_referrer_id IS NULL THEN
    RAISE EXCEPTION 'Referral code "%" was not found or is invalid.', v_clean_code;
  END IF;

  -- 3. Anti-abuse: self-referral prohibited
  IF v_referrer_id = p_referred_id THEN
    RAISE EXCEPTION 'You cannot use your own referral code.';
  END IF;

  -- 4. Reward REFERRER (+50 coins)
  --    The referred user already received 25 welcome coins from the
  --    handle_new_user trigger — we do NOT add a duplicate 25 here.
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_referrer_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.token_wallets
  SET balance      = balance + v_reward_tokens,
      total_earned = total_earned + v_reward_tokens,
      updated_at   = NOW()
  WHERE user_id = v_referrer_id;

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_referrer_id, v_reward_tokens, 'earned_referral',
          'Referral reward for inviting a new user', p_referred_id::TEXT);

  -- 5. Record referral status as rewarded
  IF v_referral_id IS NOT NULL AND v_ref_status = 'pending' THEN
    UPDATE public.referrals
    SET referred_id = p_referred_id,
        status      = 'rewarded',
        rewarded_at = NOW()
    WHERE id = v_referral_id;
  ELSE
    INSERT INTO public.referrals (referrer_id, referred_id, referral_code, status, reward_tokens, rewarded_at)
    VALUES (v_referrer_id, p_referred_id, v_clean_code, 'rewarded', v_reward_tokens, NOW());
  END IF;

  -- 6. Notify the referrer (in-app)
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_referrer_id,
      'Referral Reward Credited! 🎉',
      'A user joined using your referral code. +' || v_reward_tokens || ' coins credited to your wallet.',
      'system'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Referrer notification skipped: %', SQLERRM;
  END;

  RETURN 'Referral applied! 50 coins credited to your friend. You received 25 welcome coins on signup.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. PERMISSIONS — grant execute on new RPCs to authenticated users
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.gift_coins(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coins_for_feature(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coins_for_boost(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_featured_boosted() TO authenticated, anon;
GRANT SELECT ON public.platform_settings TO anon, authenticated;

-- =============================================================================
-- END OF MIGRATION
-- Run this in Supabase Dashboard → SQL Editor → New Query.
-- It is safe to run multiple times (all statements are idempotent).
-- =============================================================================
