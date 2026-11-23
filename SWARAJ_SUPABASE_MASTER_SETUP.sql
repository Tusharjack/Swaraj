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
-- 15b. AD BANNERS (horizontal home-page ads, managed by admins)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title         TEXT        NOT NULL,
  image_url     TEXT        NOT NULL,
  link_url      TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INTEGER     NOT NULL DEFAULT 0
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
CREATE INDEX IF NOT EXISTS idx_ads_active_order    ON public.ads(is_active, display_order);

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
-- 17B. AUTO-UPDATE LIKES & COMMENTS COUNTS ON REELS (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_reel_like_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_reel_like_changed ON public.reel_likes;
CREATE TRIGGER on_reel_like_changed
  AFTER INSERT OR DELETE ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_reel_like_change();

CREATE OR REPLACE FUNCTION public.handle_reel_comment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET comments_count = GREATEST(0, COALESCE(comments_count, 0) - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_reel_comment_changed ON public.reel_comments;
CREATE TRIGGER on_reel_comment_changed
  AFTER INSERT OR DELETE ON public.reel_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_reel_comment_change();

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

-- =============================================================================
-- PATCH 01 — Account Deletion Support
-- Run this in the Supabase SQL Editor after the master setup script.
-- Safe to run multiple times (all statements use IF NOT EXISTS / OR REPLACE).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A. Enquiries DELETE policy
--    The original schema had no DELETE policy for enquiries, which meant
--    the Edge Function (running as service_role) could delete rows but a
--    client-side call would be blocked by RLS.
--    This policy also allows the owning user to self-serve delete their sent
--    enquiries via the app if needed.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'enquiries'
      AND policyname = 'enquiries_delete_own'
  ) THEN
    CREATE POLICY "enquiries_delete_own" ON public.enquiries
      FOR DELETE
      USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- B. Reel comments DELETE policy
--    Users should be able to delete their own comments.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'reel_comments'
      AND policyname = 'reel_comments_delete_own'
  ) THEN
    CREATE POLICY "reel_comments_delete_own" ON public.reel_comments
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- C. Storage object DELETE policies
--    The original setup only had SELECT + INSERT policies on storage.objects.
--    The Edge Function uses service_role (bypasses RLS) so it can always
--    delete storage files.  These policies additionally allow authenticated
--    users to delete their own files via the anon client (e.g. avatar update).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'storage_avatars_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_avatars_delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'storage_properties_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_properties_delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'properties' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'storage_reels_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_reels_delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'reels' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- D. Notifications INSERT policy
--    Required so server-side triggers / Edge Functions can insert notifications
--    on behalf of users (e.g. "your account deletion was processed").
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'notifications'
      AND policyname = 'notif_insert_own'
  ) THEN
    CREATE POLICY "notif_insert_own" ON public.notifications
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- E. Verify cascade is in place on profiles → auth.users
--    (Informational — cannot ALTER an FK in Supabase managed schema;
--     this block just confirms the cascade exists and logs a notice.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  cascade_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM   information_schema.referential_constraints rc
    JOIN   information_schema.table_constraints tc
           ON rc.constraint_name = tc.constraint_name
    WHERE  tc.table_name   = 'profiles'
      AND  rc.delete_rule  = 'CASCADE'
  ) INTO cascade_exists;

  IF cascade_exists THEN
    RAISE NOTICE 'OK: profiles.id ON DELETE CASCADE is in place.';
  ELSE
    RAISE WARNING 'MISSING: profiles.id does not have ON DELETE CASCADE. Account deletion will not cascade. Re-run the master setup script.';
  END IF;
END $$;

-- =============================================================================
-- PATCH 01 DONE.
-- Summary of what was added:
--   • enquiries_delete_own   — users can delete their own sent/received enquiries
--   • reel_comments_delete_own — users can delete their own comments
--   • storage_avatars_delete   — authenticated users can delete avatar files
--   • storage_properties_delete — authenticated users can delete property images
--   • storage_reels_delete     — authenticated users can delete reel videos
--   • notif_insert_own         — users can insert their own notifications
-- =============================================================================

-- =============================================================================
-- PATCH 02 — Token System, Home Loan Facilitation & Referral System
-- Run this in the Supabase SQL Editor.
-- Safe to run multiple times (all statements use IF NOT EXISTS / OR REPLACE).
-- =============================================================================

-- 1. Helper check for admin role
CREATE OR REPLACE FUNCTION public.is_admin(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_uid AND role = 'admin'
  );
$$;

-- 2. Token Wallets
CREATE TABLE IF NOT EXISTS public.token_wallets (
  user_id        UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance        INTEGER NOT NULL DEFAULT 25 CHECK (balance >= 0),
  total_earned   INTEGER NOT NULL DEFAULT 25 CHECK (total_earned >= 0),
  total_spent    INTEGER NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Token Transactions
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

CREATE INDEX IF NOT EXISTS idx_token_tx_user ON public.token_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_token_tx_created ON public.token_transactions (created_at DESC);

-- 4. Home Loan Applications
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

CREATE INDEX IF NOT EXISTS idx_loans_user ON public.loan_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loan_applications (status);

-- 5. Referrals
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

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals (UPPER(referral_code));
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_code_unique ON public.referrals (referral_code) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referred_unique ON public.referrals (referred_id) WHERE status IN ('completed', 'rewarded');

-- 6. Storage Bucket for Loan Documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('loan_documents', 'loan_documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 7. RLS
ALTER TABLE public.token_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wallets_select' AND tablename = 'token_wallets') THEN
    CREATE POLICY "wallets_select" ON public.token_wallets
      FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wallets_admin_update' AND tablename = 'token_wallets') THEN
    CREATE POLICY "wallets_admin_update" ON public.token_wallets
      FOR UPDATE USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'transactions_select' AND tablename = 'token_transactions') THEN
    CREATE POLICY "transactions_select" ON public.token_transactions
      FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'transactions_admin_insert' AND tablename = 'token_transactions') THEN
    CREATE POLICY "transactions_admin_insert" ON public.token_transactions
      FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loans_select' AND tablename = 'loan_applications') THEN
    CREATE POLICY "loans_select" ON public.loan_applications
      FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loans_insert' AND tablename = 'loan_applications') THEN
    CREATE POLICY "loans_insert" ON public.loan_applications
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loans_admin_update' AND tablename = 'loan_applications') THEN
    CREATE POLICY "loans_admin_update" ON public.loan_applications
      FOR UPDATE USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loans_admin_delete' AND tablename = 'loan_applications') THEN
    CREATE POLICY "loans_admin_delete" ON public.loan_applications
      FOR DELETE USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'referrals_select' AND tablename = 'referrals') THEN
    CREATE POLICY "referrals_select" ON public.referrals
      FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'referrals_insert' AND tablename = 'referrals') THEN
    CREATE POLICY "referrals_insert" ON public.referrals
      FOR INSERT WITH CHECK (auth.uid() = referrer_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'referrals_admin_all' AND tablename = 'referrals') THEN
    CREATE POLICY "referrals_admin_all" ON public.referrals
      FOR ALL USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ads_select_all' AND tablename = 'ads') THEN
    CREATE POLICY "ads_select_all" ON public.ads
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ads_admin_insert' AND tablename = 'ads') THEN
    CREATE POLICY "ads_admin_insert" ON public.ads
      FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ads_admin_update' AND tablename = 'ads') THEN
    CREATE POLICY "ads_admin_update" ON public.ads
      FOR UPDATE USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ads_admin_delete' AND tablename = 'ads') THEN
    CREATE POLICY "ads_admin_delete" ON public.ads
      FOR DELETE USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loan_doc_select' AND tablename = 'objects') THEN
    CREATE POLICY "loan_doc_select" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'loan_documents' AND
        ( (storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()) )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loan_doc_insert' AND tablename = 'objects') THEN
    CREATE POLICY "loan_doc_insert" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'loan_documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- 8. RPC Functions
CREATE OR REPLACE FUNCTION public.spend_tokens(
  p_user_id      UUID,
  p_amount       INTEGER,
  p_type         TEXT,
  p_description  TEXT,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_curr_balance INTEGER;
  v_new_balance  INTEGER;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() != p_user_id AND NOT public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to spend tokens for this account.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Spend amount must be greater than zero.';
  END IF;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (p_user_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_curr_balance
  FROM public.token_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_curr_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient token balance (required %, available %).', p_amount, v_curr_balance;
  END IF;

  UPDATE public.token_wallets
  SET balance     = balance - p_amount,
      total_spent = total_spent + p_amount,
      updated_at  = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (p_user_id, -p_amount, p_type, p_description, p_reference_id);

  IF p_type = 'spent_promotion' AND p_reference_id IS NOT NULL THEN
    BEGIN
      UPDATE public.properties
      SET featured = TRUE,
          updated_at = NOW()
      WHERE id = p_reference_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_tokens(
  p_user_id      UUID,
  p_amount       INTEGER,
  p_type         TEXT,
  p_description  TEXT,
  p_admin_id     UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
  v_actual_admin UUID;
BEGIN
  v_actual_admin := COALESCE(auth.uid(), p_admin_id);

  IF v_actual_admin IS NULL OR NOT public.is_admin(v_actual_admin) THEN
    RAISE EXCEPTION 'Only platform administrators can manually adjust token balances.';
  END IF;

  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (p_user_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.token_wallets
  SET balance      = GREATEST(0, balance + p_amount),
      total_earned = total_earned + CASE WHEN p_amount > 0 THEN p_amount ELSE 0 END,
      total_spent  = total_spent + CASE WHEN p_amount < 0 THEN ABS(p_amount) ELSE 0 END,
      updated_at   = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.token_transactions (user_id, amount, type, description, admin_id)
  VALUES (p_user_id, p_amount, p_type, p_description, v_actual_admin);

  RETURN v_new_balance;
END;
$$;

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
  v_welcome_bonus INTEGER := 25;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() != p_referred_id AND NOT public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to apply referral code for this user.';
  END IF;

  v_clean_code := UPPER(TRIM(p_code));

  IF v_clean_code = '' THEN
    RAISE EXCEPTION 'Please provide a valid referral code.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.referrals
    WHERE referred_id = p_referred_id AND status IN ('completed', 'rewarded')
  ) THEN
    RAISE EXCEPTION 'You have already redeemed a referral reward on this account.';
  END IF;

  SELECT id, referrer_id, status, reward_tokens
  INTO v_referral_id, v_referrer_id, v_ref_status, v_reward_tokens
  FROM public.referrals
  WHERE UPPER(referral_code) = v_clean_code
    AND status != 'invalid'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE 'IP-' || UPPER(SUBSTRING(REPLACE(id::TEXT, '-', '') FROM 1 FOR 6)) = v_clean_code;
  END IF;

  IF v_referrer_id IS NULL THEN
    RAISE EXCEPTION 'Referral code "%" was not found or is invalid.', v_clean_code;
  END IF;

  IF v_referrer_id = p_referred_id THEN
    RAISE EXCEPTION 'You cannot use your own referral code.';
  END IF;

  -- Referrer reward (+50)
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (v_referrer_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.token_wallets
  SET balance      = balance + v_reward_tokens,
      total_earned = total_earned + v_reward_tokens,
      updated_at   = NOW()
  WHERE user_id = v_referrer_id;

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_referrer_id, v_reward_tokens, 'earned_referral', 'Referral reward for inviting a new user', p_referred_id::TEXT);

  -- Referred user bonus (+25)
  INSERT INTO public.token_wallets (user_id, balance, total_earned, total_spent)
  VALUES (p_referred_id, 25, 25, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.token_wallets
  SET balance      = balance + v_welcome_bonus,
      total_earned = total_earned + v_welcome_bonus,
      updated_at   = NOW()
  WHERE user_id = p_referred_id;

  INSERT INTO public.token_transactions (user_id, amount, type, description, reference_id)
  VALUES (p_referred_id, v_welcome_bonus, 'earned_referred', 'Bonus tokens for signing up with referral code ' || v_clean_code, v_referrer_id::TEXT);

  IF v_referral_id IS NOT NULL AND v_ref_status = 'pending' THEN
    UPDATE public.referrals
    SET referred_id = p_referred_id,
        status = 'rewarded',
        rewarded_at = NOW()
    WHERE id = v_referral_id;
  ELSE
    INSERT INTO public.referrals (referrer_id, referred_id, referral_code, status, reward_tokens, rewarded_at)
    VALUES (v_referrer_id, p_referred_id, v_clean_code, 'rewarded', v_reward_tokens, NOW());
  END IF;

  RETURN 'Referral applied successfully! ' || v_welcome_bonus || ' bonus tokens have been credited to your wallet.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_tokens(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_tokens(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT, UUID) TO authenticated;
-- =============================================================================
-- PATCH 02 DONE.
-- =============================================================================
