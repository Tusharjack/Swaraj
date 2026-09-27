-- =============================================================================
-- SWARAJ REAL-ESTATE PLATFORM — MASTER SUPABASE SETUP
-- =============================================================================
-- Paste this entire file into the Supabase SQL Editor and click RUN.
--
-- ⚠️  CHOOSE ONE:
--   A) FRESH DATABASE  — uncomment Section 2 (DROP TABLES) before running.
--      This wipes all existing data and rebuilds from scratch.
--
--   B) EXISTING DATABASE — leave Section 2 commented out (default).
--      The script alters types/constraints in place and creates any
--      missing tables without touching existing rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 2. CLEAN SLATE (FRESH DATABASE ONLY — uncomment if starting from scratch)
-- ---------------------------------------------------------------------------
/*
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
*/

-- ---------------------------------------------------------------------------
-- 3. PROFILES
--    id must be UUID referencing auth.users so that auth.uid() works in RLS.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email            TEXT        NOT NULL,
  full_name        TEXT        NOT NULL,
  role             TEXT        NOT NULL DEFAULT 'customer'
                               CHECK (role IN ('customer','professional','admin')),
  professional_type TEXT       CHECK (professional_type IN ('broker','builder','owner')),
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
CREATE TABLE IF NOT EXISTS public.properties (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title            TEXT        NOT NULL,
  description      TEXT        NOT NULL DEFAULT '',
  price            NUMERIC     NOT NULL DEFAULT 0,
  property_type    TEXT        NOT NULL DEFAULT 'apartment',
  listing_type     TEXT        NOT NULL DEFAULT 'sell',
  bedrooms         INTEGER     NOT NULL DEFAULT 1,
  bathrooms        INTEGER     NOT NULL DEFAULT 1,
  area_sqft        NUMERIC     NOT NULL DEFAULT 0,
  location         TEXT        NOT NULL DEFAULT '',
  city             TEXT        NOT NULL DEFAULT 'Mumbai',
  owner_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'available',
  featured         BOOLEAN     NOT NULL DEFAULT FALSE,
  views_count      INTEGER     NOT NULL DEFAULT 0,
  amenities        TEXT[]      NOT NULL DEFAULT '{}',
  images           TEXT[]      NOT NULL DEFAULT '{}'
);

-- Fix property_type constraint to match TypeScript types
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_property_type_check;
ALTER TABLE public.properties ADD CONSTRAINT properties_property_type_check
  CHECK (property_type IN ('flat','apartment','villa','penthouse','plot','commercial','land','farmhouse'));

-- Fix listing_type constraint
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_listing_type_check;
ALTER TABLE public.properties ADD CONSTRAINT properties_listing_type_check
  CHECK (listing_type IN ('buy','sell','rent','lease'));

-- Fix status constraint
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_status_check;
ALTER TABLE public.properties ADD CONSTRAINT properties_status_check
  CHECK (status IN ('active','available','pending','sold','archived'));

-- ---------------------------------------------------------------------------
-- 5. PROPERTY MEDIA
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.property_media (
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
CREATE TABLE IF NOT EXISTS public.reels (
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
);

-- Fix reels.status constraint (was 'published'|'under_review'|'hidden', now draft/published/archived)
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_status_check;
ALTER TABLE public.reels ADD CONSTRAINT reels_status_check
  CHECK (status IN ('draft','published','archived'));

-- Migrate any rows using the old status values
UPDATE public.reels SET status = 'published' WHERE status NOT IN ('draft','published','archived');

-- Add views_count if the column was missing from an older schema
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---------------------------------------------------------------------------
-- 7. REEL LIKES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reel_likes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reel_id          UUID        NOT NULL REFERENCES public.reels(id)    ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (reel_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 8. REEL COMMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reel_comments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reel_id          UUID        NOT NULL REFERENCES public.reels(id)    ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content          TEXT        NOT NULL
);

-- ---------------------------------------------------------------------------
-- 9. REEL SAVES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reel_saves (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reel_id          UUID        NOT NULL REFERENCES public.reels(id)    ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (reel_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 10. SAVED PROPERTIES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_properties (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  property_id      UUID        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  UNIQUE (property_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 11. FOLLOWERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.followers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  follower_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (follower_id, following_id)
);

-- ---------------------------------------------------------------------------
-- 12. ENQUIRIES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enquiries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  property_id      UUID        REFERENCES public.properties(id) ON DELETE SET NULL,
  reel_id          UUID        REFERENCES public.reels(id)       ON DELETE SET NULL,
  sender_id        UUID        REFERENCES public.profiles(id)    ON DELETE SET NULL,
  recipient_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_email  TEXT,
  name             TEXT        NOT NULL DEFAULT '',
  email            TEXT        NOT NULL DEFAULT '',
  phone            TEXT        NOT NULL DEFAULT '',
  message          TEXT        NOT NULL DEFAULT '',
  status           TEXT        NOT NULL DEFAULT 'new'
                               CHECK (status IN ('new','contacted','closed'))
);

-- Add recipient_email if missing from an older schema
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS recipient_email TEXT;

-- ---------------------------------------------------------------------------
-- 13. CHAT MESSAGES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
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
CREATE TABLE IF NOT EXISTS public.notifications (
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
CREATE TABLE IF NOT EXISTS public.reports (
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
CREATE INDEX IF NOT EXISTS idx_properties_owner    ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_city     ON public.properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_type     ON public.properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_listing  ON public.properties(listing_type);
CREATE INDEX IF NOT EXISTS idx_properties_status   ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_price    ON public.properties(price);
CREATE INDEX IF NOT EXISTS idx_reels_user          ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_property      ON public.reels(property_id);
CREATE INDEX IF NOT EXISTS idx_reels_status        ON public.reels(status);
CREATE INDEX IF NOT EXISTS idx_reels_created       ON public.reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_recipient ON public.enquiries(recipient_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_sender    ON public.enquiries(sender_id);

-- ---------------------------------------------------------------------------
-- 17. AUTO-CREATE PROFILE TRIGGER
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION  IF EXISTS public.handle_new_user();

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
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 18. ROW LEVEL SECURITY
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

-- Drop any old policies before recreating (safe to run multiple times)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','properties','property_media','reels','reel_likes',
        'reel_comments','reel_saves','saved_properties','followers',
        'enquiries','chat_messages','notifications','reports'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- PROFILES
CREATE POLICY "profiles_select_all"     ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own"     ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"     ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- PROPERTIES
CREATE POLICY "properties_select_all"   ON public.properties FOR SELECT USING (true);
CREATE POLICY "properties_insert_own"   ON public.properties FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "properties_update_own"   ON public.properties FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "properties_delete_own"   ON public.properties FOR DELETE USING (auth.uid() = owner_id);

-- PROPERTY MEDIA
CREATE POLICY "prop_media_select_all"   ON public.property_media FOR SELECT USING (true);
CREATE POLICY "prop_media_insert_owner" ON public.property_media FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND owner_id = auth.uid())
);
CREATE POLICY "prop_media_delete_owner" ON public.property_media FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND owner_id = auth.uid())
);

-- REELS — customers see published; owners see all their own
CREATE POLICY "reels_select_published"  ON public.reels FOR SELECT
  USING (status = 'published' OR auth.uid() = user_id);
CREATE POLICY "reels_insert_own"        ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_update_own"        ON public.reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reels_delete_own"        ON public.reels FOR DELETE USING (auth.uid() = user_id);

-- REEL LIKES
CREATE POLICY "reel_likes_select_all"   ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert_own"   ON public.reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete_own"   ON public.reel_likes FOR DELETE USING (auth.uid() = user_id);

-- REEL COMMENTS
CREATE POLICY "reel_comments_select"    ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_insert"    ON public.reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- REEL SAVES
CREATE POLICY "reel_saves_select_own"   ON public.reel_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reel_saves_insert_own"   ON public.reel_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_saves_delete_own"   ON public.reel_saves FOR DELETE USING (auth.uid() = user_id);

-- SAVED PROPERTIES
CREATE POLICY "saved_props_select_own"  ON public.saved_properties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_props_insert_own"  ON public.saved_properties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_props_delete_own"  ON public.saved_properties FOR DELETE USING (auth.uid() = user_id);

-- FOLLOWERS
CREATE POLICY "followers_select_all"    ON public.followers FOR SELECT USING (true);
CREATE POLICY "followers_insert_own"    ON public.followers FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "followers_delete_own"    ON public.followers FOR DELETE USING (auth.uid() = follower_id);

-- ENQUIRIES
CREATE POLICY "enquiries_select_parties" ON public.enquiries FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "enquiries_insert_auth"    ON public.enquiries FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "enquiries_update_recip"   ON public.enquiries FOR UPDATE
  USING (auth.uid() = recipient_id);

-- CHAT MESSAGES
CREATE POLICY "chat_select_parties"     ON public.chat_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "chat_insert_sender"      ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "chat_update_receiver"    ON public.chat_messages FOR UPDATE
  USING (auth.uid() = receiver_id);

-- NOTIFICATIONS
CREATE POLICY "notif_select_own"        ON public.notifications FOR SELECT USING (auth.uid() = user_id);

-- REPORTS
CREATE POLICY "reports_select_own"      ON public.reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "reports_insert_own"      ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- 19. STORAGE BUCKETS
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('properties', 'properties', true),
  ('reels',      'reels',      true),
  ('avatars',    'avatars',    true)
ON CONFLICT (id) DO NOTHING;

-- Drop old permissive storage policies if they exist
DROP POLICY IF EXISTS "Public Storage Access Reels"      ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Access Properties" ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Access Avatars"    ON storage.objects;

-- Recreate with read-all / write-auth policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'storage_reels_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_reels_read"
      ON storage.objects FOR SELECT USING (bucket_id = 'reels');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'storage_reels_insert' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_reels_insert"
      ON storage.objects FOR INSERT WITH CHECK (
        bucket_id = 'reels' AND auth.uid() IS NOT NULL
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'storage_properties_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_properties_read"
      ON storage.objects FOR SELECT USING (bucket_id = 'properties');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'storage_properties_insert' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_properties_insert"
      ON storage.objects FOR INSERT WITH CHECK (
        bucket_id = 'properties' AND auth.uid() IS NOT NULL
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'storage_avatars_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_avatars_read"
      ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'storage_avatars_insert' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_avatars_insert"
      ON storage.objects FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 20. GRANTS (ensures anon + authenticated can execute)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL    ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL    ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =============================================================================
-- DONE.
-- After running this script:
--   1. Go to Supabase Dashboard → Settings → API
--   2. Copy your Project URL and anon/public key (starts with "eyJ...")
--   3. Paste them into your .env file:
--        VITE_SUPABASE_URL=https://xxxx.supabase.co
--        VITE_SUPABASE_ANON_KEY=eyJhbGci...
--   4. Restart your dev server.
--   5. Test: Publisher login → create property/reel → Customer login (incognito)
--      → refresh → property/reel should appear.
-- =============================================================================
