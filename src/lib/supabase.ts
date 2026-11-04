import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  localStorage.getItem('SWARAJ_SUPABASE_URL') ||
  '';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  localStorage.getItem('SWARAJ_SUPABASE_KEY') ||
  '';

/** Accept both classic JWT anon keys (eyJ...) and new publishable keys (sb_publishable_...) */
const isValidKey = (k: string) =>
  typeof k === 'string' && k.length > 20 &&
  (k.startsWith('eyJ') || k.startsWith('sb_publishable_') || k.startsWith('sb_'));

const disabledByLocalStorage =
  typeof window !== 'undefined' &&
  (localStorage.getItem('SWARAJ_SUPABASE_DISABLED') === 'true' ||
    localStorage.getItem('SWARAJ_SUPABASE_URL') === 'offline');

export const isSupabaseConfigured: boolean = Boolean(
  !disabledByLocalStorage &&
  SUPABASE_URL &&
  SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
  !SUPABASE_URL.includes('example.supabase.co') &&
  isValidKey(SUPABASE_ANON_KEY)
);

if (!isSupabaseConfigured) {
  console.warn(
    '[Swaraj] Supabase is NOT configured. Set VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY (the anon/public JWT from your Supabase project ' +
    'settings → API) in your .env file. All data will remain local-only until ' +
    'this is fixed.'
  );
}

// Always create the client so TypeScript imports never break.
// Queries will simply fail (and be surfaced as errors) when not configured.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'eyJplaceholder'
);

/**
 * Upload a file to Cloudinary (primary) or fall back to Supabase Storage.
 * Cloudinary is preferred — it has a generous free tier and global CDN,
 * which avoids Supabase's 5 GB egress limit on the free plan.
 *
 * To use Cloudinary:
 *   1. Go to cloudinary.com/console/settings/upload → Upload Presets
 *   2. Add preset → Signing mode: Unsigned → Name: indoproperty_unsigned
 *   3. Set VITE_CLOUDINARY_CLOUD_NAME=m2fefd4f in .env (already done)
 */
export async function uploadFileToSupabase(
  bucket: 'reels' | 'properties' | 'avatars',
  file: File
): Promise<string> {
  // Try Cloudinary first
  try {
    const { uploadToCloudinary, isCloudinaryConfigured } = await import('./cloudinary');
    if (isCloudinaryConfigured) {
      return await uploadToCloudinary(bucket, file);
    }
  } catch (cloudErr) {
    console.warn('[Upload] Cloudinary failed, falling back to Supabase:', cloudErr);
  }

  // Fallback: Supabase Storage
  if (!isSupabaseConfigured) {
    throw new Error(
      'Neither Cloudinary nor Supabase Storage is configured. ' +
      'Set VITE_CLOUDINARY_CLOUD_NAME in your .env file.'
    );
  }

  const ext = file.name.split('.').pop() || (bucket === 'reels' ? 'mp4' : 'jpg');
  const filePath = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
  const mimeType = file.type || (bucket === 'reels' ? 'video/mp4' : 'image/jpeg');

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: mimeType });

  if (uploadError) {
    throw new Error(`Storage upload failed (bucket: ${bucket}): ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error(`Could not generate public URL for file in bucket "${bucket}".`);
  }
  return data.publicUrl;
}

/** Convert a File to a base64 Data URL (only for local preview, not for storage). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}
