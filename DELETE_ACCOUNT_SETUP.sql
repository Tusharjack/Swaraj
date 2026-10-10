-- =============================================================================
-- IndoProperty — Account Deletion Support SQL
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (all statements are idempotent)
-- =============================================================================

-- 1. Allow users to delete their own sent/received enquiries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'enquiries' AND policyname = 'enquiries_delete_own'
  ) THEN
    CREATE POLICY "enquiries_delete_own" ON public.enquiries
      FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
  END IF;
END $$;

-- 2. Allow users to delete their own reel comments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reel_comments' AND policyname = 'reel_comments_delete_own'
  ) THEN
    CREATE POLICY "reel_comments_delete_own" ON public.reel_comments
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Allow authenticated users to delete their own storage files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'storage_avatars_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_avatars_delete" ON storage.objects
      FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'storage_properties_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_properties_delete" ON storage.objects
      FOR DELETE USING (bucket_id = 'properties' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'storage_reels_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "storage_reels_delete" ON storage.objects
      FOR DELETE USING (bucket_id = 'reels' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- =============================================================================
-- DONE. Now deploy the Edge Function (see DELETE_ACCOUNT_SETUP.md)
-- =============================================================================




