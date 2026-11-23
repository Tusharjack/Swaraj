-- =============================================================================
-- INDO-PROPERTY — SINGLE MASTER SCRIPT (WIPE + FULL REBUILD)
-- =============================================================================
-- Paste this ENTIRE file into: Supabase Dashboard → SQL Editor → New Query → Run
--
-- WHAT IT DOES
--   Section 1 : drops every app object (tables, functions, triggers) — a full
--               clean slate. Safe to run repeatedly.
--   Section 2+: rebuilds the complete schema, RPCs, triggers, RLS and grants
--               that the IndoProperty app needs.
--
-- ⚠ THIS DELETES ALL APP DATA (profiles, properties, reels, tokens, loans…).
--   It does NOT touch auth.users rows, and it does NOT touch Storage.
--
-- STORAGE: this project uses CLOUDINARY (src/lib/cloudinary.ts). This script
--   intentionally does NOT create Supabase Storage buckets or policies.
--
-- MFA / SMTP: configured in the Supabase Dashboard, no SQL required.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ===========================================================================
-- SECTION 1 — WIPE EVERYTHING (clean slate)
-- ===========================================================================

-- 1a. Drop triggers (guarded: "DROP TRIGGER ... ON t" fails with 42P01 if the
--     table does not exist, so we check to_regclass first).
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  END IF;
  IF to_regclass('public.reel_likes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS on_reel_like_changed ON public.reel_likes;
  END IF;
  IF to_regclass('public.reel_comments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS on_reel_comment_changed ON public.reel_comments;
  END IF;
END $$;

-- 1b. Drop every app function (CASCADE also removes dependent triggers/policies)
DROP FUNCTION IF EXISTS public.notify_on_message()          CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_enquiry()          CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_like()             CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_comment()          CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_follow()           CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_account_update()   CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_property_match()   CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user()            CASCADE;
DROP FUNCTION IF EXISTS public.handle_reel_like_change()    CASCADE;
DROP FUNCTION IF EXISTS public.handle_reel_comment_change() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID)               CASCADE;
DROP FUNCTION IF EXISTS public.credit_tokens(UUID, INTEGER, TEXT, TEXT, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.spend_tokens(UUID, INTEGER, TEXT, TEXT, TEXT)        CASCADE;
DROP FUNCTION IF EXISTS public.admin_adjust_tokens(UUID, INTEGER, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.apply_referral_code(TEXT, UUID)                      CASCADE;
DROP FUNCTION IF EXISTS public.gift_coins(TEXT, INTEGER)                            CASCADE;
DROP FUNCTION IF EXISTS public.gift_coins_by_phone(TEXT, INTEGER)                   CASCADE;
DROP FUNCTION IF EXISTS public.redeem_coins_for_feature(UUID)                       CASCADE;
DROP FUNCTION IF EXISTS public.redeem_coins_for_boost(UUID)                         CASCADE;
DROP FUNCTION IF EXISTS public.expire_featured_boosted()                            CASCADE;
DROP FUNCTION IF EXISTS public.increment_property_views(UUID)                       CASCADE;

-- 1c. Drop every app table (children first; CASCADE handles any leftovers)
DROP TABLE IF EXISTS public.saved_preferences    CASCADE;
DROP TABLE IF EXISTS public.reports              CASCADE;
DROP TABLE IF EXISTS public.notifications        CASCADE;
DROP TABLE IF EXISTS public.chat_messages        CASCADE;
DROP TABLE IF EXISTS public.saved_properties     CASCADE;
DROP TABLE IF EXISTS public.enquiries            CASCADE;
DROP TABLE IF EXISTS public.followers            CASCADE;
DROP TABLE IF EXISTS public.reel_saves           CASCADE;
DROP TABLE IF EXISTS public.reel_comments        CASCADE;
DROP TABLE IF EXISTS public.reel_likes           CASCADE;
DROP TABLE IF EXISTS public.reels                CASCADE;
DROP TABLE IF EXISTS public.property_media       CASCADE;
DROP TABLE IF EXISTS public.properties           CASCADE;
DROP TABLE IF EXISTS public.token_transactions   CASCADE;
DROP TABLE IF EXISTS public.token_wallets        CASCADE;
DROP TABLE IF EXISTS public.loan_applications    CASCADE;
DROP TABLE IF EXISTS public.referrals            CASCADE;
DROP TABLE IF EXISTS public.platform_settings    CASCADE;
DROP TABLE IF EXISTS public.ads                  CASCADE;
DROP TABLE IF EXISTS public.profiles             CASCADE;


-- ===========================================================================
-- SECTION 2 — TABLES
-- ===========================================================================

-- 2.1 PROFILES  (id = Supabase auth uid so auth.uid() works in RLS)
CREATE TABLE public.profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email             TEXT        NOT NULL,
  full_name         TEXT        NOT NULL,
  role              TEXT        NOT NULL DEFAULT 'customer'
                                CHECK (role IN ('customer','professional','admin')),
  professional_type TEXT        CHECK (professional_type IN ('broker','builder','owner')),
  agency_name       TEXT,
  phone             TEXT,
  city              TEXT        DEFAULT 'Mumbai',
  verified          BOOLEAN     NOT NULL DEFAULT FALSE,
  badge             TEXT,
  bio               TEXT,
  avatar_url        TEXT
);

-- 2.2 PROPERTIES
CREATE TABLE public.properties (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title          TEXT        NOT NULL,
  description    TEXT        NOT NULL DEFAULT '',
  price          NUMERIC     NOT NULL DEFAULT 0,
  property_type  TEXT        NOT NULL DEFAULT 'apartment'
                             CHECK (property_type IN ('flat','apartment','villa','penthouse','plot','commercial','land','farmhouse')),
  listing_type   TEXT        NOT NULL DEFAULT 'sell'
                             CHECK (listing_type IN ('buy','sell','rent','lease')),
  bedrooms       INTEGER     NOT NULL DEFAULT 1,
  bathrooms      INTEGER     NOT NULL DEFAULT 1,
  area_sqft      NUMERIC     NOT NULL DEFAULT 0,
  location       TEXT        NOT NULL DEFAULT '',
  city           TEXT        NOT NULL DEFAULT 'Mumbai',
  owner_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status         TEXT        NOT NULL DEFAULT 'available'
                             CHECK (status IN ('active','available','pending','sold','archived')),
  featured       BOOLEAN     NOT NULL DEFAULT FALSE,
  featured_until TIMESTAMPTZ,
  views_count    INTEGER     NOT NULL DEFAULT 0,
  amenities      TEXT[]      NOT NULL DEFAULT '{}',
  images         TEXT[]      NOT NULL DEFAULT '{}'
);

-- 2.3 PROPERTY MEDIA
CREATE TABLE public.property_media (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  property_id   UUID        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url           TEXT        NOT NULL,
  media_type    TEXT        NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video','floorplan')),
  is_cover      BOOLEAN     NOT NULL DEFAULT FALSE,
  display_order INTEGER     NOT NULL DEFAULT 0
);

-- 2.4 REELS
CREATE TABLE public.reels (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id    UUID        REFERENCES public.properties(id) ON DELETE SET NULL,
  video_url      TEXT        NOT NULL,
  thumbnail_url  TEXT,
  title          TEXT        NOT NULL,
  caption        TEXT,
  likes_count    INTEGER     NOT NULL DEFAULT 0,
  comments_count INTEGER     NOT NULL DEFAULT 0,
  saves_count    INTEGER     NOT NULL DEFAULT 0,
  shares_count   INTEGER     NOT NULL DEFAULT 0,
  views_count    INTEGER     NOT NULL DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  boosted        BOOLEAN     NOT NULL DEFAULT FALSE,
  boosted_until  TIMESTAMPTZ
);

-- 2.5 REEL LIKES / COMMENTS / SAVES
CREATE TABLE public.reel_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reel_id    UUID        NOT NULL REFERENCES public.reels(id)    ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (reel_id, user_id)
);

CREATE TABLE public.reel_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reel_id    UUID        NOT NULL REFERENCES public.reels(id)    ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL
);

CREATE TABLE public.reel_saves (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reel_id    UUID        NOT NULL REFERENCES public.reels(id)    ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (reel_id, user_id)
);

-- 2.6 SAVED PROPERTIES
CREATE TABLE public.saved_properties (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  property_id UUID        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  UNIQUE (property_id, user_id)
);

-- 2.7 FOLLOWERS
CREATE TABLE public.followers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  follower_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (follower_id, following_id)
);

-- 2.8 ENQUIRIES
CREATE TABLE public.enquiries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  property_id     UUID        REFERENCES public.properties(id) ON DELETE SET NULL,
  reel_id         UUID        REFERENCES public.reels(id)       ON DELETE SET NULL,
  sender_id       UUID        REFERENCES public.profiles(id)    ON DELETE SET NULL,
  recipient_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_email TEXT,
  name            TEXT        NOT NULL DEFAULT '',
  email           TEXT        NOT NULL DEFAULT '',
  phone           TEXT        NOT NULL DEFAULT '',
  message         TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed'))
);

-- 2.9 CHAT MESSAGES
CREATE TABLE public.chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enquiry_id  UUID        NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  receiver_id UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  message     TEXT        NOT NULL,
  read        BOOLEAN     NOT NULL DEFAULT FALSE
);

-- 2.10 NOTIFICATIONS
CREATE TABLE public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN (
                           'enquiry','like','comment','follow','system',
                           'message','match','account')),
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  link_url   TEXT
);

-- 2.11 REPORTS
--   id / target_id are TEXT because reportService.ts inserts client-generated
--   ids (e.g. "rep-1751234567890"), not UUIDs.
CREATE TABLE public.reports (
  id          TEXT        PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reporter_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT        NOT NULL CHECK (target_type IN ('property','reel','user','comment')),
  target_id   TEXT        NOT NULL,
  reason      TEXT        NOT NULL,
  details     TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','dismissed'))
);

-- 2.12 TOKEN WALLETS
CREATE TABLE public.token_wallets (
  user_id      UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance      INTEGER     NOT NULL DEFAULT 25 CHECK (balance >= 0),
  total_earned INTEGER     NOT NULL DEFAULT 25 CHECK (total_earned >= 0),
  total_spent  INTEGER     NOT NULL DEFAULT 0  CHECK (total_spent >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.13 TOKEN TRANSACTIONS
CREATE TABLE public.token_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       INTEGER     NOT NULL,
  type         TEXT        NOT NULL CHECK (type IN (
                             'earned_referral','earned_referred','earned_admin',
                             'spent_promotion','spent_featured','spent_boost',
                             'deducted_admin','gifted_sent','gifted_received')),
  description  TEXT        NOT NULL,
  reference_id TEXT,
  admin_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2.14 HOME LOAN APPLICATIONS
CREATE TABLE public.loan_applications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name        TEXT        NOT NULL,
  email            TEXT        NOT NULL,
  phone            TEXT        NOT NULL,
  date_of_birth    DATE        NOT NULL,
  pan_number       TEXT        NOT NULL,
  city             TEXT        NOT NULL,
  employment_type  TEXT        NOT NULL CHECK (employment_type IN ('salaried','self_employed','business','freelancer','retired')),
  employer_name    TEXT,
  monthly_income   NUMERIC     NOT NULL CHECK (monthly_income > 0),
  other_income     NUMERIC     DEFAULT 0,
  existing_emi     NUMERIC     DEFAULT 0,
  loan_amount      NUMERIC     NOT NULL CHECK (loan_amount > 0),
  tenure_years     INTEGER     NOT NULL CHECK (tenure_years >= 1 AND tenure_years <= 35),
  purpose          TEXT        NOT NULL DEFAULT 'purchase',
  property_address TEXT,
  property_city    TEXT,
  property_value   NUMERIC,
  property_id      UUID        REFERENCES public.properties(id) ON DELETE SET NULL,
  status           TEXT        NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','approved','rejected','disbursed','cancelled')),
  admin_notes      TEXT,
  approved_amount  NUMERIC,
  disbursed_amount NUMERIC,
  disbursed_at     TIMESTAMPTZ,
  reviewed_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2.15 REFERRALS
CREATE TABLE public.referrals (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  referral_code  TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rewarded','invalid')),
  reward_tokens  INTEGER     NOT NULL DEFAULT 50,
  rewarded_at    TIMESTAMPTZ,
  referred_email TEXT
);

-- 2.16 PLATFORM SETTINGS (single row, id = 1)
CREATE TABLE public.platform_settings (
  id                             INTEGER     PRIMARY KEY DEFAULT 1,
  feature_property_cost          INTEGER     NOT NULL DEFAULT 50,
  feature_property_duration_days INTEGER     NOT NULL DEFAULT 7,
  boost_reel_cost                INTEGER     NOT NULL DEFAULT 30,
  boost_reel_duration_days       INTEGER     NOT NULL DEFAULT 7,
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_settings_single_row CHECK (id = 1)
);

INSERT INTO public.platform_settings (id) VALUES (1);

-- 2.17 SAVED SEARCH PREFERENCES (drives property-match notifications)
CREATE TABLE public.saved_preferences (
  user_id        UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  city           TEXT,
  min_price      NUMERIC,
  max_price      NUMERIC,
  property_type  TEXT,
  listing_type   TEXT,
  bedrooms       INTEGER,
  notify_matches BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 2.18 AD BANNERS (horizontal home-page ads, managed by admins)
CREATE TABLE public.ads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title         TEXT        NOT NULL,
  image_url     TEXT        NOT NULL,
  link_url      TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INTEGER     NOT NULL DEFAULT 0
);


-- ===========================================================================
-- SECTION 3 — INDEXES
-- ===========================================================================
CREATE INDEX idx_properties_owner      ON public.properties(owner_id);
CREATE INDEX idx_properties_city       ON public.properties(city);
CREATE INDEX idx_properties_type       ON public.properties(property_type);
CREATE INDEX idx_properties_listing    ON public.properties(listing_type);
CREATE INDEX idx_properties_status     ON public.properties(status);
CREATE INDEX idx_properties_price      ON public.properties(price);
CREATE INDEX idx_reels_user            ON public.reels(user_id);
CREATE INDEX idx_reels_property        ON public.reels(property_id);
CREATE INDEX idx_reels_status          ON public.reels(status);
CREATE INDEX idx_reels_created         ON public.reels(created_at DESC);
CREATE INDEX idx_enquiries_recipient   ON public.enquiries(recipient_id);
CREATE INDEX idx_enquiries_sender      ON public.enquiries(sender_id);
CREATE INDEX idx_chat_messages_enquiry ON public.chat_messages(enquiry_id);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread  ON public.notifications(user_id) WHERE read = FALSE;
CREATE INDEX idx_token_tx_user         ON public.token_transactions(user_id);
CREATE INDEX idx_token_tx_created      ON public.token_transactions(created_at DESC);
CREATE INDEX idx_loans_user            ON public.loan_applications(user_id);
CREATE INDEX idx_loans_status          ON public.loan_applications(status);
CREATE INDEX idx_loans_created         ON public.loan_applications(created_at DESC);
CREATE INDEX idx_referrals_referrer    ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_code        ON public.referrals(UPPER(referral_code));
CREATE UNIQUE INDEX idx_referrals_code_unique     ON public.referrals(referral_code) WHERE status = 'pending';
CREATE UNIQUE INDEX idx_referrals_referred_unique ON public.referrals(referred_id)  WHERE status IN ('completed','rewarded');
CREATE INDEX idx_saved_pref_city       ON public.saved_preferences(city);
CREATE INDEX idx_ads_active_order      ON public.ads(is_active, display_order);


-- ===========================================================================
-- SECTION 4 — HELPER FUNCTION (must be created AFTER profiles exists,
--             because LANGUAGE sql functions are validated at creation time)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.is_admin(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_uid AND role = 'admin');
$$;


-- ===========================================================================
-- SECTION 5 — RPC FUNCTIONS
-- ===========================================================================

-- 5.1 increment_property_views  (called as rpc('increment_property_views', { prop_id }))
CREATE OR REPLACE FUNCTION public.increment_property_views(prop_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.properties SET views_count = COALESCE(views_count, 0) + 1 WHERE id = prop_id;
END $$;

-- 5.2 spend_tokens  (rpc params: p_user_id, p_amount, p_type, p_description, p_reference_id)
CREATE OR REPLACE FUNCTION public.spend_tokens(
  p_user_id UUID, p_amount INTEGER, p_type TEXT, p_description TEXT, p_reference_id TEXT DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_curr INTEGER; v_new INTEGER;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> p_user_id AND NOT public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to spend tokens for this account.';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Spend amount must be greater than zero.';
  END IF;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (p_user_id, 25, 25, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_curr FROM public.token_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_curr < p_amount THEN
    RAISE EXCEPTION 'Insufficient token balance (required %, available %).', p_amount, v_curr;
  END IF;

  UPDATE public.token_wallets
  SET balance = balance - p_amount, total_spent = total_spent + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id RETURNING balance INTO v_new;

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (p_user_id, -p_amount, p_type, p_description, p_reference_id);

  RETURN v_new;
END $$;

-- 5.3 admin_adjust_tokens  (rpc params: p_user_id, p_amount, p_type, p_description, p_admin_id)
CREATE OR REPLACE FUNCTION public.admin_adjust_tokens(
  p_user_id UUID, p_amount INTEGER, p_type TEXT, p_description TEXT, p_admin_id UUID DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new INTEGER; v_admin UUID;
BEGIN
  v_admin := COALESCE(auth.uid(), p_admin_id);
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN
    RAISE EXCEPTION 'Only platform administrators can manually adjust coin balances.';
  END IF;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (p_user_id, 25, 25, 0) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.token_wallets
  SET balance      = GREATEST(0, balance + p_amount),
      total_earned = total_earned + CASE WHEN p_amount > 0 THEN p_amount ELSE 0 END,
      total_spent  = total_spent  + CASE WHEN p_amount < 0 THEN ABS(p_amount) ELSE 0 END,
      updated_at   = NOW()
  WHERE user_id = p_user_id RETURNING balance INTO v_new;

  INSERT INTO public.token_transactions (user_id, amount, type, description, admin_id)
  VALUES (p_user_id, p_amount, p_type, p_description, v_admin);

  RETURN v_new;
END $$;

-- 5.4 credit_tokens (legacy helper)
CREATE OR REPLACE FUNCTION public.credit_tokens(
  p_user_id UUID, p_amount INTEGER, p_type TEXT, p_description TEXT,
  p_reference_id UUID DEFAULT NULL, p_admin_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (p_user_id, p_amount, p_amount, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.token_wallets.balance + p_amount,
        total_earned = public.token_wallets.total_earned + p_amount,
        updated_at = NOW();

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id, admin_id)
  VALUES (p_user_id, p_amount, p_type, p_description, p_reference_id, p_admin_id);
END $$;

-- 5.5 apply_referral_code  (rpc params: p_code, p_referred_id)
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code TEXT, p_referred_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT; v_referrer UUID; v_ref_id UUID; v_status TEXT; v_reward INTEGER := 50;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> p_referred_id AND NOT public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to apply referral code for this user.';
  END IF;

  v_code := UPPER(TRIM(p_code));
  IF v_code = '' THEN RAISE EXCEPTION 'Please provide a valid referral code.'; END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = p_referred_id AND status IN ('completed','rewarded')) THEN
    RAISE EXCEPTION 'You have already redeemed a referral reward on this account.';
  END IF;

  SELECT id, referrer_id, status, reward_tokens
  INTO v_ref_id, v_referrer, v_status, v_reward
  FROM public.referrals
  WHERE UPPER(referral_code) = v_code AND status <> 'invalid'
  ORDER BY created_at ASC LIMIT 1;

  IF v_referrer IS NULL THEN
    SELECT id INTO v_referrer FROM public.profiles
    WHERE 'IP-' || UPPER(SUBSTRING(REPLACE(id::TEXT,'-','') FROM 1 FOR 6)) = v_code;
  END IF;

  IF v_referrer IS NULL THEN RAISE EXCEPTION 'Referral code "%" was not found or is invalid.', v_code; END IF;
  IF v_referrer = p_referred_id THEN RAISE EXCEPTION 'You cannot use your own referral code.'; END IF;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_referrer, 25, 25, 0) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.token_wallets
  SET balance = balance + v_reward, total_earned = total_earned + v_reward, updated_at = NOW()
  WHERE user_id = v_referrer;

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_referrer, v_reward, 'earned_referral', 'Referral reward for inviting a new user', p_referred_id::TEXT);

  IF v_ref_id IS NOT NULL AND v_status = 'pending' THEN
    UPDATE public.referrals SET referred_id = p_referred_id, status = 'rewarded', rewarded_at = NOW() WHERE id = v_ref_id;
  ELSE
    INSERT INTO public.referrals (referrer_id, referred_id, referral_code, status, reward_tokens, rewarded_at)
    VALUES (v_referrer, p_referred_id, v_code, 'rewarded', v_reward, NOW());
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  VALUES (v_referrer, 'Referral Reward Credited!', 
          'A user joined using your referral code. +' || v_reward || ' coins credited to your wallet.',
          'system', '/profile');

  RETURN 'Referral applied! 50 coins credited to your friend. You received 25 welcome coins on signup.';
END $$;

-- 5.6 gift_coins  (rpc params: p_receiver_email, p_amount)
CREATE OR REPLACE FUNCTION public.gift_coins(p_receiver_email TEXT, p_amount INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sender UUID := auth.uid();
  v_receiver UUID; v_balance INTEGER; v_sender_name TEXT; v_receiver_name TEXT; v_email TEXT;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'You must be signed in to gift coins.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Gift amount must be greater than zero.'; END IF;

  v_email := LOWER(TRIM(COALESCE(p_receiver_email, '')));
  IF v_email = '' THEN RAISE EXCEPTION 'Please enter a valid email address.'; END IF;

  SELECT id, full_name INTO v_receiver, v_receiver_name FROM public.profiles
  WHERE LOWER(email) = v_email LIMIT 1;

  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'No registered user found with email %. Ask your friend to register first.', v_email;
  END IF;
  IF v_receiver = v_sender THEN RAISE EXCEPTION 'You cannot gift coins to yourself.'; END IF;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_sender, 25, 25, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM public.token_wallets WHERE user_id = v_sender FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Your wallet could not be loaded. Please try again.'; END IF;
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. You have % coins but tried to gift %.', v_balance, p_amount;
  END IF;

  SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = v_sender;
  IF v_sender_name IS NULL THEN v_sender_name := 'A friend'; END IF;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_receiver, 25, 25, 0) ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.token_wallets WHERE user_id = v_receiver FOR UPDATE;

  UPDATE public.token_wallets SET balance = balance - p_amount, total_spent = total_spent + p_amount, updated_at = NOW() WHERE user_id = v_sender;
  UPDATE public.token_wallets SET balance = balance + p_amount, total_earned = total_earned + p_amount, updated_at = NOW() WHERE user_id = v_receiver;

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_sender, -p_amount, 'gifted_sent', 'Gifted ' || p_amount || ' coins to ' || v_receiver_name, v_receiver::TEXT);
  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_receiver, p_amount, 'gifted_received', 'Received ' || p_amount || ' coins as a gift from ' || v_sender_name, v_sender::TEXT);

  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  VALUES (v_receiver, 'Coins Received!', 'You received ' || p_amount || ' Coins from ' || v_sender_name || '!', 'system', '/profile');

  RETURN jsonb_build_object('success', TRUE, 'receiver_id', v_receiver, 'receiver_name', v_receiver_name, 'amount', p_amount);
END $$;

-- 5.6b gift_coins_by_phone  (rpc params: p_receiver_phone, p_amount)
-- Same atomic transfer as gift_coins(), but resolves the receiver by the
-- registered phone number on public.profiles instead of email.
CREATE OR REPLACE FUNCTION public.gift_coins_by_phone(p_receiver_phone TEXT, p_amount INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sender UUID := auth.uid();
  v_receiver UUID; v_balance INTEGER; v_sender_name TEXT; v_receiver_name TEXT; v_phone TEXT;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'You must be signed in to gift coins.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Gift amount must be greater than zero.'; END IF;

  v_phone := regexp_replace(COALESCE(p_receiver_phone, ''), '[^0-9+]', '', 'g');
  IF v_phone = '' THEN RAISE EXCEPTION 'Please enter a valid phone number.'; END IF;

  SELECT id, full_name INTO v_receiver, v_receiver_name FROM public.profiles
  WHERE regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = v_phone LIMIT 1;

  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'No registered user found with phone %. Ask your friend to register first.', v_phone;
  END IF;
  IF v_receiver = v_sender THEN RAISE EXCEPTION 'You cannot gift coins to yourself.'; END IF;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_sender, 25, 25, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM public.token_wallets WHERE user_id = v_sender FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Your wallet could not be loaded. Please try again.'; END IF;
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. You have % coins but tried to gift %.', v_balance, p_amount;
  END IF;

  SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = v_sender;
  IF v_sender_name IS NULL THEN v_sender_name := 'A friend'; END IF;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_receiver, 25, 25, 0) ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.token_wallets WHERE user_id = v_receiver FOR UPDATE;

  UPDATE public.token_wallets SET balance = balance - p_amount, total_spent = total_spent + p_amount, updated_at = NOW() WHERE user_id = v_sender;
  UPDATE public.token_wallets SET balance = balance + p_amount, total_earned = total_earned + p_amount, updated_at = NOW() WHERE user_id = v_receiver;

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_sender, -p_amount, 'gifted_sent', 'Gifted ' || p_amount || ' coins to ' || v_receiver_name, v_receiver::TEXT);
  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_receiver, p_amount, 'gifted_received', 'Received ' || p_amount || ' coins as a gift from ' || v_sender_name, v_sender::TEXT);

  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  VALUES (v_receiver, 'Coins Received!', 'You received ' || p_amount || ' Coins from ' || v_sender_name || '!', 'system', '/profile');

  RETURN jsonb_build_object('success', TRUE, 'receiver_id', v_receiver, 'receiver_name', v_receiver_name, 'amount', p_amount);
END $$;

-- 5.7 redeem_coins_for_feature  (rpc params: p_property_id)
CREATE OR REPLACE FUNCTION public.redeem_coins_for_feature(p_property_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_balance INTEGER; v_cost INTEGER; v_days INTEGER; v_owner UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in to feature a listing.'; END IF;

  SELECT feature_property_cost, feature_property_duration_days INTO v_cost, v_days
  FROM public.platform_settings WHERE id = 1;
  IF v_cost IS NULL THEN v_cost := 50; v_days := 7; END IF;

  SELECT owner_id INTO v_owner FROM public.properties WHERE id = p_property_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Property not found.'; END IF;
  IF v_owner <> v_user THEN RAISE EXCEPTION 'You can only feature your own listings.'; END IF;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_user, 25, 25, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM public.token_wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient coins. You need % coins but have %. Visit your wallet to earn more.', v_cost, COALESCE(v_balance, 0);
  END IF;

  UPDATE public.token_wallets SET balance = balance - v_cost, total_spent = total_spent + v_cost, updated_at = NOW() WHERE user_id = v_user;
  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_user, -v_cost, 'spent_promotion', 'Featured property listing for ' || v_days || ' days', p_property_id::TEXT);

  UPDATE public.properties
  SET featured = TRUE, featured_until = NOW() + (v_days || ' days')::INTERVAL, updated_at = NOW()
  WHERE id = p_property_id;

  RETURN jsonb_build_object('success', TRUE, 'cost', v_cost, 'duration_days', v_days, 'expires_at', NOW() + (v_days || ' days')::INTERVAL);
END $$;

-- 5.8 redeem_coins_for_boost  (rpc params: p_reel_id)
CREATE OR REPLACE FUNCTION public.redeem_coins_for_boost(p_reel_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_balance INTEGER; v_cost INTEGER; v_days INTEGER; v_owner UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in to boost a reel.'; END IF;

  SELECT boost_reel_cost, boost_reel_duration_days INTO v_cost, v_days FROM public.platform_settings WHERE id = 1;
  IF v_cost IS NULL THEN v_cost := 30; v_days := 7; END IF;

  SELECT user_id INTO v_owner FROM public.reels WHERE id = p_reel_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Reel not found.'; END IF;
  IF v_owner <> v_user THEN RAISE EXCEPTION 'You can only boost your own reels.'; END IF;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_user, 25, 25, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM public.token_wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient coins. You need % coins but have %. Visit your wallet to earn more.', v_cost, COALESCE(v_balance, 0);
  END IF;

  UPDATE public.token_wallets SET balance = balance - v_cost, total_spent = total_spent + v_cost, updated_at = NOW() WHERE user_id = v_user;
  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_user, -v_cost, 'spent_boost', 'Boosted reel for ' || v_days || ' days', p_reel_id::TEXT);

  UPDATE public.reels SET boosted = TRUE, boosted_until = NOW() + (v_days || ' days')::INTERVAL, updated_at = NOW() WHERE id = p_reel_id;

  RETURN jsonb_build_object('success', TRUE, 'cost', v_cost, 'duration_days', v_days, 'expires_at', NOW() + (v_days || ' days')::INTERVAL);
END $$;

-- 5.9 expire_featured_boosted (no params)
CREATE OR REPLACE FUNCTION public.expire_featured_boosted()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.properties SET featured = FALSE, featured_until = NULL, updated_at = NOW()
  WHERE featured = TRUE AND featured_until IS NOT NULL AND featured_until < NOW();

  UPDATE public.reels SET boosted = FALSE, boosted_until = NULL, updated_at = NOW()
  WHERE boosted = TRUE AND boosted_until IS NOT NULL AND boosted_until < NOW();
END $$;


-- ===========================================================================
-- SECTION 6 — TRIGGER FUNCTIONS
-- ===========================================================================

-- 6.1 New auth user → profile + wallet + welcome coins + referral code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref_code TEXT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, professional_type, agency_name, phone, avatar_url, city, badge)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NULLIF(NEW.raw_user_meta_data->>'professional_type', ''),
    NULLIF(NEW.raw_user_meta_data->>'agency_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'city', 'Mumbai'),
    CASE WHEN NEW.raw_user_meta_data->>'role' = 'professional'
              AND COALESCE(NEW.raw_user_meta_data->>'professional_type','') <> ''
         THEN UPPER(NEW.raw_user_meta_data->>'professional_type') || ' PRO'
         ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (NEW.id, 25, 25, 0) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.token_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 25, 'earned_referred', 'Welcome bonus platform credits');

  v_ref_code := 'IP-' || UPPER(SUBSTRING(REPLACE(NEW.id::TEXT,'-','') FROM 1 FOR 6));
  INSERT INTO public.referrals (referrer_id, referral_code, status, reward_tokens)
  VALUES (NEW.id, v_ref_code, 'pending', 50) ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

-- 6.2 Reel like counters
CREATE OR REPLACE FUNCTION public.handle_reel_like_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET likes_count = COALESCE(likes_count,0) + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET likes_count = GREATEST(0, COALESCE(likes_count,0) - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END $$;

-- 6.3 Reel comment counters
CREATE OR REPLACE FUNCTION public.handle_reel_comment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET comments_count = COALESCE(comments_count,0) + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET comments_count = GREATEST(0, COALESCE(comments_count,0) - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END $$;

-- 6.4 Notification: new chat message
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name TEXT;
BEGIN
  IF NEW.receiver_id = NEW.sender_id THEN RETURN NEW; END IF;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  VALUES (NEW.receiver_id, 'New message', COALESCE(v_name,'Someone') || ': ' || LEFT(NEW.message, 80), 'message', '/chats');
  RETURN NEW;
END $$;

-- 6.5 Notification: new enquiry
CREATE OR REPLACE FUNCTION public.notify_on_enquiry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.recipient_id = NEW.sender_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  VALUES (NEW.recipient_id, 'New enquiry',
          COALESCE(NULLIF(NEW.name,''),'A user') || ' is interested in your listing', 'enquiry', '/enquiries');
  RETURN NEW;
END $$;

-- 6.6 Notification: reel liked
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID; v_name TEXT; v_title TEXT;
BEGIN
  SELECT user_id, title INTO v_owner, v_title FROM public.reels WHERE id = NEW.reel_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  VALUES (v_owner, 'New like', COALESCE(v_name,'Someone') || ' liked your reel "' || COALESCE(v_title,'') || '"', 'like', '/reels');
  RETURN NEW;
END $$;

-- 6.7 Notification: reel commented
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID; v_name TEXT; v_title TEXT;
BEGIN
  SELECT user_id, title INTO v_owner, v_title FROM public.reels WHERE id = NEW.reel_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  VALUES (v_owner, 'New comment', COALESCE(v_name,'Someone') || ' commented on "' || COALESCE(v_title,'') || '": ' || LEFT(NEW.content, 60), 'comment', '/reels');
  RETURN NEW;
END $$;

-- 6.8 Notification: new follower
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name TEXT;
BEGIN
  IF NEW.following_id = NEW.follower_id THEN RETURN NEW; END IF;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.follower_id;
  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  VALUES (NEW.following_id, 'New follower', COALESCE(v_name,'Someone') || ' started following you', 'follow', '/reels');
  RETURN NEW;
END $$;

-- 6.9 Notification: account verified / role changed
CREATE OR REPLACE FUNCTION public.notify_on_account_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verified IS DISTINCT FROM OLD.verified AND NEW.verified = TRUE THEN
    INSERT INTO public.notifications (user_id, title, message, type, link_url)
    VALUES (NEW.id, 'Account verified', 'Your account has been verified by the IndoProperty team.', 'account', '/profile');
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.notifications (user_id, title, message, type, link_url)
    VALUES (NEW.id, 'Account updated', 'Your account role was changed to "' || NEW.role || '".', 'account', '/profile');
  END IF;
  RETURN NEW;
END $$;

-- 6.10 Notification: new property matches a user's saved search
CREATE OR REPLACE FUNCTION public.notify_on_property_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  SELECT sp.user_id, 'New property match',
         'New listing in ' || COALESCE(NULLIF(NEW.city,''),'your area') || ': "' || LEFT(NEW.title, 60) || '" — matches your saved search.',
         'match', '/property/' || NEW.id::TEXT
  FROM public.saved_preferences sp
  WHERE sp.notify_matches = TRUE
    AND sp.user_id <> NEW.owner_id
    AND (sp.city          IS NULL OR LOWER(sp.city) = LOWER(NEW.city))
    AND (sp.property_type IS NULL OR sp.property_type = NEW.property_type)
    AND (sp.listing_type  IS NULL OR sp.listing_type  = NEW.listing_type)
    AND (sp.min_price     IS NULL OR NEW.price    >= sp.min_price)
    AND (sp.max_price     IS NULL OR NEW.price    <= sp.max_price)
    AND (sp.bedrooms      IS NULL OR NEW.bedrooms >= sp.bedrooms);
  RETURN NEW;
END $$;


-- ===========================================================================
-- SECTION 7 — ATTACH TRIGGERS (guarded by to_regclass for safety)
-- ===========================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$
BEGIN
  IF to_regclass('public.reel_likes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS on_reel_like_changed ON public.reel_likes;
    CREATE TRIGGER on_reel_like_changed AFTER INSERT OR DELETE ON public.reel_likes
      FOR EACH ROW EXECUTE FUNCTION public.handle_reel_like_change();
  END IF;

  IF to_regclass('public.reel_comments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS on_reel_comment_changed ON public.reel_comments;
    CREATE TRIGGER on_reel_comment_changed AFTER INSERT OR DELETE ON public.reel_comments
      FOR EACH ROW EXECUTE FUNCTION public.handle_reel_comment_change();
  END IF;

  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_on_message ON public.chat_messages;
    CREATE TRIGGER trg_notify_on_message AFTER INSERT ON public.chat_messages
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();
  END IF;

  IF to_regclass('public.enquiries') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_on_enquiry ON public.enquiries;
    CREATE TRIGGER trg_notify_on_enquiry AFTER INSERT ON public.enquiries
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_enquiry();
  END IF;

  IF to_regclass('public.reel_likes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_on_like ON public.reel_likes;
    CREATE TRIGGER trg_notify_on_like AFTER INSERT ON public.reel_likes
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();
  END IF;

  IF to_regclass('public.reel_comments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.reel_comments;
    CREATE TRIGGER trg_notify_on_comment AFTER INSERT ON public.reel_comments
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();
  END IF;

  IF to_regclass('public.followers') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_on_follow ON public.followers;
    CREATE TRIGGER trg_notify_on_follow AFTER INSERT ON public.followers
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_on_account_update ON public.profiles;
    CREATE TRIGGER trg_notify_on_account_update AFTER UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_account_update();
  END IF;

  IF to_regclass('public.properties') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_on_property_match ON public.properties;
    CREATE TRIGGER trg_notify_on_property_match AFTER INSERT ON public.properties
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_property_match();
  END IF;
END $$;


-- ===========================================================================
-- SECTION 8 — ENABLE ROW LEVEL SECURITY
-- ===========================================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_media     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_saves         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_properties   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_wallets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_preferences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads                ENABLE ROW LEVEL SECURITY;


-- ===========================================================================
-- SECTION 9 — RLS POLICIES
-- ===========================================================================

-- PROFILES
CREATE POLICY "profiles_select_all"   ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own"   ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"   ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE USING (public.is_admin(auth.uid()));

-- PROPERTIES
CREATE POLICY "properties_select_all"   ON public.properties FOR SELECT USING (true);
CREATE POLICY "properties_insert_own"   ON public.properties FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "properties_update_own"   ON public.properties FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "properties_delete_own"   ON public.properties FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "properties_admin_update" ON public.properties FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "properties_admin_delete" ON public.properties FOR DELETE USING (public.is_admin(auth.uid()));

-- PROPERTY MEDIA
CREATE POLICY "prop_media_select_all"   ON public.property_media FOR SELECT USING (true);
CREATE POLICY "prop_media_insert_owner" ON public.property_media FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND owner_id = auth.uid()));
CREATE POLICY "prop_media_delete_owner" ON public.property_media FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND owner_id = auth.uid()));

-- REELS
CREATE POLICY "reels_select_published" ON public.reels FOR SELECT USING (status = 'published' OR auth.uid() = user_id);
CREATE POLICY "reels_insert_own"       ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_update_own"       ON public.reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reels_delete_own"       ON public.reels FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "reels_admin_delete"     ON public.reels FOR DELETE USING (public.is_admin(auth.uid()));

-- REEL LIKES
CREATE POLICY "reel_likes_select_all"  ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert_own"  ON public.reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete_own"  ON public.reel_likes FOR DELETE USING (auth.uid() = user_id);

-- REEL COMMENTS
CREATE POLICY "reel_comments_select_all" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_insert_own" ON public.reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_comments_delete_own" ON public.reel_comments FOR DELETE USING (auth.uid() = user_id);

-- REEL SAVES
CREATE POLICY "reel_saves_select_own"  ON public.reel_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reel_saves_insert_own"  ON public.reel_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_saves_delete_own"  ON public.reel_saves FOR DELETE USING (auth.uid() = user_id);

-- SAVED PROPERTIES
CREATE POLICY "saved_props_select_own" ON public.saved_properties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_props_insert_own" ON public.saved_properties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_props_delete_own" ON public.saved_properties FOR DELETE USING (auth.uid() = user_id);

-- FOLLOWERS
CREATE POLICY "followers_select_all"   ON public.followers FOR SELECT USING (true);
CREATE POLICY "followers_insert_own"   ON public.followers FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "followers_delete_own"   ON public.followers FOR DELETE USING (auth.uid() = follower_id);

-- ENQUIRIES
CREATE POLICY "enquiries_select_parties" ON public.enquiries FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "enquiries_insert_auth"    ON public.enquiries FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "enquiries_update_recip"   ON public.enquiries FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY "enquiries_delete_own"     ON public.enquiries FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "enquiries_admin_select"   ON public.enquiries FOR SELECT USING (public.is_admin(auth.uid()));

-- CHAT MESSAGES
CREATE POLICY "chat_select_parties"  ON public.chat_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "chat_insert_sender"   ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "chat_update_receiver" ON public.chat_messages FOR UPDATE USING (auth.uid() = receiver_id);

-- NOTIFICATIONS
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_own" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- REPORTS
CREATE POLICY "reports_select_own"   ON public.reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "reports_insert_own"   ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_admin_select" ON public.reports FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "reports_admin_update" ON public.reports FOR UPDATE USING (public.is_admin(auth.uid()));

-- TOKEN WALLETS
CREATE POLICY "wallets_select"       ON public.token_wallets FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "wallets_admin_update" ON public.token_wallets FOR UPDATE USING (public.is_admin(auth.uid()));

-- TOKEN TRANSACTIONS
CREATE POLICY "transactions_select"       ON public.token_transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "transactions_admin_insert" ON public.token_transactions FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- LOAN APPLICATIONS
CREATE POLICY "loans_select"       ON public.loan_applications FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "loans_insert"       ON public.loan_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "loans_admin_update" ON public.loan_applications FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "loans_admin_delete" ON public.loan_applications FOR DELETE USING (public.is_admin(auth.uid()));

-- REFERRALS
CREATE POLICY "referrals_select"    ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.is_admin(auth.uid()));
CREATE POLICY "referrals_insert"    ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referrer_id);
CREATE POLICY "referrals_admin_all" ON public.referrals FOR ALL USING (public.is_admin(auth.uid()));

-- PLATFORM SETTINGS
CREATE POLICY "platform_settings_select_all"   ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "platform_settings_admin_update" ON public.platform_settings FOR UPDATE USING (public.is_admin(auth.uid()));

-- SAVED PREFERENCES
CREATE POLICY "saved_pref_select_own" ON public.saved_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_pref_insert_own" ON public.saved_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_pref_update_own" ON public.saved_preferences FOR UPDATE USING (auth.uid() = user_id);

-- ADS (everyone reads; only admins create/update/delete)
CREATE POLICY "ads_select_all"    ON public.ads FOR SELECT USING (true);
CREATE POLICY "ads_admin_insert"  ON public.ads FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "ads_admin_update"  ON public.ads FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "ads_admin_delete"  ON public.ads FOR DELETE USING (public.is_admin(auth.uid()));


-- ===========================================================================
-- SECTION 10 — GRANTS
-- ===========================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL    ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL    ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.increment_property_views(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_featured_boosted()      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_tokens(UUID, INTEGER, TEXT, TEXT, TEXT)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_tokens(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_tokens(UUID, INTEGER, TEXT, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT, UUID)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.gift_coins(TEXT, INTEGER)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.gift_coins_by_phone(TEXT, INTEGER)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coins_for_feature(UUID)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coins_for_boost(UUID)                         TO authenticated;


-- ===========================================================================
-- SECTION 11 — VERIFICATION (should list 20 tables and 20 functions)
-- ===========================================================================
SELECT 'TABLE' AS kind, tablename AS name
FROM pg_tables WHERE schemaname = 'public'
UNION ALL
SELECT 'FUNCTION', p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY kind, name;


-- =============================================================================
-- DONE.
--
-- NEXT STEPS (all optional / dashboard-only — no SQL required):
--   1. Storage  → keep using CLOUDINARY. Nothing to do here.
--   2. SMTP     → Authentication → Emails → SMTP Settings (custom SMTP).
--   3. MFA/2FA  → Authentication → Multi-Factor Auth → enable "Authenticator app".
--   4. Realtime → Database → Replication → supabase_realtime → enable the
--                 "notifications" table (for the instant unread badge).
--   5. Make yourself admin:
--        UPDATE public.profiles SET role = 'admin' WHERE email = 'you@example.com';
-- =============================================================================
