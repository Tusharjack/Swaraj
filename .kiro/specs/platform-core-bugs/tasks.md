# Implementation Plan

- [x] 1. Write bug condition exploration tests (BEFORE implementing any fix)
  - **Property 1: Bug Condition** - Five Core Platform Bug Conditions
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms each bug exists
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate each fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - **Scoped PBT Approach**: Scope each property to the concrete failing case(s) to ensure reproducibility
  - Set up a test file (e.g. `src/services/__tests__/api.bugconditions.test.ts`) with mocks for Supabase and localStorage
  - **Bug 1 — Duplicate Listings**: Mock `supabase.from('properties').insert` to return a UUID different from the local timestamp ID. Call `createProperty`, then `getProperties`. Assert the returned array contains exactly one item matching the created title. Run on unfixed code — expect FAILURE (array length is 2, not 1).
  - **Bug 2 — Missing Leads**: Seed a property with `owner_id = 'user-broker-1'`. Seed a profile with `id = 'real-uuid-xxxx'` and the same email. Call `sendEnquiry`. Then call `getEnquiriesForUser('real-uuid-xxxx')`. Assert the returned array has length > 0. Run on unfixed code — expect FAILURE (returns empty array).
  - **Bug 3 — Lost View Count**: Call `incrementPropertyViews('prop-seed-1')`. Assert that `getProperties()` returns the property with `views_count` equal to the pre-call value + 1. Assert that the Supabase `.update` call is NOT made with the fake UUID. Run on unfixed code — expect FAILURE (Supabase update is invoked with fake UUID `00000000-0000-4000-8000-000000000000`).
  - **Bug 4 — Ghost Session**: Mock `supabase.auth.signUp` to return `{ data: { user: mockUser, session: null }, error: null }` (email-confirmation-required scenario). Call `signUp`. Assert `localStorage.getItem(CURRENT_USER)` is `null` and the return value contains `needsEmailConfirmation: true`. Run on unfixed code — expect FAILURE (localStorage is set, `needsEmailConfirmation` is absent).
  - **Bug 5 — Sequential Load**: Spy on all five `api.*` calls used in `loadData()`. Invoke `loadData()`. Assert that all five calls are initiated within the same event-loop tick (i.e., before any of them resolves). Run on unfixed code — expect FAILURE (fifth call starts only after the fourth resolves).
  - Document all counterexamples found (e.g. "createProperty with mocked Supabase returns array of length 2", "getEnquiriesForUser returns [] after sendEnquiry", etc.)
  - Mark task complete when all five exploration tests are written, run, and their failures are documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2_

- [ ] 2. Write preservation property tests (BEFORE implementing any fix)
  - **Property 2: Preservation** - Local-Only Mode and Non-Affected Operations
  - **IMPORTANT**: Follow observation-first methodology — observe UNFIXED code behavior for non-buggy inputs first, then encode those observations as tests
  - **Scoped to inputs where isBugCondition returns false for ALL five bugs**: local-only mode (`isSupabaseConfigured = false`), save/unsave, like/save/comment on reels, admin ops, delete ops, filter application
  - **Observe on unfixed code**:
    - `signUp` with `isSupabaseConfigured = false` → observe returned profile shape and localStorage state
    - `toggleSaveProperty(propertyId)` → observe that `getSavedPropertyIds()` includes/excludes the ID correctly
    - `getProperties({ city: 'Mumbai' })` → observe filtered result set for a known dataset
    - `toggleLikeReel(reelId)` → observe `likes_count` delta and `is_liked_by_user` flag
    - `deleteProperty(propertyId)` → observe the property is absent from subsequent `getProperties()` call
    - `toggleUserVerification(userId)` → observe the `verified` flag toggles in localStorage
  - Write property-based tests that assert the observed behavior holds across random valid inputs:
    - For all `isSupabaseConfigured = false` inputs, full auth flow (sign-up, login) produces same profile structure and localStorage state
    - For all `propertyId` values, save/unsave toggles are idempotent and `getSavedPropertyIds` reflects the correct set
    - For all random filter combinations, `getProperties(filters)` returns only items matching every active filter
    - For all `reelId` values, `toggleLikeReel` increments count by +1 on first call and -1 on second call
    - For all `propertyId` / `reelId` / `enquiryId`, delete operations remove exactly one item and leave the rest intact
    - For all `userId` values, `toggleUserVerification` and `updateUserRole` mutate only the target profile in localStorage
  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: All preservation tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and confirmed passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 3. Fix Bug 1 — Duplicate property and reel listings in the feed

  - [ ] 3.1 Implement ID reconciliation in `createProperty` (`src/services/api.ts`)
    - After `supabase.from('properties').insert(...).select().single()` succeeds and `data` is non-null, read `data.id` (the real Supabase UUID)
    - Find the just-written localStorage record by matching the local timestamp ID (`propId`)
    - Replace its `id` field with `data.id` and re-save to `STORAGE_KEYS.PROPERTIES`
    - Update the `newProp` reference so the returned object also carries the real UUID
    - No change needed to the Map-keyed merge in `getProperties` — once IDs match, deduplication is automatic
    - _Bug_Condition: isBugCondition_Bug1(ctx) where isSupabaseConfigured = true AND supabaseId != localId AND localStorage contains item with localId_
    - _Expected_Behavior: getProperties() returns exactly one item per created property (count = 1, not 2)_
    - _Preservation: When isSupabaseConfigured = false, createProperty behavior is completely unchanged; local-only array still receives the item with its timestamp ID_
    - _Requirements: 1.1_

  - [ ] 3.2 Implement ID reconciliation in `createReel` (`src/services/api.ts`)
    - Apply the identical pattern: after the Supabase insert returns `data.id`, update the localStorage record for `STORAGE_KEYS.REELS` and the returned `newReel` object
    - _Bug_Condition: isBugCondition_Bug1(ctx) where isSupabaseConfigured = true AND supabaseId != localId (reel variant)_
    - _Expected_Behavior: getReels() returns exactly one item per created reel_
    - _Preservation: When isSupabaseConfigured = false, createReel behavior is completely unchanged_
    - _Requirements: 1.2_

  - [ ] 3.3 Verify bug condition exploration test (Bug 1) now passes
    - **Property 1: Expected Behavior** - No Duplicate Feed Entries After Creation
    - **IMPORTANT**: Re-run the SAME test from task 1 (Bug 1 sub-test) — do NOT write a new test
    - The test from task 1 mocks Supabase insert to return a different UUID and asserts `getProperties()` length = 1
    - Run it now against the fixed code
    - **EXPECTED OUTCOME**: Test PASSES (confirms Bug 1 is fixed)
    - _Requirements: 1.1, 1.2_

  - [ ] 3.4 Verify preservation tests still pass after Bug 1 fix
    - **Property 2: Preservation** - Local-Only Mode and Non-Affected Operations
    - **IMPORTANT**: Re-run the SAME preservation tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions from Bug 1 fix)

- [ ] 4. Fix Bug 2 — Enquiries not appearing in the seller's dashboard

  - [ ] 4.1 Add Supabase UID resolution by email in `sendEnquiry` (`src/services/api.ts`)
    - After resolving `recipientProfile` from localStorage, check `if (isSupabaseConfigured && recipientProfile?.email)`
    - Query `supabase.from('profiles').select('id').eq('email', recipientProfile.email).maybeSingle()`
    - If a row is returned, use `sbProf.id` as `exactRecipientId` (the real Supabase UUID)
    - The existing local-ID fallback chain remains intact for local-only mode
    - Ensure `recipient_email` is written to both the local enquiry object and the Supabase `enquiries` insert payload
    - _Bug_Condition: isBugCondition_Bug2(enquiry, viewerProfile) where localIdMatch = false AND uuidMatch = false AND emailMatch = false_
    - _Expected_Behavior: getEnquiriesForUser(supabaseUid) finds the enquiry when it was sent to a local string owner_id that maps to the same email_
    - _Preservation: When isSupabaseConfigured = false, sendEnquiry uses the local profile ID as recipient_id exactly as before_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 4.2 Verify bug condition exploration test (Bug 2) now passes
    - **Property 1: Expected Behavior** - Enquiries Always Reach the Correct Recipient's Dashboard
    - **IMPORTANT**: Re-run the SAME test from task 1 (Bug 2 sub-test) — do NOT write a new test
    - The test seeds `owner_id = 'user-broker-1'`, submits enquiry, then asserts `getEnquiriesForUser('real-uuid-xxxx')` length > 0
    - **EXPECTED OUTCOME**: Test PASSES (confirms Bug 2 is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 4.3 Verify preservation tests still pass after Bug 2 fix
    - **Property 2: Preservation** - Local-Only Mode and Non-Affected Operations
    - **IMPORTANT**: Re-run the SAME preservation tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions from Bug 2 fix)

- [ ] 5. Fix Bug 3 — Property and reel view counts not persisted

  - [ ] 5.1 Add UUID detection and conditional Supabase skip in `incrementPropertyViews` (`src/services/api.ts`)
    - Add inline UUID check: `const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId)`
    - Wrap the entire Supabase update block in `if (isSupabaseConfigured && isRealUuid) { ... }`
    - Inside the guarded block, replace `getValidUuid(propertyId)` with `propertyId` directly (it is already a real UUID)
    - When the ID is a local string, the Supabase block is skipped entirely — only localStorage is updated
    - The existing `Math.max` merge in `getProperties` is correct as-is; no change needed
    - _Bug_Condition: isBugCondition_Bug3(propertyId) where isLocalStringId = true AND fakeUuid does not exist in Supabase_
    - _Expected_Behavior: After incrementPropertyViews(id), getProperties() returns the property with views_count = pre-call value + 1 for all ID types_
    - _Preservation: For real UUID properties, Supabase update is called with the correct UUID; Math.max merge continues to preserve the higher of local vs remote counts_
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 5.2 Apply identical UUID detection pattern to `incrementReelViews` (`src/services/api.ts`)
    - Same `isRealUuid` check and conditional Supabase block wrapping
    - Replace `getValidUuid(reelId)` with `reelId` inside the guarded block
    - _Requirements: 3.1, 3.2_

  - [ ] 5.3 Verify bug condition exploration test (Bug 3) now passes
    - **Property 1: Expected Behavior** - View Counts Increment Correctly for All Property ID Types
    - **IMPORTANT**: Re-run the SAME test from task 1 (Bug 3 sub-test) — do NOT write a new test
    - The test asserts `views_count` increments by 1 and that Supabase `.update` is NOT called with the fake UUID
    - **EXPECTED OUTCOME**: Test PASSES (confirms Bug 3 is fixed)
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 5.4 Verify preservation tests still pass after Bug 3 fix
    - **Property 2: Preservation** - Local-Only Mode and Non-Affected Operations
    - **IMPORTANT**: Re-run the SAME preservation tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions from Bug 3 fix)

- [ ] 6. Fix Bug 4 — Registration and login broken with Supabase email confirmation

  - [ ] 6.1 Fix `signUp` to detect email-confirmation-pending state (`src/services/api.ts`)
    - After `supabase.auth.signUp` returns, add check: `if (!error && authData?.user && !authData?.session)`
    - In that branch: do NOT call `setLocalState(STORAGE_KEYS.CURRENT_USER, ...)` 
    - Return `{ profile: newProf, needsEmailConfirmation: true }` immediately
    - Add `needsEmailConfirmation?: boolean` to the `signUp` return type
    - Update the Supabase profiles upsert to use `{ onConflict: 'id' }` to handle trigger-created rows without duplication
    - _Bug_Condition: isBugCondition_Bug4_SignUp(authData, error) where error = null AND user IS NOT NULL AND session IS NULL_
    - _Expected_Behavior: localStorage.CURRENT_USER is null; return value contains needsEmailConfirmation = true_
    - _Preservation: When session IS NOT NULL (normal sign-up), behavior is completely unchanged; local-only sign-up (isSupabaseConfigured = false) is completely unchanged_
    - _Requirements: 4.1, 4.3_

  - [ ] 6.2 Fix `login` to stop fallthrough on real Supabase errors (`src/services/api.ts`)
    - In the `if (error)` branch, add `else` block for errors that are NOT "email not confirmed"
    - In that else block: `return { profile: null as any, error: error.message }` immediately — do NOT proceed to local profile creation
    - Keep the "email not confirmed" fallback path intact (profile lookup by email in Supabase profiles table)
    - _Bug_Condition: isBugCondition_Bug4_Login(error) where error IS NOT NULL AND NOT includes 'email not confirmed'_
    - _Expected_Behavior: Returns { error: error.message } without touching localStorage; no ghost session is created_
    - _Preservation: Login with correct credentials (error = null) is completely unchanged; local-only login (isSupabaseConfigured = false) is completely unchanged_
    - _Requirements: 4.2_

  - [ ] 6.3 Fix `login` to auto-create missing profile row when Supabase auth succeeds (`src/services/api.ts`)
    - After `data?.user` is confirmed and the `supabase.from('profiles').select(*)` returns null, create a minimal profile row
    - Insert into `supabase.from('profiles')` using `data.user.id`, `data.user.email`, and metadata fields
    - Store in localStorage and return the new profile
    - _Requirements: 4.4_

  - [ ] 6.4 Update `AuthModal` to handle `needsEmailConfirmation` (`src/components/AuthModal.tsx`)
    - In the `signUp` success branch, check if the result contains `needsEmailConfirmation: true`
    - If so, display a "Check your inbox — click the confirmation link to activate your account" banner
    - Do NOT call `onAuthSuccess` or `onClose` in this case; keep the modal open showing the confirmation message
    - _Requirements: 4.1_

  - [ ] 6.5 Verify bug condition exploration tests (Bug 4) now pass
    - **Property 1: Expected Behavior** - Auth Flow Does Not Create Ghost Sessions
    - **IMPORTANT**: Re-run the SAME tests from task 1 (Bug 4 sub-tests) — do NOT write new tests
    - The tests assert `localStorage.CURRENT_USER = null` when `session = null`, and assert login with wrong password returns error without local session
    - **EXPECTED OUTCOME**: Both tests PASS (confirms Bug 4 is fixed)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 6.6 Verify preservation tests still pass after Bug 4 fix
    - **Property 2: Preservation** - Local-Only Mode and Non-Affected Operations
    - **IMPORTANT**: Re-run the SAME preservation tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions from Bug 4 fix)

- [ ] 7. Fix Bug 5 — Slow data loading and cascading API calls

  - [ ] 7.1 Parallelize `loadData` with `Promise.all` in `App.tsx` (`src/App.tsx`)
    - Replace the five sequential `await` calls with a single `Promise.all`:
      ```typescript
      const [user, profiles, propsList, reelsList, savedIds] = await Promise.all([
        api.getCurrentUser(),
        api.getAllUsers(),
        api.getProperties(filters),
        api.getReels(),
        api.getSavedPropertyIds(),
      ]);
      ```
    - Set all five state values in a single batch after `Promise.all` resolves
    - _Bug_Condition: isBugCondition_Bug5_InitialLoad(loadDataImpl) where loadDataImpl uses sequential awaits_
    - _Expected_Behavior: All 5 api calls are initiated within the same event-loop tick; total elapsed time ≤ slowest individual call + epsilon_
    - _Preservation: All five data sources are still fetched and set in state; filter-dependent refetch on `useEffect([filters])` is unchanged_
    - _Requirements: 5.1_

  - [ ] 7.2 Add loading state and skeleton/spinner to `App.tsx` (`src/App.tsx`)
    - Add `const [isLoading, setIsLoading] = useState(true)`
    - Set `isLoading(true)` at the start of `loadData` and `isLoading(false)` in the `finally` block
    - Render a spinner or skeleton grid in the properties tab while `isLoading` is true
    - _Requirements: 5.3_

  - [ ] 7.3 Increase polling interval from 3 000ms to 15 000ms in `ProfessionalDashboard` (`src/components/ProfessionalDashboard.tsx`)
    - Change `setInterval(() => { loadDashboardData(); }, 3000)` to `15000`
    - _Bug_Condition: isBugCondition_Bug5_Polling where intervalMs < 15000_
    - _Requirements: 5.2_

  - [ ] 7.4 Break the cascading `getProperties` / `getReels` calls inside the poll tick (`src/components/ProfessionalDashboard.tsx`)
    - On component mount (once), fetch and cache the user's property IDs and reel IDs in component state: `useState<string[]>` for each
    - Update `loadDashboardData` so the polling tick only calls `api.getEnquiriesForUser` — it does NOT call `api.getProperties` or `api.getReels` on every tick
    - The properties and reels counts in the analytics cards use the cached arrays, not a live refetch per tick
    - _Bug_Condition: isBugCondition_Bug5_Polling where callsPerTick > 1_
    - _Expected_Behavior: Each poll tick makes at most 1 Supabase query (enquiries only); no cascading getProperties/getReels calls_
    - _Preservation: Dashboard analytics counts (listings, leads, views, reels) remain accurate; all three tab contents remain correct_
    - _Requirements: 5.2_

  - [ ] 7.5 Add loading state to `ProfessionalDashboard` tabs (`src/components/ProfessionalDashboard.tsx`)
    - Add `isLoading` state, set to `true` on mount, `false` after first `loadDashboardData` completes
    - Render a brief spinner inside the leads, properties, and reels tabs while `isLoading` is true
    - _Requirements: 5.3_

  - [ ] 7.6 Verify bug condition exploration tests (Bug 5) now pass
    - **Property 1: Expected Behavior** - Initial Load Time and Polling Overhead Are Bounded
    - **IMPORTANT**: Re-run the SAME tests from task 1 (Bug 5 sub-tests) — do NOT write new tests
    - The test asserts all five `api.*` calls are initiated concurrently; the polling test asserts interval ≥ 15 000ms and callsPerTick ≤ 1
    - **EXPECTED OUTCOME**: Both tests PASS (confirms Bug 5 is fixed)
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 7.7 Verify preservation tests still pass after Bug 5 fix
    - **Property 2: Preservation** - Local-Only Mode and Non-Affected Operations
    - **IMPORTANT**: Re-run the SAME preservation tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions from Bug 5 fix)

- [ ] 8. Checkpoint — Ensure all tests pass and all bugs are resolved
  - Re-run the complete test suite (all exploration tests from task 1 + all preservation tests from task 2)
  - Confirm all five bug condition exploration tests now PASS (each bug is fixed)
  - Confirm all preservation tests still PASS (no regressions introduced)
  - Manually smoke-test the critical user flows:
    - Professional creates a property → appears exactly once in the feed
    - Customer submits enquiry → appears in the professional's "Received Leads" tab
    - User opens a property detail modal → `views_count` increments correctly in localStorage
    - New user registers while Supabase email confirmation is required → sees confirmation banner, not a ghost session
    - App mounts on a slow connection → properties grid renders without waiting for all five calls sequentially
    - Professional navigates to dashboard → polling does not saturate the network every 3 seconds
  - Ensure all tests pass; ask the user if any questions arise.
