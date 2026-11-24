<?php
/**
 * reel.php — IndoProperty Reel Preview Handler
 *
 * Auto-load .env.php for Supabase credentials (Hostinger runtime)
 */
if (file_exists(__DIR__ . '/.env.php')) {
    require_once __DIR__ . '/.env.php';
}

/**
 * Serves pre-rendered HTML with reel-specific OG/Twitter Card meta tags so
 * WhatsApp, Telegram, iMessage, and other social bots see the correct reel
 * thumbnail and title when someone shares a link.
 *
 * How it works:
 *   1. Apache routes  GET /reel/:id  here via .htaccess RewriteRule
 *   2. This script fetches the reel from Supabase REST API (server-side)
 *   3. Injects reel-specific OG tags into a minimal HTML response
 *   4. Real users (browsers / the IndoProperty app) are redirected to the
 *      React SPA at /?reel=ID which opens the ReelLandingPage component
 *   5. Social bots (identified by User-Agent) get the pre-rendered HTML
 *      so they can scrape the thumbnail, title, and description
 *
 * Deploy: place this file (and .htaccess) in your Hostinger public_html/ root
 * alongside index.html. Upload the entire dist/ folder contents as a zip.
 *
 * Required environment: PHP 7.4+ with curl extension (enabled on all
 * Hostinger plans by default).
 */

// ── Configuration ─────────────────────────────────────────────────────────────
define('SUPABASE_URL',  getenv('VITE_SUPABASE_URL')  ?: 'https://jueatkomupnzbwovzsle.supabase.co');
define('SUPABASE_KEY',  getenv('VITE_SUPABASE_PUBLISHABLE_KEY') ?: getenv('VITE_SUPABASE_ANON_KEY') ?: '');
define('SITE_URL',      'https://indoproperty.in');
define('APP_PACKAGE',   'com.swaraj.realestate');
define('PLAY_STORE',    'https://play.google.com/store/apps/details?id=com.swaraj.realestate&pcampaignid=reel_share');
define('DEFAULT_IMAGE', SITE_URL . '/logo.png');

// ── Get reel ID from URL ───────────────────────────────────────────────────────
// Apache rewrites /reel/REEL_ID → /reel.php?id=REEL_ID
$reelId = isset($_GET['id']) ? trim($_GET['id']) : '';

// Basic UUID / alphanumeric validation — reject anything suspicious
if (!$reelId || !preg_match('/^[a-zA-Z0-9_\-]{8,64}$/', $reelId)) {
    header('Location: /');
    exit;
}

// ── Detect social bot User-Agents ────────────────────────────────────────────
// WhatsApp, Telegram, Facebook, Twitter, iMessage, LinkedIn, Slack all send
// recognisable User-Agent strings when they scrape link previews.
$ua = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
$isSocialBot = (
    strpos($ua, 'whatsapp')    !== false ||
    strpos($ua, 'telegrambot') !== false ||
    strpos($ua, 'facebookexternalhit') !== false ||
    strpos($ua, 'twitterbot')  !== false ||
    strpos($ua, 'linkedinbot') !== false ||
    strpos($ua, 'slackbot')    !== false ||
    strpos($ua, 'discordbot')  !== false ||
    strpos($ua, 'applebot')    !== false ||
    strpos($ua, 'googlebot')   !== false ||
    strpos($ua, 'bingbot')     !== false ||
    // Some crawlers don't identify themselves — serve preview HTML to all
    // non-browser requests to maximise compatibility
    (strpos($ua, 'mozilla') === false && strpos($ua, 'chrome') === false)
);

// ── Fetch reel data from Supabase REST API ────────────────────────────────────
$reelTitle       = 'Property Reel on IndoProperty';
$reelDescription = 'Watch this property video reel on IndoProperty — India\'s Real Estate & Video Platform';
$reelImage       = DEFAULT_IMAGE;
$creatorName     = 'IndoProperty';

if (SUPABASE_URL && SUPABASE_KEY) {
    $apiUrl = SUPABASE_URL
        . '/rest/v1/reels?id=eq.' . urlencode($reelId)
        . '&select=title,caption,thumbnail_url,creator:profiles(full_name,agency_name)'
        . '&limit=1';

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_HTTPHEADER     => [
            'apikey: '        . SUPABASE_KEY,
            'Authorization: Bearer ' . SUPABASE_KEY,
            'Accept: application/json',
        ],
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $body = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $body) {
        $rows = json_decode($body, true);
        $reel = is_array($rows) && count($rows) > 0 ? $rows[0] : null;

        if ($reel) {
            if (!empty($reel['title']))         $reelTitle       = $reel['title'];
            if (!empty($reel['caption']))        $reelDescription = $reel['caption'];
            if (!empty($reel['thumbnail_url']))  $reelImage       = $reel['thumbnail_url'];

            $creator = $reel['creator'] ?? null;
            if ($creator) {
                $creatorName = $creator['agency_name'] ?: $creator['full_name'] ?: $creatorName;
            }
        }
    }
}

// ── For real browser users — redirect to the React SPA ───────────────────────
// The SPA reads ?reel=ID and renders ReelLandingPage which has the full UI.
if (!$isSocialBot) {
    header('Location: /?reel=' . urlencode($reelId));
    exit;
}

// ── Build values for OG tags ──────────────────────────────────────────────────
$reelUrl    = SITE_URL . '/reel/' . $reelId;
$ogTitle    = htmlspecialchars($reelTitle . ' — ' . $creatorName . ' on IndoProperty', ENT_QUOTES, 'UTF-8');
$ogDesc     = htmlspecialchars(
    mb_strlen($reelDescription) > 200
        ? mb_substr($reelDescription, 0, 197) . '…'
        : $reelDescription,
    ENT_QUOTES, 'UTF-8'
);
$ogImage    = htmlspecialchars($reelImage, ENT_QUOTES, 'UTF-8');
$ogUrl      = htmlspecialchars($reelUrl,  ENT_QUOTES, 'UTF-8');
$intentUrl  = htmlspecialchars(
    'intent://reel/' . $reelId . '#Intent;scheme=https;package=' . APP_PACKAGE
        . ';S.browser_fallback_url=' . urlencode(PLAY_STORE) . ';end',
    ENT_QUOTES, 'UTF-8'
);

// ── Serve the preview HTML to social bots ────────────────────────────────────
// This is a lightweight page (no React, no JS bundle) that bots can parse
// instantly. Real users never see this — they're redirected above.
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=120, stale-while-revalidate=600');
?>
<!doctype html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary meta -->
  <title><?= $ogTitle ?></title>
  <meta name="description" content="<?= $ogDesc ?>">

  <!-- Open Graph (WhatsApp, Facebook, iMessage, LinkedIn) -->
  <meta property="og:type"         content="video.other">
  <meta property="og:site_name"    content="IndoProperty">
  <meta property="og:title"        content="<?= $ogTitle ?>">
  <meta property="og:description"  content="<?= $ogDesc ?>">
  <meta property="og:image"        content="<?= $ogImage ?>">
  <meta property="og:image:width"  content="1080">
  <meta property="og:image:height" content="1920">
  <meta property="og:image:type"   content="image/jpeg">
  <meta property="og:url"          content="<?= $ogUrl ?>">

  <!-- Twitter / X Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="<?= $ogTitle ?>">
  <meta name="twitter:description" content="<?= $ogDesc ?>">
  <meta name="twitter:image"       content="<?= $ogImage ?>">

  <!-- Telegram uses og: tags — no extra config needed -->

  <!-- Android App Links (WhatsApp in-app browser deep link) -->
  <meta property="al:android:url"      content="<?= $intentUrl ?>">
  <meta property="al:android:app_name" content="IndoProperty">
  <meta property="al:android:package"  content="<?= APP_PACKAGE ?>">
  <meta property="al:web:url"          content="<?= $ogUrl ?>">

  <!-- Instant redirect for real browsers (belt-and-suspenders fallback) -->
  <meta http-equiv="refresh" content="0;url=/?reel=<?= urlencode($reelId) ?>">

  <style>
    body { margin: 0; background: #0f172a; color: white;
           font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; }
    .card { text-align: center; padding: 2rem; max-width: 400px; }
    img.thumb { width: 100%; border-radius: 16px; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    p  { color: #94a3b8; font-size: .875rem; margin: 0 0 1.5rem; }
    a.btn { display: inline-block; padding: .875rem 2rem;
            background: linear-gradient(135deg, #4f46e5, #7c3aed);
            color: white; text-decoration: none; border-radius: 1rem;
            font-weight: 800; font-size: .9rem; }
  </style>
</head>
<body>
  <div class="card">
    <?php if ($reelImage !== DEFAULT_IMAGE): ?>
    <img class="thumb" src="<?= $ogImage ?>" alt="<?= htmlspecialchars($reelTitle, ENT_QUOTES, 'UTF-8') ?>">
    <?php endif; ?>
    <h1><?= htmlspecialchars($reelTitle, ENT_QUOTES, 'UTF-8') ?></h1>
    <p><?= htmlspecialchars(mb_substr($reelDescription, 0, 100), ENT_QUOTES, 'UTF-8') ?></p>
    <a class="btn" href="/?reel=<?= urlencode($reelId) ?>">Watch on IndoProperty</a>
  </div>
</body>
</html>
<?php
// ── Supabase credentials note ─────────────────────────────────────────────────
// If reel data is not loading, add your Supabase credentials to Hostinger's
// environment variables or create a .env.php file:
//
//   <?php
//   putenv('VITE_SUPABASE_URL=https://your-project.supabase.co');
//   putenv('VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx');
//
// Then add at the top of this file:  require_once __DIR__ . '/.env.php';
?>
