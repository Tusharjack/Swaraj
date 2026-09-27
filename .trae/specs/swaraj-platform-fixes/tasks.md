# SWARAJ Platform Fixes — Implementation Tasks

## Task 1: Fix Login/Profile Data Integrity (FR-8 → AC-8)
**Status**: pending  
**Priority**: high

### Scope
- Root cause: `api.signUp()` passes `phone`, `city` to the local `Profile` object but `api.login()` + `getCurrentUser()` rely on Supabase `profiles` row which may lack these fields because:
  - The `handle_new_user()` trigger only reads `raw_user_meta_data.full_name`, `raw_user_meta_data.role`, `raw_user_meta_data.avatar_url` — NOT `phone`, `city`, `professional_type`, `agency_name`.
  - While `signUp()` does call `.upsert()` on profiles, the options metadata sent to `signUp` currently doesn't include `phone` / `city` in `options.data`.
  - And `getValidUuid()` on a string-based temp ID may not match the actual UUID.
- Fixes needed:
  1. In `signUp()` → pass `phone`, `city` in the Supabase `signUp({ options: { data: {...} } })` payload.
  2. Update `handle_new_user()` trigger logic (SQL comments / docs + actually write to profiles) — actually, since we can't run SQL in trigger reliably, ensure the post-signUp `upsert()` call uses the REAL `authData.user.id` (NOT a generated one from `getValidUuid`) to update the actual profile row with all fields: `phone`, `city`, `professional_type`, `agency_name`.
  3. In `getCurrentUser()`: after fetch, return ALL fields; do NOT fall back to localStorage ghost when Supabase session exists without profile — instead create profile with all inherited user metadata fields.
  4. In `login()`: ensure the stored `currentUser` in localStorage is the FULL profile row from Supabase (all fields), not a partial one.

### Files
- [api.ts](file:///c:/Users/MANGESH/Desktop/Swaraj/src/services/api.ts) (signUp, login, getCurrentUser, updateProfile)

### Test Requirements (TR)
- TR-1.1 (rule): signUp with phone="999" city="Goa" → after calling login with same email → `profile.phone === "999"` and `profile.city === "Goa"`.
- TR-1.2 (rule): ProfileModal shows the correct phone/city/agency after signup without user re-typing.

---

## Task 2: Optimize Professional Dashboard Queries (FR-1 → AC-1, AC-9)
**Status**: pending  
**Priority**: high

### Scope
- Current `loadFullDashboard()` runs 3 queries (properties, enquiries, reels) + `getReels()` fetches all reels (not just user's) then filters.
- The 15s `pollEnquiries()` also redundantly re-fetches ALL properties just for views-count updates — inefficient.
- Fixes:
  1. In `api.ts` add `getDashboardStats(ownerId)` which returns a batched result or at minimum use `Promise.all` correctly.
  2. Reels filter should happen server-side: in `getReels()` (or add `getReelsForUser(userId)`) use `eq('user_id', userId)`.
  3. Properties loaded by dashboard already come from `getProperties({ ownerId })` → OK, keep.
  4. Enquiries poll: keep ONLY enquiries re-fetch in interval (15s). Update views via a lightweight query or just accumulate locally (views are not critical for a 15s poll — just skip properties re-fetch).
  5. Ensure proper loading states: `isLoading` is set while waiting for Promise.all; skeleton UI already exists in component.
  6. Add a new `api.getProfessionalDashboard(ownerId)` that does 1 batched Promise.all and returns `{ properties, enquiries, reels, totalViews }`.

### Files
- [api.ts](file:///c:/Users/MANGESH/Desktop/Swaraj/src/services/api.ts) (add getProfessionalDashboard / getReelsForUser)
- [ProfessionalDashboard.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/components/ProfessionalDashboard.tsx) (use new batched API, lighten poll)

### TR
- TR-2.1 (rule): Dashboard load fires at most 3 Supabase select queries in parallel (Promise.all) — 1 for properties, 1 for enquiries, 1 for user-reels.
- TR-2.2 (rule): Loading skeleton renders for < 1000ms (simulated), then numbers appear simultaneously.
- TR-2.3 (rule): The 15s interval re-fetches ONLY enquiries (not properties/reels).

---

## Task 3: Instant Reel Feed Update After Upload + Prevent Duplicates (FR-2 → AC-2)
**Status**: pending  
**Priority**: high

### Scope
- Current: `createReel()` stores locally with temp ID (`reel-${Date.now()}`), then inserts to Supabase, then tries to find row via title + user_id. If success, updates localStorage. But `App.handleRefreshReels()` runs `api.getReels()` which merges local + remote — if ID swap timing is off, duplicates appear.
- Fixes:
  1. In `api.createReel()`: change Supabase insert → `.insert({...}).select().single()` (return the inserted row). Use returned `id` to immediately update local list entry. No separate `select()` after.
  2. In `App.tsx`: change `onSuccess` callback pattern for reels: `CreateReelModal.onSuccess` should accept the newly-created reel object (not just void). Add the new reel to the BEGINNING of `reels` state directly via a new handler `handleReelCreated(newReel)` instead of `handleRefreshReels()` which re-fetches everything.
  3. Optionally run 1 background `api.getReels()` sync after to ensure consistency, but NOT before showing the reel.
  4. In `ReelsFeed`, local state like `localLikeStates` needs to handle new reels arriving.

### Files
- [api.ts](file:///c:/Users/MANGESH/Desktop/Swaraj/src/services/api.ts) (createReel → use .select().single())
- [App.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/App.tsx) (handleReelCreated handler, pass callback)
- [CreateReelModal.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/components/CreateReelModal.tsx) (return newReel via onSuccess(newReel))

### TR
- TR-3.1 (rule): After upload, reel appears at feed index 0 in < 500ms without user action.
- TR-3.2 (rule): Feed contains exactly 1 copy of the new reel (no duplicates) 3s after upload.
- TR-3.3 (rubric - minimality 0-2): `2`: uses returned reel ID directly from insert, no extra getReels on critical path; `1`: one extra fetch; `0`: duplicates or still missing.

---

## Task 4: Fix Likes & Comments Durability + Real-Time Updates (FR-3 → AC-3)
**Status**: pending  
**Priority**: high

### Scope
- Current bugs:
  1. `toggleLikeReel()` inserts/deletes from `reel_likes` junction table but does NOT update `reels.likes_count` column in Supabase → count resets on reload.
  2. `addReelComment()` inserts comment but does NOT update `reels.comments_count` column → count reset on reload.
  3. `getReelComments()` deduplicates by `content` text → two identical-meaning comments from different users incorrectly merged.
  4. No debounce on like toggle → double-click may create 2 rows (UNIQUE constraint should stop it, but UX flickers).
- Fixes:
  1. `toggleLikeReel()`: after inserting/deleting junction row, run a count query or direct increment on `reels.likes_count`:
     - Option (clean): increment/decrement `likes_count` using RPC or a separate `.update({ likes_count: ... })` — but to avoid race, use the junction table count in DB; OR simpler: just do `rpc` increment/decrement or manually update via `likes_count = likes_count + 1` using raw value.
     - Since we can't create RPC without SQL, use `select count(*)` from junction table + update `likes_count` column to match.
  2. Same pattern for `comments_count` in `addReelComment()`: increment the column.
  3. Change `getReelComments()` dedup: dedup by `id` only (content matching causes data loss). Also ensure local comments by temp ID are kept until they get a real UUID (we can keep them merged by unique content+timestamp+userid if no ID collision, but NOT by bare content). Actually simpler: never dedup by content; dedup only by ID.
  4. Like button: add a per-reel pending state or debounce 300ms in `handleToggleLike`.
  5. `getReels()`: add a join or post-step to fetch actual counts correctly from junction tables if column is stale; alternatively trust the column after our writes now update it.

### Files
- [api.ts](file:///c:/Users/MANGESH/Desktop/Swaraj/src/services/api.ts) (toggleLikeReel, addReelComment, getReelComments)
- [ReelsFeed.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/components/ReelsFeed.tsx) (debounce like toggle)

### TR
- TR-4.1 (rule): Like a reel → reload → `likes_count` in HTML matches pre-reload.
- TR-4.2 (rule): Comment "test123" → reload → comment shows in list, count incremented.
- TR-4.3 (rule): Two identical comments ("hi") from two different users both survive reload.
- TR-4.4 (rule): Like button rapid double-click → max +1 to count (no duplicate likes row).

---

## Task 5: Fix Save Button (Properties + Reels) Durability (FR-4 → AC-4)
**Status**: pending  
**Priority**: high

### Scope
- Current bugs:
  1. `toggleSaveProperty()` writes to BOTH localStorage `SAVED_PROPERTIES` and Supabase `saved_properties` — OK. But `getSavedPropertyIds()` ONLY reads from localStorage → on another device/browser OR after localStorage wipe, Saved tab is empty even though DB has rows. Must also check Supabase.
  2. `toggleSaveReel()` inserts/removes in `reel_saves` junction table but does NOT update `reels.saves_count` column → stale count on reload.
  3. `getReels()` reads `is_saved_by_user` only from localStorage `REEL_SAVES` → doesn't reflect Supabase `reel_saves` state on reload (e.g. on another machine).
- Fixes:
  1. Add `api.getSavedPropertyIds()`: if logged in + Supabase, read from `saved_properties` table and merge with localStorage.
  2. `getReels()`: after fetching remote reels, also query `reel_saves` for current user (if authenticated), and set `is_saved_by_user` from the DB junction, not just localStorage. Keep localStorage as offline cache write-through.
  3. `toggleSaveReel()`: after junction insert/delete, UPDATE `reels.saves_count` column (increment/decrement, matching pattern from likes).
  4. In Saved tab (App.tsx), optionally add a sub-tab or section for Saved Reels (if minimal effort; else document that per-reel save state is durable which is the core requirement).

### Files
- [api.ts](file:///c:/Users/MANGESH/Desktop/Swaraj/src/services/api.ts) (getSavedPropertyIds, getReels → merge reel_saves, toggleSaveReel → update saves_count)
- [App.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/App.tsx) (Saved tab — optionally expose saved reels section)

### TR
- TR-5.1 (rule): Save a reel → reload → `is_saved_by_user === true` (yellow fill on bookmark icon).
- TR-5.2 (rule): Save a property → Saved tab has it; localStorage cleared (simulated by wiping key) but reloaded page STILL shows it in Saved list (because it reads from Supabase).
- TR-5.3 (rule): Save count on reel icon updates and survives reload.

---

## Task 6: Direct Enquiry → Chat / Messaging System (FR-5 → AC-5)
**Status**: pending  
**Priority**: high

### Scope
- Existing: `enquiries` table has 1 message per row. No multi-message chat thread.
- Fixes — add a lightweight chat system with minimal changes:
  1. Since schema.sql has no `chat_messages` table, we'll either:
     - A) Use `enquiries` as thread headers and create a new `chat_messages` table pattern (store via Supabase SQL `create table if not exists` attempt — run in SQL console / provide script; fallback store in localStorage key `CHAT_MESSAGES` with shape `{ id, enquiry_id, sender_id, receiver_id, message, created_at, read }`).
     - We'll implement both: if Supabase table `chat_messages` exists, use it; otherwise localStorage.
     - **Actually**: We'll keep it simple and use `enquiries` table creatively:
       - Treat first enquiry row as "thread starter".
       - Add a new convention: add `chat_messages` via localStorage + optional raw insert if `chat_messages` table is present. We'll provide SQL text for user to run (print in console) and also use localStorage fallback.
  2. **Extend EnquiryModal**: Change EnquiryModal to:
     - After send → show a Chat view (threaded messages under the same enquiry).
     - OR add a ChatModal component that opens when user clicks "Open Chat" on an enquiry card in Professional Dashboard. (Likely a separate component ChatModal.tsx.)
  3. Professional Dashboard → leads tab: each enquiry card gets an "Open Chat" button that opens the chat thread with that sender.
  4. Add API methods:
     - `api.sendMessage(enquiryId, { senderId, receiverId, message })` → stores to Supabase chat_messages table (or localStorage fallback).
     - `api.getMessagesForEnquiry(enquiryId)` → loads messages.
     - `api.markMessagesAsRead(enquiryId, viewerId)` → updates `read: true`.
  5. Store: `sender_id`, `receiver_id`, `message`, `created_at`, `read` (boolean).
  6. Make sure sending a direct enquiry still works for existing flow; then chat is a follow-up on same thread.

### Files
- [api.ts](file:///c:/Users/MANGESH/Desktop/Swaraj/src/services/api.ts) (sendMessage, getMessagesForEnquiry, markMessagesAsRead + ChatMessage type)
- [types/database.ts](file:///c:/Users/MANGESH/Desktop/Swaraj/src/types/database.ts) (add ChatMessage interface)
- [EnquiryModal.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/components/EnquiryModal.tsx) (after submit → optionally show thread or link to open chat)
- [ProfessionalDashboard.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/components/ProfessionalDashboard.tsx) (add "Open Chat" button per enquiry)
- New file: **ChatModal.tsx** (if absolutely needed; if can extend EnquiryModal without clutter, prefer extending) — decision: use ChatModal since it opens from multiple places (dashboard + possibly after enquiry).
- [App.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/App.tsx) (manage open ChatModal state)

### TR
- TR-6.1 (rule): Send enquiry → Professional dashboard leads tab shows it within 15s poll interval.
- TR-6.2 (rule): Open chat thread → type message → send → appears in UI. Reload page → message still there.
- TR-6.3 (rule): Each message row in storage has `sender_id`, `receiver_id`, `message`, `created_at` timestamp, `read` boolean.
- TR-6.4 (rule): Receiver sees unread indicator (badge/count) before opening.

---

## Task 7: Admin Panel - Real Supabase Data (FR-6 → AC-6)
**Status**: pending  
**Priority**: high

### Scope
- Current bugs:
  1. `api.getAllUsers()` returns ONLY localStorage `PROFILES` key — never queries Supabase `profiles` table.
  2. `api.getReports()` returns ONLY localStorage `REPORTS` — never Supabase `reports`.
  3. AdminPanel shows static `SEED_PROFILES` length in Account Passwords tab — OK for reference, but data lists must use real data.
  4. `resetPlatformData()` resets localStorage but does NO harm to Supabase — keep that behavior.
- Fixes:
  1. `api.getAllUsers()`: if Supabase configured → `.from('profiles').select('*')` → merge with localStorage (remote wins, local is fallback).
  2. `api.getReports()`: if Supabase → `.from('reports').select('*, reporter:profiles(full_name, email)')` → merge.
  3. AdminPanel: load counts for stats per tab correctly (e.g., likes/comments/saves on content — at minimum show real items from DB; optionally show aggregated counts if simple to query).
  4. AdminPanel RLS for reports: current RLS says user can only see own reports (reporter_id). Admin likely can't see others' reports. Fix in code by either:
     - (a) document the SQL command to run: `CREATE POLICY "Admins view all reports" ON public.reports FOR SELECT USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' OR auth.uid() = reporter_id );` AND ensure we do our best effort: attempt the query, if rows returned = 0 empty fallback to localStorage reports.
  5. Admin should also see likes/comments/saves/enquiries — these come via the list pages we already have (enquiries tab yes; likes/comments are visible on reel cards themselves).

### Files
- [api.ts](file:///c:/Users/MANGESH/Desktop/Swaraj/src/services/api.ts) (getAllUsers, getReports → query Supabase)
- [AdminPanel.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/components/AdminPanel.tsx) (show real counts; report view includes reporter name, reason, status, date)

### TR
- TR-7.1 (rule): With Supabase configured, Admin→Users list shows rows equal to profiles table total row count (not just 5 seed).
- TR-7.2 (rule): Admin→Reports list shows rows from reports table with reporter, target type/id, reason, status.
- TR-7.3 (rule): "Reset All Data" button does NOT send DELETE to Supabase tables (only resets localStorage).

---

## Task 8: Reports Moderation — Durable & Non-Destructive (FR-7 → AC-7)
**Status**: pending  
**Priority**: medium

### Scope
- Current: Reports exist in schema but may not have a submit UI; Admin moderation actions don't write to Supabase.
- Fixes:
  1. Ensure Admin `updateReportStatus()` also updates Supabase `reports.status` column (currently only localStorage).
  2. If no Report submission UI exists on the user side (customer side), add minimal "Report" option on PropertyCard and ReelsFeed (via PropertyDetailModal and on reel action bar) that calls `api.submitReport()`.
  3. Add `api.submitReport({ reporterId, targetType, targetId, reason })` that inserts to Supabase `reports` table (if configured) + localStorage.
  4. Ensure status changes in Admin are written to Supabase.
  5. Verify NO auto-deletion: submitting report or marking resolved does not delete content.

### Files
- [api.ts](file:///c:/Users/MANGESH/Desktop/Swaraj/src/services/api.ts) (updateReportStatus → Supabase update; add submitReport)
- [AdminPanel.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/components/AdminPanel.tsx) (report card: show date, show target link preview; resolve/dismiss actions call API then update state without re-fetch if possible)
- [PropertyDetailModal.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/components/PropertyDetailModal.tsx) (add Report button)
- [ReelsFeed.tsx](file:///c:/Users/MANGESH/Desktop/Swaraj/src/components/ReelsFeed.tsx) (add Report option via icon or long-press menu)
- [types/database.ts](file:///c:/Users/MANGESH/Desktop/Swaraj/src/types/database.ts) (ensure Report is complete, add submitReport input type if missing)

### TR
- TR-8.1 (rule): Submit report (API or UI) → reports table gets row with all fields.
- TR-8.2 (rule): Admin mark "resolved" → reports.status = 'resolved' in Supabase after reload.
- TR-8.3 (rule): Reported property/reel still visible after report submit (not auto-hidden/deleted).

---

## Task 9: Verification + Final Polish Pass
**Status**: pending  
**Priority**: medium

### Scope
- Run lint / typecheck.
- Test 3 flows manually (Customer, Professional, Admin) against each AC.
- Remove any residual `window.location.reload()` that we might have accidentally introduced (other than existing admin reset).
- Ensure no duplicate fetching patterns in App.tsx `loadData()`, `useEffect([filters])`.

### Files
- All files touched in tasks 1-8
- Run diagnostics and test commands

### TR
- TR-9.1 (rule): `GetDiagnostics` or `npm run lint` shows no new errors.
- TR-9.2 (rule): No `window.location.reload()` introduced in any user-action flow (only pre-existing Admin Reset retains one).
- TR-9.3 (rubric - overall code quality 0-2): `2` clean separation of concerns, no leaking state; `1` some minor concerns; `0` tangled.
