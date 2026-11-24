<?php
/**
 * reel.php — IndoProperty Reel OG Preview (Hostinger / Apache)
 *
 * Routes: .htaccess sends GET /reel/:id here as /reel.php?id=:id
 *
 * Logic:
 *   - Social bots (WhatsApp, Telegram, FB etc.) → serve OG-tag HTML inline
 *   - Real browsers                              → 302 to /?reel=:id (React SPA)
 *   - Both paths fetch reel data from Supabase REST API (PHP curl, no JS)
 */

// ── Load credentials ──────────────────────────────────────────────────────────
if (file_exists(__DIR__ . '/.env.php')) {
    require_once __DIR__ . '/.env.php';
}

$SUPABASE_URL = getenv('VITE_SUPABASE_URL')  ?: '';
$SUPABASE_KEY = getenv('VITE_SUPABASE_PUBLISHABLE_KEY') ?: getenv('VITE_SUPABASE_ANON_KEY') ?: '';

// Hard-coded fallback (replace with your real values if .env.php is missing)
if (!$SUPABASE_URL) $SUPABASE_URL = 'https://jueatkomupnzbwovzsle.supabase.co';
if (!$SUPABASE_KEY) $SUPABASE_KEY = 'sb_publishable_WmjT7P6VS1lyv3sPNhyXWA_Z7RcE1zC';

define('SITE_URL',    'https://indoproperty.in');
define('APP_PKG',     'com.swaraj.realestate');
define('PLAY_STORE',  'https://play.google.com/store/apps/details?id=com.swaraj.realestate');
define('DEFAULT_IMG', SITE_URL . '/logo.png');

// ── Validate reel ID ──────────────────────────────────────────────────────────
$reelId = isset($_GET['id']) ? trim($_GET['id']) : '';
if (!$reelId || !preg_match('/^[a-zA-Z0-9_\-]{8,64}$/', $reelId)) {
    header('Location: /'); exit;
}

// ── Detect social / link-preview bots ────────────────────────────────────────
// IMPORTANT: WhatsApp sends UA like:
//   "WhatsApp/2.x.x A"  — always contains "whatsapp"
// We also catch all other known crawlers.
// When in doubt we serve the OG page (safe — it redirects real browsers anyway).
$ua = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
$isBot = (
    strpos($ua, 'whatsapp')           !== false ||
    strpos($ua, 'telegrambot')        !== false ||
    strpos($ua, 'facebookexternalhit')!== false ||
    strpos($ua, 'twitterbot')         !== false ||
    strpos($ua, 'linkedinbot')        !== false ||
    strpos($ua, 'slackbot')           !== false ||
    strpos($ua, 'discordbot')         !== false ||
    strpos($ua, 'applebot')           !== false ||
    strpos($ua, 'googlebot')          !== false ||
    strpos($ua, 'bingbot')            !== false ||
    strpos($ua, 'pinterest')          !== false ||
    strpos($ua, 'preview')            !== false ||
    // Requests with no User-Agent (curl, some bots)
    $ua === ''
);

// ── Redirect real browsers immediately — no Supabase call needed ──────────────
if (!$isBot) {
    header('Location: /?reel=' . urlencode($reelId));
    exit;
}

// ── Fetch reel from Supabase REST API (server-side) ──────────────────────────
$reelTitle = 'Property Reel on IndoProperty';
$reelDesc  = 'Watch this property video reel on IndoProperty — India\'s Real Estate & Video Platform.';
$reelImage = DEFAULT_IMG;
$creator   = 'IndoProperty';

$apiUrl = $SUPABASE_URL
    . '/rest/v1/reels?id=eq.' . rawurlencode($reelId)
    . '&select=title,caption,thumbnail_url,creator:profiles(full_name,agency_name)'
    . '&limit=1';

$ch = curl_init($apiUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 6,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_HTTPHEADER     => [
        'apikey: '               . $SUPABASE_KEY,
        'Authorization: Bearer ' . $SUPABASE_KEY,
        'Accept: application/json',
    ],
]);
$body     = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($httpCode === 200 && $body && !$curlErr) {
    $rows = json_decode($body, true);
    $reel = is_array($rows) && count($rows) > 0 ? $rows[0] : null;
    if ($reel) {
        if (!empty($reel['title']))         $reelTitle = $reel['title'];
        if (!empty($reel['caption']))       $reelDesc  = $reel['caption'];
        if (!empty($reel['thumbnail_url'])) $reelImage = $reel['thumbnail_url'];
        $c = $reel['creator'] ?? null;
        if ($c) $creator = $c['agency_name'] ?: $c['full_name'] ?: $creator;
    }
}

// ── Build OG values ───────────────────────────────────────────────────────────
$reelUrl  = SITE_URL . '/reel/' . $reelId;
$ogTitle  = $reelTitle . ' — ' . $creator . ' on IndoProperty';
$ogDesc   = mb_strlen($reelDesc) > 200 ? mb_substr($reelDesc, 0, 197) . '…' : $reelDesc;

// WhatsApp requires the og:image to be:
//   • Absolute HTTPS URL
//   • At least 300×200 px  (portrait thumbnails are fine)
//   • Served with correct Content-Type (image/jpeg or image/png)
//   • NOT behind CORS restrictions
// Cloudinary URLs are always public HTTPS — they work fine.
$ogImage  = $reelImage; // already absolute HTTPS from Cloudinary/Supabase Storage

function e($s) { return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8'); }

// ── Serve OG preview HTML ─────────────────────────────────────────────────────
header('Content-Type: text/html; charset=utf-8');
// WhatsApp re-fetches after 24 h; short cache so updated thumbnails show quickly
header('Cache-Control: public, max-age=300, stale-while-revalidate=3600');
?>
<!doctype html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title><?= e($ogTitle) ?></title>
<meta name="description" content="<?= e($ogDesc) ?>">

<!-- ═══════════════════════════════════════════════════════════════════════
     Open Graph — used by WhatsApp, iMessage, LinkedIn, Telegram
     WhatsApp picks the FIRST og:image it finds. Put it early.
     ═══════════════════════════════════════════════════════════════════════ -->
<meta property="og:url"          content="<?= e($reelUrl) ?>">
<meta property="og:type"         content="video.other">
<meta property="og:title"        content="<?= e($ogTitle) ?>">
<meta property="og:description"  content="<?= e($ogDesc) ?>">
<meta property="og:image"        content="<?= e($ogImage) ?>">
<meta property="og:image:secure_url" content="<?= e($ogImage) ?>">
<meta property="og:image:width"  content="1080">
<meta property="og:image:height" content="1920">
<meta property="og:image:type"   content="image/jpeg">
<meta property="og:site_name"    content="IndoProperty">
<meta property="og:locale"       content="en_IN">

<!-- Twitter / X Card -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="<?= e($ogTitle) ?>">
<meta name="twitter:description" content="<?= e($ogDesc) ?>">
<meta name="twitter:image"       content="<?= e($ogImage) ?>">
<meta name="twitter:site"        content="@IndoProperty">

<!-- Android App Links deep-link banner -->
<meta property="al:android:url"      content="intent://reel/<?= urlencode($reelId) ?>#Intent;scheme=https;package=<?= APP_PKG ?>;S.browser_fallback_url=<?= urlencode(PLAY_STORE) ?>;end">
<meta property="al:android:app_name" content="IndoProperty">
<meta property="al:android:package"  content="<?= APP_PKG ?>">
<meta property="al:web:url"          content="<?= e($reelUrl) ?>">

<!-- Redirect real browsers that somehow land here (belt-and-suspenders) -->
<meta http-equiv="refresh" content="0;url=/?reel=<?= urlencode($reelId) ?>">

<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f172a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1.5rem}
  .card{max-width:360px;width:100%;text-align:center}
  .thumb{width:100%;border-radius:1rem;margin-bottom:1.25rem;display:block}
  h1{font-size:1.1rem;font-weight:800;line-height:1.3;margin-bottom:.5rem}
  p{color:#94a3b8;font-size:.85rem;margin-bottom:1.5rem;line-height:1.5}
  .btn{display:inline-flex;align-items:center;gap:.5rem;padding:.9rem 2rem;
       background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;
       text-decoration:none;border-radius:1rem;font-weight:800;font-size:.9rem}
  .sub{margin-top:.75rem;font-size:.75rem;color:#475569}
</style>
</head>
<body>
<div class="card">
  <?php if ($ogImage !== DEFAULT_IMG): ?>
  <img class="thumb" src="<?= e($ogImage) ?>" alt="<?= e($reelTitle) ?>" loading="eager">
  <?php else: ?>
  <img class="thumb" src="<?= SITE_URL ?>/logo.png" alt="IndoProperty" loading="eager" style="max-width:120px;margin:0 auto 1.25rem">
  <?php endif; ?>

  <h1><?= e($reelTitle) ?></h1>
  <p><?= e(mb_substr($ogDesc, 0, 100)) ?></p>

  <a class="btn" href="/?reel=<?= urlencode($reelId) ?>">
    ▶ Watch on IndoProperty
  </a>
  <p class="sub">Also available on Google Play</p>
</div>
</body>
</html>
