// supabase/functions/delete-account/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// IndoProperty — Delete Account Edge Function
//
// Called by the authenticated user's own session.
// Uses the SERVICE_ROLE key (server-side only — never sent to the client) to:
//   1. Verify the request carries a valid user JWT
//   2. Delete all user-owned data that is NOT handled by DB ON DELETE CASCADE
//      (storage files in the avatars / properties / reels buckets)
//   3. Delete the Supabase Auth user record, which cascades to the profiles
//      table and all child rows (properties, reels, enquiries, chat_messages,
//      notifications, reports, followers, reel_likes, reel_saves, etc.)
//
// Security model:
//   - The service_role key is ONLY available as a Deno environment variable
//     inside this Edge Function. It is never returned to the caller.
//   - The caller must supply a valid Bearer JWT in the Authorization header.
//     The function verifies the token before doing anything destructive.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // ── 1. Read env vars (set in Supabase Dashboard → Edge Functions → Secrets) ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('[delete-account] Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Verify the caller is authenticated (use anon client + their JWT) ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing or invalid Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userJwt = authHeader.replace('Bearer ', '');

    // Create a user-scoped client to verify the JWT is real and get the user ID
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid or expired session.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`[delete-account] Starting deletion for user: ${userId}`);

    // ── 3. Create an admin client (service_role — server-side only) ──
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 4. Delete user-owned storage files ──────────────────────────────────
    // DB cascade handles the rows; storage files must be deleted separately.

    // 4a. Delete avatar files (stored as: {timestamp}_{random}.ext)
    //     We list all objects under the user's folder pattern — avatars bucket
    //     doesn't have user-sub-folders, so we look up the avatar_url from profile.
    const { data: profileData } = await adminClient
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (profileData?.avatar_url) {
      const avatarUrl = profileData.avatar_url as string;
      // Only delete if it's a Supabase storage URL (not a DiceBear/external URL)
      if (avatarUrl.includes('/storage/v1/object/public/avatars/')) {
        const pathPart = avatarUrl.split('/storage/v1/object/public/avatars/')[1];
        if (pathPart) {
          const { error: avatarDeleteError } = await adminClient.storage
            .from('avatars')
            .remove([pathPart]);
          if (avatarDeleteError) {
            console.warn('[delete-account] Avatar storage delete error (non-fatal):', avatarDeleteError.message);
          }
        }
      }
    }

    // 4b. Delete property images (properties bucket)
    const { data: userProperties } = await adminClient
      .from('properties')
      .select('id, images')
      .eq('owner_id', userId);

    if (userProperties && userProperties.length > 0) {
      const propertyImagePaths: string[] = [];
      for (const prop of userProperties) {
        const imgs = (prop.images as string[]) || [];
        for (const imgUrl of imgs) {
          if (imgUrl.includes('/storage/v1/object/public/properties/')) {
            const pathPart = imgUrl.split('/storage/v1/object/public/properties/')[1];
            if (pathPart) propertyImagePaths.push(pathPart);
          }
        }
      }
      // Also check property_media table
      const { data: mediaRows } = await adminClient
        .from('property_media')
        .select('url')
        .in('property_id', userProperties.map((p: { id: string }) => p.id));

      if (mediaRows) {
        for (const row of mediaRows) {
          const url = row.url as string;
          if (url.includes('/storage/v1/object/public/properties/')) {
            const pathPart = url.split('/storage/v1/object/public/properties/')[1];
            if (pathPart) propertyImagePaths.push(pathPart);
          }
        }
      }

      if (propertyImagePaths.length > 0) {
        const { error: propImgDeleteError } = await adminClient.storage
          .from('properties')
          .remove(propertyImagePaths);
        if (propImgDeleteError) {
          console.warn('[delete-account] Property images delete error (non-fatal):', propImgDeleteError.message);
        } else {
          console.log(`[delete-account] Deleted ${propertyImagePaths.length} property images`);
        }
      }
    }

    // 4c. Delete reel video files (reels bucket)
    const { data: userReels } = await adminClient
      .from('reels')
      .select('id, video_url, thumbnail_url')
      .eq('user_id', userId);

    if (userReels && userReels.length > 0) {
      const reelFilePaths: string[] = [];
      for (const reel of userReels) {
        for (const url of [reel.video_url, reel.thumbnail_url]) {
          if (url && url.includes('/storage/v1/object/public/reels/')) {
            const pathPart = url.split('/storage/v1/object/public/reels/')[1];
            if (pathPart) reelFilePaths.push(pathPart);
          }
        }
      }
      if (reelFilePaths.length > 0) {
        const { error: reelDeleteError } = await adminClient.storage
          .from('reels')
          .remove(reelFilePaths);
        if (reelDeleteError) {
          console.warn('[delete-account] Reel files delete error (non-fatal):', reelDeleteError.message);
        } else {
          console.log(`[delete-account] Deleted ${reelFilePaths.length} reel files`);
        }
      }
    }

    // ── 5. Delete enquiries where user is sender (SET NULL FK → row stays for recipient) ──
    // We explicitly delete sent enquiries so the recipient's inbox is also cleaned.
    // This is done before auth user deletion to avoid FK constraint issues.
    await adminClient
      .from('enquiries')
      .delete()
      .eq('sender_id', userId);

    // ── 6. Delete the Supabase Auth user ──────────────────────────────────────
    // This triggers ON DELETE CASCADE on profiles.id → profiles row deleted →
    // cascades to: properties, property_media, reels, reel_likes, reel_comments,
    // reel_saves, saved_properties, followers, notifications, reports,
    // enquiries (as recipient), chat_messages.
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('[delete-account] Auth user deletion failed:', deleteAuthError.message);
      return new Response(
        JSON.stringify({
          error: `Account deletion failed: ${deleteAuthError.message}. Please try again or contact support.`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[delete-account] Successfully deleted user ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[delete-account] Unexpected error:', message);
    return new Response(
      JSON.stringify({ error: `Unexpected server error: ${message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
