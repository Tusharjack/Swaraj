/**
 * Cloudinary upload helper — IndoProperty
 *
 * Uses Cloudinary's UNSIGNED upload API so the API secret never touches
 * the browser or Android app. All uploads go through an upload preset
 * configured as "unsigned" in the Cloudinary console.
 *
 * Console → Settings → Upload → Upload presets → Add upload preset
 *   Signing mode: Unsigned
 *   Preset name:  indoproperty_unsigned
 *   Folder:       indoproperty (optional)
 *
 * Security:
 *   - Only VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET
 *     are embedded in the app — both are public values.
 *   - API key (498176942192216) and API secret are NEVER in the frontend.
 *   - Upload restrictions (file size, format, etc.) are enforced on the
 *     upload preset in the Cloudinary console.
 */

const CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'm2fefd4f';

const UPLOAD_PRESET =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'indoproperty_unsigned';

export type CloudinaryFolder = 'avatars' | 'properties' | 'reels';

/**
 * Upload a file to Cloudinary and return the secure HTTPS URL.
 * Replaces uploadFileToSupabase() for all media.
 */
export async function uploadToCloudinary(
  folder: CloudinaryFolder,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `indoproperty/${folder}`);
  // Tag for easy management in Cloudinary console
  formData.append('tags', `indoproperty,${folder}`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.secure_url) {
            resolve(res.secure_url as string);
          } else {
            reject(new Error('Cloudinary upload succeeded but no URL returned.'));
          }
        } catch {
          reject(new Error('Failed to parse Cloudinary response.'));
        }
      } else {
        let msg = `Cloudinary upload failed (HTTP ${xhr.status})`;
        try {
          const errBody = JSON.parse(xhr.responseText);
          if (errBody?.error?.message) msg = errBody.error.message;
        } catch { /* ignore */ }
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during Cloudinary upload. Check your internet connection.'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Cloudinary upload was cancelled.'));
    });

    xhr.open('POST', url);
    xhr.send(formData);
  });
}

/** Check if Cloudinary is configured (cloud name is set) */
export const isCloudinaryConfigured: boolean = Boolean(
  CLOUD_NAME && CLOUD_NAME !== 'your_cloud_name'
);

/**
 * Get a Cloudinary optimised image URL with transformations.
 * Pass a full Cloudinary URL and get back an optimised version.
 */
export function cloudinaryOptimise(
  url: string,
  opts: { width?: number; height?: number; quality?: number } = {}
): string {
  if (!url?.includes('cloudinary.com')) return url;

  const { width, height, quality = 80 } = opts;
  const transforms: string[] = [`q_${quality}`, 'f_auto'];
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`, 'c_fill');

  // Insert transformation string before /upload/
  return url.replace('/upload/', `/upload/${transforms.join(',')}/`);
}
