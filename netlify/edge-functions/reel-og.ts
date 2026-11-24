/**
 * Netlify Edge Function — reel-og.ts
 *
 * Intercepts GET /reel/:id requests.
 *
 * For social bots (WhatsApp, Telegram, iMessage, Twitter, Facebook) that
 * don't execute JavaScript, this function:
 *   1. Fetches reel metadata from Supabase REST API (server-side, no JS needed)
 *   2. Injects reel-specific OG / Twitter Card meta tags into the HTML
 *   3. Returns the modified HTML so the bot sees the right thumbnail & title
 *
 * For real users / the IndoProperty app the response is identical to the
 * normal SPA — the React app takes over and renders the ReelLandingPage.
 *
 * Deploy: this file is automatically picked up by Netlify when netlify.toml
 * maps the route to this function (see netlify.toml).
 */

import type { Context } from 'https://edge.netlify.com';

const SUPABASE_URL  = Deno.env.get('VITE_SUPABASE_URL')  || '';
const SUPABASE_KEY  = Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY') || '';
const SITE_URL      = 'https://indoproperty.in';
const PLAY_STORE    = 'https://play.google.com/store/apps/details?id=com.swaraj.realestate';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

export default async (request: Request, context: Context) => {
  const url     = new URL(request.url);
  const reelId  = url.pathname.replace(/^\/reel\//, '').trim();

  if (!reelId) return context.next();

  // ── Fetch reel from Supabase REST API (runs server-side, no JS) ──────────
  let reelTitle       = 'Property Reel on IndoProperty';
  let reelDescription = 'Watch this property video reel on IndoProperty — India\'s Real Estate & Video Platform';
  let reelImage       = DEFAULT_IMAGE;
  let creatorName     = 'IndoProperty';

  try {
    if (SUPABASE_URL && SUPABASE_KEY) {
      const apiUrl = `${SUPABASE_URL}/rest/v1/reels?id=eq.${reelId}&select=title,caption,thumbnail_url,creator:profiles(full_name,agency_name)&limit=1`;
      const res = await fetch(apiUrl, {
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Accept':        'application/json',
        },
      });
      if (res.ok) {
        const rows = await res.json();
        const reel = Array.isArray(rows) ? rows[0] : null;
        if (reel) {
          reelTitle       = reel.title        || reelTitle;
          reelDescription = reel.caption      || reelDescription;
          reelImage       = reel.thumbnail_url || DEFAULT_IMAGE;
          creatorName     = reel.creator?.agency_name || reel.creator?.full_name || creatorName;
        }
      }
    }
  } catch (_e) {
    // Supabase unavailable — fall through to defaults
  }

  const reelUrl   = `${SITE_URL}/reel/${reelId}`;
  const ogTitle   = `${reelTitle} — ${creatorName} on IndoProperty`;
  const ogDesc    = reelDescription.length > 200
    ? reelDescription.slice(0, 197) + '…'
    : reelDescription;

  // ── Fetch the original HTML (index.html) ─────────────────────────────────
  const response  = await context.next();
  const html      = await response.text();

  // ── Inject reel-specific meta tags, replacing the default og: tags ───────
  const injectedMeta = `
    <!-- Reel-specific OG tags injected by Netlify Edge Function -->
    <meta property="og:type"         content="video.other" />
    <meta property="og:site_name"    content="IndoProperty" />
    <meta property="og:title"        content="${escapeAttr(ogTitle)}" />
    <meta property="og:description"  content="${escapeAttr(ogDesc)}" />
    <meta property="og:image"        content="${escapeAttr(reelImage)}" />
    <meta property="og:image:width"  content="1080" />
    <meta property="og:image:height" content="1920" />
    <meta property="og:url"          content="${escapeAttr(reelUrl)}" />
    <meta property="og:video"        content="${escapeAttr(reelUrl)}" />

    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${escapeAttr(ogTitle)}" />
    <meta name="twitter:description" content="${escapeAttr(ogDesc)}" />
    <meta name="twitter:image"       content="${escapeAttr(reelImage)}" />

    <!-- WhatsApp deep link banner -->
    <meta property="al:android:url"          content="intent://reel/${reelId}#Intent;scheme=https;package=com.swaraj.realestate;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE)};end" />
    <meta property="al:android:app_name"     content="IndoProperty" />
    <meta property="al:android:package"      content="com.swaraj.realestate" />
    <meta property="al:web:url"              content="${escapeAttr(reelUrl)}" />

    <title>${escapeAttr(ogTitle)}</title>
  `;

  // Replace the default <title> + og: tags block with reel-specific tags
  const modifiedHtml = html.replace(
    /<title>[^<]*<\/title>/,
    injectedMeta,
  );

  return new Response(modifiedHtml, {
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'content-type': 'text/html; charset=utf-8',
      // Allow bots to cache for 1 minute; real users get fresh content
      'cache-control': 'public, max-age=60, stale-while-revalidate=300',
    },
    status: response.status,
  });
};

function escapeAttr(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
