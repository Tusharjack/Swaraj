-- =============================================================================
-- SWARAJ REAL-ESTATE PLATFORM — AUTHORITATIVE DATABASE SCHEMA
-- =============================================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- This is a CLEAN-SLATE migration: it drops all existing tables and rebuilds
-- them from scratch. Do NOT run on a live database with data you want to keep.
-- For an existing database see SWARAJ_SUPABASE_MASTER_SETUP.sql instead.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 2. CLEAN SLATE — drop old objects in dependency order
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION  IF EXISTS public.handle_new_user();

DROP TABLE IF EXISTS public.reports            CASCADE;
DROP TABLE IF EXISTS public.notifications      CASCADE;
DROP TABLE IF EXISTS public.chat_messages      CASCADE;
DROP TABLE IF EXISTS public.saved_properties   CASCADE;
DROP TABLE IF EXISTS public.enquiries          CASCADE;
DROP TABLE IF EXISTS public.followers          CASCADE;
DROP TABLE IF EXISTS public.reel_saves         CASCADE;
DROP TABLE IF EXISTS public.reel_comments      CASCADE;
DROP TABLE IF EXISTS public.reel_likes         CASCADE;
DROP TABLE IF EXISTS public.reels              CASCADE;
DROP TABLE IF EXISTS public.property_media     CASCADE;
DROP TABLE IF EXISTS public.properties         CASCADE;
DROP TABLE IF EXISTS public.profiles           CASCADE;

-- ---------------------------------------------------------------------------
-- 3. PROFILES
--    id is the Supabase auth UUID so auth.uid() comparisons work in RLS.
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email            TEXT        NOT NULL,
  full_name        TEXT        NOT NULL,
  role             TEXT        NOT NULL DEFAULT 'customer'
                               CHECK (role IN ('customer', 'professional', 'admin')),
  professional_type TEXT       CHECK (professional_type IN ('broker', 'builder', 'owner')),
  agency_name      TEXT,
  phone            TEXT,
  city             TEXT        DEFAULT 'Mumbai',
  verified         BOOLEAN     NOT NULL DEFAULT FALSE,
  badge            TEXT,
  bio              TEXT,
  avatar_url       TEXT
);

-- ---------------------------------------------------------------------------
-- 4. PROPERTIES
-- ---------------------------------------------------------------------------
CREATE TABLE public.properties (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title            TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  price            NUMERIC     NOT NULL,
  property_type    TEXT        NOT NULL
                               CHECK (property_type IN (
                                 'flat','apartment','villa','penthouse',
                                 'plot','commercial','land','farmhouse'
                               )),
  listing_type     TEXT        NOT NULL
                               CHECK (listing_type IN ('buy','sell','rent','lease')),
  bedrooms         INTEGER     NOT NULL DEFAULT 1,
  bathrooms        INTEGER     NOT NULL DEFAULT 1,
  area_sqft        NUMERIC     NOT NULL DEFAULT 0,
  location         TEXT        NOT NULL,
  city             TEXT        NOT NULL DEFAULT 'Mumbai',
  -- owner_id references profiles.id which is a UUID matching auth.uid()
  owner_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'available'
                               CHECK (status IN (
                                 'active','available','pending','sold','archived'
                               )),
  featured         BOOLEAN     NOT NULL DEFAULT FALSE,
  views_count      INTEGER     NOT NULL DEFAULT 0,
  amenities        TEXT[]      NOT NULL DEFAULT '{}',
  images           TEXT[]      NOT NULL DEFAULT '{}'
);

-- ---------------------------------------------------------------------------
-- 5. PROPERTY MEDIA
-- ---------------------------------------------------------------------------
CREATE TABLE public.property_media (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  property_id      UUID        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url              TEXT        NOT NULL,
  media_type       TEXT        NOT NULL DEFAULT 'image'
                               CHECK (media_type IN ('image','video','floorplan')),
  is_cover         BOOLEAN     NOT NULL DEFAULT FALSE,
  display_order    INTEGER     NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- 6. REELS
-- ---------------------------------------------------------------------------
CREATE TABLE public.reels (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id      UUID        REFERENCES public.properties(id) ON DELETE SET NULL,
  video_url        TEXT        NOT NULL,
  thumbnail_url    TEXT,
  title            TEXT        NOT NULL,
  caption          TEXT,
  likes_count      INTEGER     NOT NULL DEFAULT 0,
  comments_count   INTEGER     NOT NULL DEFAULT 0,
  saves_count      INTEGER     NOT NULL DEFAULT 0,
  shares_count     INTEGER     NOT NULL DEFAULT 0,
  views_count      INTEGER     NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'published'
                               CHECK (status IN ('draft','published','archived'))
);

-- ---------------------------------------------------------------------------
-- 7. REEL LIKES
-- ---------------------------------------------------------------------------
CREATE TABLE public.reel_likes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reel_id          UUID        NOT NULL REFERENCES public.reels(id)    ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (reel_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 8. REEL COMMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE public.reel_comments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reel_id          UUID        NOT NULL REFERENCES public.reels(id)    ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content          TEXT        NOT NULL
);

-- ---------------------------------------------------------------------------
-- 9. REEL SAVES
-- ---------------------------------------------------------------------------
CREATE TABLE public.reel_saves (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reel_id          UUID        NOT NULL REFERENCES public.reels(id)    ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (reel_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 10. SAVED PROPERTIES
-- ---------------------------------------------------------------------------
CREATE TABLE public.saved_properties (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  property_id      UUID        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  UNIQUE (property_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 11. FOLLOWERS
-- ---------------------------------------------------------------------------
CREATE TABLE public.followers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  follower_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (follower_id, following_id)
);

-- ---------------------------------------------------------------------------
-- 12. ENQUIRIES
-- ---------------------------------------------------------------------------
CREATE TABLE public.enquiries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  property_id      UUID        REFERENCES public.properties(id) ON DELETE SET NULL,
  reel_id          UUID        REFERENCES public.reels(id)       ON DELETE SET NULL,
  sender_id        UUID        REFERENCES public.profiles(id)    ON DELETE SET NULL,
  recipient_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_email  TEXT,
  name             TEXT        NOT NULL,
  email            TEXT        NOT NULL,
  phone            TEXT        NOT NULL DEFAULT '',
  message          TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'new'
                               CHECK (status IN ('new','contacted','closed'))
);

-- ---------------------------------------------------------------------------
-- 13. CHAT MESSAGES
-- ---------------------------------------------------------------------------
CREATE TABLE public.chat_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enquiry_id       UUID        NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  sender_id        UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  receiver_id      UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  message          TEXT        NOT NULL,
  read             BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ---------------------------------------------------------------------------
-- 14. NOTIFICATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  message          TEXT        NOT NULL,
  type             TEXT        NOT NULL
                               CHECK (type IN ('enquiry','like','comment','follow','system')),
  read             BOOLEAN     NOT NULL DEFAULT FALSE,
  link_url         TEXT
);

-- ---------------------------------------------------------------------------
-- 15. REPORTS
-- ---------------------------------------------------------------------------
CREATE TABLE public.reports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reporter_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type      TEXT        NOT NULL
                               CHECK (target_type IN ('property','reel','user','comment')),
  target_id        UUID        NOT NULL,
  reason           TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','reviewed','resolved','dismissed'))
);

-- ---------------------------------------------------------------------------
-- 16. INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_properties_owner      ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_city       ON public.properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_type       ON public.properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_listing    ON public.properties(listing_type);
CREATE INDEX IF NOT EXISTS idx_properties_status     ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_price      ON public.properties(price);
CREATE INDEX IF NOT EXISTS idx_reels_user            ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_property        ON public.reels(property_id);
CREATE INDEX IF NOT EXISTS idx_reels_status          ON public.reels(status);
CREATE INDEX IF NOT EXISTS idx_reels_created         ON public.reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_recipient   ON public.enquiries(recipient_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_sender      ON public.enquiries(sender_id);

-- ---------------------------------------------------------------------------
-- 17. AUTO-CREATE PROFILE ON SIGNUP TRIGGER
--     Runs SECURITY DEFINER so it can insert into public.profiles without
--     the new user yet having a row there.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, avatar_url, city)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.email
    ),
    COALESCE(NEW.raw_user_meta_data->>'city', 'Mumbai')
  )
  ON CONFLICT (id) DO NOTHING;   -- Safe if the app already upserted the row
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 18. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_media    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_saves        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_properties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports           ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- PROPERTIES — anyone can read; only the owner can write
CREATE POLICY "properties_select_all"
  ON public.properties FOR SELECT USING (true);

CREATE POLICY "properties_insert_own"
  ON public.properties FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "properties_update_own"
  ON public.properties FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "properties_delete_own"
  ON public.properties FOR DELETE USING (auth.uid() = owner_id);

-- PROPERTY MEDIA — readable by all; insertable by the property owner
CREATE POLICY "property_media_select_all"
  ON public.property_media FOR SELECT USING (true);

CREATE POLICY "property_media_insert_owner"
  ON public.property_media FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "property_media_delete_owner"
  ON public.property_media FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

-- REELS — published reels visible to everyone; drafts/archived only to owner
CREATE POLICY "reels_select_published"
  ON public.reels FOR SELECT
  USING (status = 'published' OR auth.uid() = user_id);

CREATE POLICY "reels_insert_own"
  ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reels_update_own"
  ON public.reels FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "reels_delete_own"
  ON public.reels FOR DELETE USING (auth.uid() = user_id);

-- REEL LIKES
CREATE POLICY "reel_likes_select_all"
  ON public.reel_likes FOR SELECT USING (true);

CREATE POLICY "reel_likes_insert_own"
  ON public.reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reel_likes_delete_own"
  ON public.reel_likes FOR DELETE USING (auth.uid() = user_id);

-- REEL COMMENTS
CREATE POLICY "reel_comments_select_all"
  ON public.reel_comments FOR SELECT USING (true);

CREATE POLICY "reel_comments_insert_own"
  ON public.reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- REEL SAVES
CREATE POLICY "reel_saves_select_own"
  ON public.reel_saves FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "reel_saves_insert_own"
  ON public.reel_saves FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reel_saves_delete_own"
  ON public.reel_saves FOR DELETE USING (auth.uid() = user_id);

-- SAVED PROPERTIES
CREATE POLICY "saved_properties_select_own"
  ON public.saved_properties FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "saved_properties_insert_own"
  ON public.saved_properties FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_properties_delete_own"
  ON public.saved_properties FOR DELETE USING (auth.uid() = user_id);

-- FOLLOWERS
CREATE POLICY "followers_select_all"
  ON public.followers FOR SELECT USING (true);

CREATE POLICY "followers_insert_own"
  ON public.followers FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "followers_delete_own"
  ON public.followers FOR DELETE USING (auth.uid() = follower_id);

-- ENQUIRIES — sender or recipient can read
CREATE POLICY "enquiries_select_parties"
  ON public.enquiries FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "enquiries_insert_authenticated"
  ON public.enquiries FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "enquiries_update_recipient"
  ON public.enquiries FOR UPDATE USING (auth.uid() = recipient_id);

-- CHAT MESSAGES — sender or receiver can read
CREATE POLICY "chat_messages_select_parties"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "chat_messages_insert_sender"
  ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "chat_messages_update_receiver"
  ON public.chat_messages FOR UPDATE USING (auth.uid() = receiver_id);

-- NOTIFICATIONS — private to the target user
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

-- REPORTS — private to the reporter
CREATE POLICY "reports_select_own"
  ON public.reports FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "reports_insert_own"
  ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- 19. STORAGE BUCKETS (run separately if storage is not auto-provisioned)
--     In the Supabase Dashboard → Storage create three PUBLIC buckets:
--       • properties   (images)
--       • reels        (videos)
--       • avatars      (profile photos)
--     Then add these storage policies:
-- ---------------------------------------------------------------------------
/*
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('properties', 'properties', true),
  ('reels',      'reels',      true),
  ('avatars',    'avatars',    true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "storage_properties_read_all"
  ON storage.objects FOR SELECT USING (bucket_id = 'properties');

CREATE POLICY "storage_properties_insert_auth"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'properties' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "storage_reels_read_all"
  ON storage.objects FOR SELECT USING (bucket_id = 'reels');

CREATE POLICY "storage_reels_insert_auth"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'reels' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "storage_avatars_read_all"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "storage_avatars_insert_auth"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid() IS NOT NULL
  );
*/

-- =============================================================================
-- DONE. Tables, triggers, indexes, and RLS policies are ready.
-- Next steps:
--   1. Create the Storage buckets (properties, reels, avatars, loan_documents).
--   2. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env with the real
--      values from your Supabase project → Settings → API.
--      The anon key MUST start with "eyJ".
-- =============================================================================

-- =============================================================================
-- TOKEN SYSTEM, HOME LOAN & REFERRAL TABLES & POLICIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.token_wallets (
  user_id        UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance        INTEGER NOT NULL DEFAULT 25 CHECK (balance >= 0),
  total_earned   INTEGER NOT NULL DEFAULT 25 CHECK (total_earned >= 0),
  total_spent    INTEGER NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.token_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL,
  type           TEXT NOT NULL CHECK (type IN (
                   'earned_referral',
                   'earned_referred',
                   'earned_admin',
                   'spent_promotion',
                   'spent_featured',
                   'deducted_admin'
                 )),
  description    TEXT NOT NULL,
  reference_id   TEXT,
  admin_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.loan_applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT NOT NULL,
  date_of_birth    DATE NOT NULL,
  pan_number       TEXT NOT NULL,
  city             TEXT NOT NULL,
  employment_type  TEXT NOT NULL CHECK (employment_type IN ('salaried', 'self_employed', 'business', 'freelancer', 'retired')),
  employer_name    TEXT,
  monthly_income   NUMERIC NOT NULL CHECK (monthly_income > 0),
  other_income     NUMERIC DEFAULT 0,
  existing_emi     NUMERIC DEFAULT 0,
  loan_amount      NUMERIC NOT NULL CHECK (loan_amount > 0),
  tenure_years     INTEGER NOT NULL CHECK (tenure_years >= 1 AND tenure_years <= 35),
  purpose          TEXT NOT NULL,
  property_address TEXT,
  property_city    TEXT,
  property_value   NUMERIC,
  property_id      UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
                     'submitted', 'under_review', 'approved', 'rejected', 'disbursed', 'cancelled'
                   )),
  admin_notes      TEXT,
  approved_amount  NUMERIC,
  disbursed_amount NUMERIC,
  disbursed_at     TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  referral_code  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded', 'invalid')),
  reward_tokens  INTEGER NOT NULL DEFAULT 50,
  rewarded_at    TIMESTAMPTZ,
  referred_email TEXT
);

ALTER TABLE public.token_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets_select" ON public.token_wallets
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "wallets_admin_update" ON public.token_wallets
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "transactions_select" ON public.token_transactions
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "transactions_admin_insert" ON public.token_transactions
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "loans_select" ON public.loan_applications
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "loans_insert" ON public.loan_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "loans_admin_update" ON public.loan_applications
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "loans_admin_delete" ON public.loan_applications
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "referrals_select" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "referrals_insert" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "referrals_admin_all" ON public.referrals
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

