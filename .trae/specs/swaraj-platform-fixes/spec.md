# SWARAJ Platform Bug Fixes & Optimizations — Specification

## Problem

The Swaraj real-estate platform has 8 distinct functional and performance issues across Professional Dashboard, Reels, Likes/Comments, Save, Direct Enquiry/Chat, Admin Panel, Reports/Moderation, and Login/Profile data flows. The application currently relies heavily on localStorage with partial/faulty Supabase sync, causing stale data, slow dashboards, and inconsistent state.

## Users

1. **Customer Users**: Browse properties, watch reels, like/comment/save, send enquiries, save items.
2. **Professional Users**: Manage listings, view leads/enquiries, upload reels, see dashboard analytics.
3. **Admin Users**: Moderate content, manage users, view reports, oversee platform data.

## Goals

Fix all 8 issues with minimal, surgical changes to existing code. Reuse existing tables/APIs/components. Do not introduce new architecture.

## Non-Goals

- No full rewrite of any module.
- No new frameworks or libraries.
- No UI redesign (keep existing design).
- No schema migrations beyond existing tables (use existing columns).

---

## Functional Requirements

### FR-1: Professional Dashboard Performance
- Dashboard numbers must load quickly (< 2s perceived).
- No duplicate or redundant API calls per render cycle.
- All 4 stats cards (Listings, Leads, Views, Reels) must render proper loading skeletons before data is ready.
- Avoid N+1 queries; batch data fetches with `Promise.all`.
- Polling interval (if any) must not create cascading duplicate requests.

### FR-2: New Reels — Immediate Feed Update
- After a successful reel upload, the new reel MUST appear at the TOP of the reels feed immediately.
- No full-page refresh (`window.location.reload`) is allowed anywhere.
- After `createReel` resolves, update in-memory React state directly; optionally re-fetch once, but never twice for the same upload.
- Prevent duplicate entries (local-ID → Supabase-UUID swap must overwrite, not duplicate).

### FR-3: Likes & Comments
- **Counts stored correctly**: `likes_count` and `comments_count` on the `reels` table (Supabase) MUST be incremented/decremented on every action, not only in localStorage.
- **Immediate UI update**: Like button state + count, and comment count, update optimistically in React state before network response.
- **No duplicate likes**: Prevent double-like races (debounce/throttle or use a per-reel "pending" state).
- **Comments persist**: After page reload, ALL comments re-appear via Supabase `reel_comments` table (cannot rely solely on localStorage).
- Deduplication must be by `id` (real UUID) not by text content.

### FR-4: Save Button
- Save/Unsave on BOTH reels AND properties must actually write to Supabase tables:
  - Reels → `reel_saves` table
  - Properties → `saved_properties` table
- Saved state (button fill/icon + text) must update IMMEDIATELY on click (optimistic).
- On the "Saved" tab (customer view), saved properties show correctly.
- **Requirement extension**: Saved section must ALSO show saved reels (or separate clearly; use existing tab if possible — at minimum, per-reel save state must reflect correctly from DB on reload).

### FR-5: Direct Enquiry + Chat / Messaging
- "Send Direct Enquiry" MUST create a row in `enquiries` table with correct `sender_id`, `recipient_id`, `message`, `timestamp`.
- The professional MUST see the new enquiry in their Professional Dashboard (Leads tab) without manual refresh.
- Add/open a chat conversation tied to each enquiry (sender ↔ receiver messages).
  - Store each message: `sender_id`, `receiver_id`/`recipient_id`, `message`, `created_at`/timestamp, `read`/`unread` status.
  - Messages MUST persist to Supabase and survive reload.
  - Re-use `enquiries` table structure OR add a `messages` convention/table via the existing `enquiries` flow (append messages to a linked list under the same enquiry thread — since schema has no `chat_messages` table, store chat messages as additional enquiries with a `parent_enquiry_id` convention OR extend the existing `enquiries.message` to be a "thread starter" and add an `enquiry_messages` entry via raw insert on a new lightweight pattern — but keep using Supabase storage, not localStorage only).
- Use existing authenticated user IDs (`auth.uid()` / current profile `id`).

### FR-6: Admin Panel — Real Data
- Admin Users tab MUST load real users from Supabase `profiles` table, not from localStorage seed only.
- Admin Properties, Reels, Enquiries tabs MUST load from Supabase tables, not localStorage.
- Admin Reports tab MUST load real reports from Supabase `reports` table.
- The "Credentials" tab showing SEED_PROFILES is ALLOWED to remain as a login-helper reference panel, but data lists (users/props/reels/enquiries/reports) MUST come from Supabase (fallback to localStorage only if Supabase is not configured — but no static/mock data in list views).
- NEVER delete genuine DB users; the "Reset Platform Data" button may reset localStorage but must NOT call any destructive Supabase SQL.

### FR-7: Reports / Moderation
- Reports MUST contain: `reporter_id` (from auth), `target_type` (property/reel/user/comment), `target_id`, `reason`, `created_at` (auto), `status` (pending/reviewed/resolved/dismissed).
- Admin can view list, change status (resolve/dismiss).
- Reporting MUST NOT automatically delete/hide content; content is untouched unless Admin explicitly deletes it (separate action).
- Reports MUST persist to Supabase `reports` table; Admin load list from Supabase.

### FR-8: Login / Profile Data Integrity (Registration → DB → Frontend)
- Registration flow: when user signs up with `fullName`, `phone`, `city`, `role`, `professionalType`, `agencyName`:
  1. ALL fields MUST be written to the final `profiles` row on Supabase (not only `full_name` / `role`).
  2. After login (manual sign-in after email confirm OR auto-login), `api.getCurrentUser()` MUST return the complete row including `phone`, `city`, `agency_name`, `professional_type`, `bio`.
  3. In frontend state (`currentUser` in App.tsx), those fields must populate; user should NOT see empty phone/city/agency inputs after login.
- If `handle_new_user()` trigger only copies some metadata, the signup API must explicitly upsert the full profile row so fields are never lost.

---

## Non-Functional Requirements

### NFR-1: Minimal Changes
- Only change existing files; add new components/files only when ABSOLUTELY necessary (e.g., a chat modal if none exists — but evaluate whether EnquiryModal can be extended first).

### NFR-2: No Full-Page Refresh
- No `window.location.reload()` calls anywhere in the update flow (Admin Reset Platform Data already has one; leave that one alone but change no others).

### NFR-3: Fallback Preserved
- When Supabase is NOT configured, localStorage fallbacks must continue to work (no breaking the offline demo mode).

### NFR-4: Root-Cause Fixes
- Fix root causes, not just UI: e.g., if a count mismatch is because the Supabase column isn't being updated, write the UPDATE query — do not just show the localStorage number and pretend the DB matches.

### NFR-5: RLS Aware
- All Supabase calls must succeed under existing RLS policies; if Admin `getAllUsers` needs admin-only SELECT, use existing policies OR note the limitation but still query Supabase (fallback gracefully).

---

## Constraints, Dependencies, Assumptions

- **Database**: Existing Supabase schema (`schema.sql`) — do not add new tables UNLESS chat requires a `messages` table. If so, document in tasks and ALSO keep localStorage fallback for offline mode.
- **Auth**: Existing Supabase Auth + localStorage fallback.
- **UI Library**: Existing Tailwind v4 + lucide-react icons; keep same design system.
- **RLS**: `profiles` has SELECT public; INSERT only via trigger. Reports RLS currently says "viewable by admin or reporter" but policy only checks `reporter_id` — Admin may not see reports. **Fix**: note this and update Admin panel to query reports via a broader strategy, or create a separate Supabase query path.
- **Admin role detection**: `currentUser.role === 'admin'` (from `profiles.role` column).

## Open Questions (Resolved by Assumption)

1. Q: Do we need a separate `chat_messages` table? A: Yes, if possible, but since schema has none, we will store chat messages as rows in a new `chat_messages` table pattern via Supabase — and include create-table-if-not-exists SQL in comments for user to run. We'll also add localStorage fallback.
2. Q: Reports RLS blocks Admin? A: Policy `auth.uid() = reporter_id` blocks Admin. We will work around by also loading reports via the email-based admin check where possible, and document RLS fix instruction (the Admin can review reports from localStorage too, but prefer Supabase query with an admin-role helper).
3. Q: Where does saved-reels list show? A: Saved tab currently shows only saved-properties; we'll ensure per-reel save state persists correctly on reel reload (minimal). Optionally add a section/toggle on Saved tab if trivial.

---

## Acceptance Criteria

### AC-1 (rule): Professional Dashboard shows loading skeletons then numbers
- Dashboard mount: 4 skeleton cards visible while `isLoading === true`.
- When data arrives, skeletons replaced by real numbers computed from 1 Promise.all batch call.
- Network tab shows at most 1 parallel batch per dashboard mount, no cascading fetches.

### AC-2 (rule): New Reel appears instantly in feed
- Upload reel → modal closes → reels feed shows it at index 0, no manual refresh.
- Re-fetch is at most 1 additional time after upload success (not twice).
- No duplicate entries in feed; the local-temp-ID reel is replaced by Supabase-UUID version, not added alongside.

### AC-3 (rule): Like/comment counts are persisted
- After liking, reloading the page shows the SAME `likes_count` (read from `reels` Supabase column, not localStorage).
- Same for comments: new comment appears after reload (from `reel_comments` table, joined or queried).
- Rapid double-click on like does not produce 2 `reel_likes` rows (debounce/idempotency).

### AC-4 (rule): Save state is durable
- Click Save on a reel → reload → reel still shows saved state (filled icon) from `reel_saves` Supabase table.
- Click Save on property → Saved tab shows it, survives reload.

### AC-5 (rule): Enquiries create a visible chat thread
- Send Direct Enquiry → professional dashboard sees the enquiry in leads list (reflected on next poll or instantly).
- Professional and customer can open the thread, type additional messages.
- Messages persist; page reload shows previous messages (from Supabase chat/messages store, not only localStorage).
- Each message has sender/receiver/timestamp/read indicator.

### AC-6 (rule): Admin lists use Supabase data
- Admin "Users" list includes any Supabase-registered user (not just seed 5).
- Admin "Properties" / "Reels" list rows match Supabase tables rows count (when configured).
- Admin "Reports" list shows Supabase reports rows.

### AC-7 (rule): Reports are durable and non-destructive
- User submits report (if UI exists, OR via API) → Admin sees report with correct `reporter_id`, `target_type`, `target_id`, `reason`, `created_at`, `status=pending`.
- Admin marks Resolved or Dismissed → status updates.
- Reported content is NOT hidden/deleted by reporting action.

### AC-8 (rule): Registration data survives to post-login profile
- Signup new user with phone=X, city=Y → after login, open ProfileModal → phone field=X, city=Y populated.
- Agency name & professional type for professionals also populated.
- No empty/undefined fields that user just entered during signup.

### AC-9 (rubric): Query efficiency (0-2)
- `2`: All page/component data loads in 1 batched Promise.all; no duplicated or redundant fetches on re-renders. React hooks deps are correct.
- `1`: Batched in most places but 1 extra fetch on a common path.
- `0`: Still many sequential or redundant fetches.

### AC-10 (rubric): Offline (no-Supabase) continuity (0-2)
- `2`: localStorage fallback paths still work for ALL 8 features when `isSupabaseConfigured === false`. No null-reference crashes.
- `1`: 1 minor feature broken in offline mode.
- `0`: Offline mode broken.
