# Bugfix Requirements Document

## Introduction

The Swaraj real estate platform (React + Supabase) has five interconnected bugs affecting core user workflows: property/reel creation produces duplicate feed entries, enquiries submitted by buyers never appear in the seller's dashboard, property view counts silently fail to persist, registration and login break when Supabase email confirmation is required, and sequential data fetching with aggressive polling makes the UI slow and unresponsive. These bugs collectively degrade the experience for all three user roles — customers, professionals, and admins.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 — Duplicate properties and reels in the feed**

1.1 WHEN a professional creates a new property listing THEN the system displays the listing twice in the feed (once with the local ID `prop-${timestamp}` and once with the Supabase UUID), because `createProperty` writes to localStorage immediately, and the subsequent `getProperties` merge cannot deduplicate records that have two different IDs.

1.2 WHEN a professional uploads a new video reel THEN the system displays the reel twice in the feed (once with the local ID `reel-${timestamp}` and once with the Supabase UUID), because `createReel` writes to localStorage immediately and the same ID-based merge fails to collapse the two records.

---

**Bug 2 — Enquiries not appearing in the seller's dashboard**

2.1 WHEN a customer submits an enquiry on a property owned by a professional THEN the enquiry does not appear in the professional's "Received Leads" tab, because `sendEnquiry` stores the property's `owner_id` (a local string like `user-broker-1`) as `recipient_id`, while `getEnquiriesForUser` compares it against the authenticated user's real Supabase UUID — the string comparison fails.

2.2 WHEN Supabase is configured and a professional views their dashboard THEN Supabase-sourced enquiry rows do not match the professional's account, because the `recipient_email` fallback column does not exist in the Supabase `enquiries` table schema, so email-based matching also fails.

2.3 WHEN a customer submits an enquiry on a reel THEN the enquiry does not appear in the reel creator's dashboard, because `sendEnquiry` resolves `recipient_id` from the reel's `user_id` which is also a local string ID, not the creator's Supabase UUID.

---

**Bug 3 — Property view counts not persisted**

3.1 WHEN a user opens a property detail modal THEN the system calls `incrementPropertyViews` with the local string ID (e.g. `prop-seed-1`), the local count increments correctly, but the Supabase update silently fails because `getValidUuid('prop-seed-1')` produces a fake UUID that does not exist in the database.

3.2 WHEN a user-created property (one that exists in Supabase with a real UUID) is viewed THEN the Supabase view-count update silently fails because `incrementPropertyViews` passes the local `prop-${timestamp}` ID string to the `.eq('id', propertyId)` call instead of the actual Supabase UUID.

3.3 WHEN properties are refreshed after a view is incremented THEN the locally-incremented count is sometimes overwritten by the stale Supabase value, because the merge uses `Math.max()` but the Supabase row still holds the old count from before the failed update.

---

**Bug 4 — Registration and login broken with Supabase email confirmation**

4.1 WHEN a new user completes the sign-up form and Supabase requires email confirmation THEN the system silently continues without informing the user they must confirm their email, leaving them in a state where they appear partially registered but cannot authenticate.

4.2 WHEN a user attempts to log in and Supabase returns any auth error other than "email not confirmed" THEN the system falls through to local profile creation and logs the user in locally, falsely presenting a successful Supabase-authenticated session.

4.3 WHEN Supabase's `handle_new_user` trigger has already created the profile row and `signUp` attempts to upsert that same row THEN the upsert may conflict or create a duplicate profile, because the trigger-created row and the upserted row may have different field states.

4.4 WHEN Supabase auth succeeds during login but the profile row is missing from the `profiles` table (trigger failure) THEN the `login` function returns `null` silently and falls through to local login, creating a ghost session that does not reflect the real Supabase identity.

---

**Bug 5 — Slow data loading and cascading API calls**

5.1 WHEN the application mounts THEN `loadData()` executes five async calls sequentially (`getCurrentUser` → `getAllUsers` → `getProperties` → `getReels` → `getSavedPropertyIds`), each making at least one Supabase network round-trip, causing the properties and reels feed to remain blank for the full duration of all five calls.

5.2 WHEN a professional navigates to their dashboard THEN the `ProfessionalDashboard` component starts a `setInterval` polling every 3000ms, where each tick calls `getEnquiriesForUser` which itself internally calls `getProperties` and `getReels` — making 3+ Supabase queries every 3 seconds and interfering with the initial App.tsx load.

5.3 WHEN data is being fetched on initial load or dashboard navigation THEN the system shows no loading indicator, so the UI appears blank or stale with no visual feedback to the user.

---

### Expected Behavior (Correct)

**Bug 1 — Duplicate feed entries must not occur**

2.1 WHEN a professional creates a new property listing THEN the system SHALL display the listing exactly once in the feed, by tracking the Supabase-returned UUID and updating the local record's ID to match, so that subsequent merges collapse the two records into one.

2.2 WHEN a professional uploads a new video reel THEN the system SHALL display the reel exactly once in the feed, by the same ID-reconciliation strategy applied to `createReel`.

---

**Bug 2 — Enquiries must reach the seller's dashboard**

2.1 WHEN a customer submits an enquiry on a property THEN the system SHALL store the current authenticated professional's Supabase UID (or local ID when Supabase is not configured) as `recipient_id`, so that `getEnquiriesForUser` can match it correctly regardless of auth provider.

2.2 WHEN Supabase is configured, `sendEnquiry` SHALL store `recipient_email` on the local enquiry record and the Supabase `enquiries` row shall be queried with a filter that matches on `recipient_id` OR `recipient_email`, so that cross-UUID matching succeeds.

2.3 WHEN a customer submits an enquiry on a reel THEN the system SHALL resolve the reel creator's authenticated UID as `recipient_id` using the same resolution strategy as property enquiries.

---

**Bug 3 — Property view counts must persist correctly**

3.1 WHEN a user opens a property detail modal for a seed/local property THEN the system SHALL increment the view count in localStorage only (gracefully skipping the Supabase update when no matching UUID exists in the DB), so the count is not reset on the next merge.

3.2 WHEN a user opens a property created via the platform (with a real Supabase UUID) THEN the system SHALL pass the Supabase UUID to the `.update()` call, so the DB view count increments correctly.

3.3 WHEN properties are fetched and merged after a view increment THEN the system SHALL use `Math.max()` on `views_count` and SHALL NOT overwrite a higher local count with a lower Supabase count, ensuring the locally-incremented value survives the merge.

---

**Bug 4 — Registration and login must work reliably**

4.1 WHEN Supabase `signUp` returns successfully but email confirmation is required THEN the system SHALL display a clear "Check your email to confirm your account" message and SHALL NOT proceed to the authenticated session until confirmation is complete.

4.2 WHEN Supabase `login` fails with an error that is not "email not confirmed" THEN the system SHALL return that error to the UI and SHALL NOT create or load a local profile session, preventing ghost logins.

4.3 WHEN a Supabase profile row already exists (trigger-created) and `signUp` attempts to upsert it THEN the system SHALL use upsert semantics that handle the conflict without error or duplication, preserving the existing row's state.

4.4 WHEN Supabase auth succeeds during login but the profile row is missing THEN the system SHALL create the profile row in Supabase with the authenticated user's UUID, then return that profile — rather than silently falling through to local login.

---

**Bug 5 — Data loading must be fast and non-blocking**

5.1 WHEN the application mounts THEN `loadData()` SHALL execute independent async calls in parallel using `Promise.all` (user, profiles, properties, reels, saved IDs), so the total load time equals the slowest single call rather than the sum of all calls.

5.2 WHEN the `ProfessionalDashboard` component mounts THEN it SHALL use a polling interval of no less than 15 seconds, and each poll tick SHALL call only `getEnquiriesForUser` directly without triggering cascading `getProperties` / `getReels` calls, to prevent interference with the main app load.

5.3 WHEN data is being fetched on initial load or dashboard refresh THEN the system SHALL display a visible loading state (spinner or skeleton) so users receive immediate visual feedback instead of a blank screen.

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a professional views their own dashboard THEN the system SHALL CONTINUE TO show accurate counts for active listings, leads received, total views, and published reels without requiring a page reload.

3.2 WHEN Supabase is NOT configured (local-only mode) THEN the system SHALL CONTINUE TO work fully using localStorage for all operations — sign-up, login, property creation, reel creation, enquiry sending, and dashboard data — exactly as before.

3.3 WHEN a customer toggles the save/unsave button on a property card THEN the system SHALL CONTINUE TO persist that preference in localStorage and reflect it immediately in the Saved Properties tab count and grid.

3.4 WHEN a user likes, saves, or comments on a reel THEN the system SHALL CONTINUE TO update the local counts and state in real time without requiring a page reload.

3.5 WHEN an admin views the Admin Panel THEN the system SHALL CONTINUE TO list all users, properties, reels, and reports, and all moderation actions (verify, change role, update report status) SHALL CONTINUE TO persist correctly.

3.6 WHEN a professional deletes a property, reel, or enquiry from their dashboard THEN the system SHALL CONTINUE TO remove the item immediately from both the local list and Supabase.

3.7 WHEN the filter controls on the Properties tab are changed THEN the system SHALL CONTINUE TO apply city, property type, listing type, price range, and bedroom filters correctly to the displayed property grid.
