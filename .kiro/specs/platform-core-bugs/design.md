# Platform Core Bugs — Bugfix Design

## Overview

The Swaraj real estate platform (React + Supabase) has five interconnected bugs that together degrade
the experience for all three user roles (customers, professionals, admins). The bugs span four layers:
persistence (localStorage ↔ Supabase ID reconciliation), business logic (enquiry routing), data
integrity (view-count merging), authentication flow, and performance (sequential fetching + polling).

The fix strategy is **minimal and surgical**: each bug is addressed at the exact point where the
incorrect behaviour originates, without restructuring surrounding logic. Every fix is guarded by the
`isSupabaseConfigured` flag so local-only mode continues to work unchanged.

---

## Glossary

- **Bug_Condition (C)**: The set of runtime inputs / states that trigger defective behaviour.
- **Property (P)**: The correct observable outcome that must hold for any input satisfying C.
- **Preservation**: Existing behaviour that must remain identical after the fix is applied.
- **F**: The original (unfixed) version of a function.
- **F'**: The fixed version of a function.
- **Local ID**: A string ID generated at creation time in the browser, e.g. `prop-1700000000000`.
- **Supabase UUID**: A proper UUID returned by `supabase.from(...).insert(...).select().single()`.
- **`getValidUuid(id)`**: Helper in `api.ts` that produces a fake-but-valid UUID shape from a local ID string; does **not** correspond to any real Supabase row.
- **`isSupabaseConfigured`**: Boolean flag; `true` only when real Supabase credentials are present.
- **`STORAGE_KEYS`**: Object of localStorage key constants defined at the top of `api.ts`.
- **`recipient_email`**: Field already present on the `Enquiry` type used as a secondary matching key for cross-UUID dashboard filtering.

---

## Bug Details

### Bug 1 — Duplicate Listings in the Feed

The bug manifests when a professional creates a property or reel while Supabase is configured.
`createProperty` / `createReel` write the item to localStorage using a local timestamp ID
(`prop-${Date.now()}` / `reel-${Date.now()}`), then insert the same item into Supabase, which
assigns a real UUID. On the next `getProperties` / `getReels` call the merge iterates over both
localStorage and Supabase results; because the two records carry different `id` values they are
treated as distinct items, and both are rendered in the feed.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug1(context)
  INPUT: context = { isSupabaseConfigured: boolean, localId: string, supabaseId: string | null }
  OUTPUT: boolean

  RETURN context.isSupabaseConfigured = true
         AND context.supabaseId IS NOT NULL
         AND context.localId != context.supabaseId
         AND localStorage contains item with context.localId
END FUNCTION
```

**Concrete Examples:**

- Professional creates a property → localStorage gets `prop-1700000000001`, Supabase gets
  `a1b2c3d4-...`. Feed shows two cards for the same property.
- Professional uploads a reel → localStorage gets `reel-1700000000002`, Supabase gets
  `e5f6g7h8-...`. Reels feed shows the reel twice.

---

### Bug 2 — Enquiries Not Appearing on the Seller's Dashboard

The bug manifests when a customer submits an enquiry. `sendEnquiry` resolves `recipient_id` from
the property's `owner_id` field (a local string like `user-broker-1`). The authenticated
professional's session may carry a real Supabase UUID. The equality checks in
`getEnquiriesForUser` compare `recipient_id === userId` — a string vs UUID comparison that
always evaluates to `false`.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug2(enquiry, viewerProfile)
  INPUT: enquiry = { recipient_id: string, recipient_email?: string }
         viewerProfile = { id: string, email: string }
  OUTPUT: boolean

  localIdMatch    := enquiry.recipient_id === viewerProfile.id
  uuidMatch       := getValidUuid(enquiry.recipient_id) === getValidUuid(viewerProfile.id)
  emailMatch      := enquiry.recipient_email?.toLowerCase() === viewerProfile.email.toLowerCase()

  RETURN NOT localIdMatch AND NOT uuidMatch AND NOT emailMatch
END FUNCTION
```

**Concrete Examples:**

- Customer submits enquiry on a seed property (owner_id = `user-broker-1`). Broker logs in via
  Supabase; their `id` is `a1b2c3d4-...`. Dashboard shows 0 leads.
- Customer submits enquiry on a reel (user_id = `user-builder-1`). Builder's Supabase UUID is
  `e5f6g7h8-...`. Dashboard shows 0 leads.

---

### Bug 3 — Property View Counts Not Persisted

The bug manifests when `incrementPropertyViews` is called with a local string ID for a seed or
freshly-created property. `getValidUuid('prop-seed-1')` produces `00000000-0000-4000-8000-000000000000`
(a fake UUID). The Supabase `.eq('id', validUuid)` query matches no rows so the update silently
does nothing. Meanwhile the next `getProperties` merge may overwrite the locally-incremented count
with the stale Supabase value.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug3(propertyId)
  INPUT: propertyId: string
  OUTPUT: boolean

  isLocalStringId := NOT /^[0-9a-f]{8}-[0-9a-f]{4}-...$/.test(propertyId)
  fakeUuid        := getValidUuid(propertyId)
  existsInSupabase:= supabase.from('properties').select().eq('id', fakeUuid) returns 0 rows

  RETURN isLocalStringId AND existsInSupabase = false
END FUNCTION
```

**Concrete Examples:**

- User opens seed property `prop-seed-1`. `incrementPropertyViews('prop-seed-1')` fires. Local
  count goes from 142 → 143. Supabase update silently fails. Next `getProperties` merge pulls
  Supabase count (142) and `Math.max(142, 143)` → 143 is preserved **if the Supabase row never
  existed**. But if the Supabase row exists with the old value, the merge may overwrite.
- Newly created property `prop-1700000000001` exists in both localStorage and Supabase, but
  `incrementPropertyViews` passes the local ID string to Supabase — the UUID mismatch means the
  Supabase row is never updated.

---

### Bug 4 — Registration and Login Broken with Supabase Email Confirmation

The bug manifests in two distinct failure modes:

1. **Sign-up ghost session**: When Supabase requires email confirmation, `authData.user` is
   non-null but `authData.session` is null. The code proceeds to create a local profile and mark
   the user as logged in, but the Supabase session does not exist.
2. **Login fallthrough**: When Supabase `signInWithPassword` returns any error other than "email
   not confirmed", the code falls through to the localStorage profile lookup and creates a local
   session, masking the real auth failure.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug4_SignUp(authData, error)
  INPUT: authData = { user: User | null, session: Session | null }
         error: AuthError | null
  OUTPUT: boolean

  RETURN error IS NULL
         AND authData.user IS NOT NULL
         AND authData.session IS NULL   -- email confirmation pending
END FUNCTION

FUNCTION isBugCondition_Bug4_Login(error)
  INPUT: error: AuthError | null
  OUTPUT: boolean

  isEmailNotConfirmed := error?.message.toLowerCase().includes('email not confirmed')
  RETURN error IS NOT NULL AND NOT isEmailNotConfirmed
END FUNCTION
```

**Concrete Examples:**

- New user registers with a fresh email. Supabase sends confirmation email. `signUp` creates a
  local profile and sets `CURRENT_USER` in localStorage. User skips email confirmation and still
  appears logged in — but any subsequent Supabase-authenticated operation fails silently.
- Existing user enters a wrong password. Supabase returns `"Invalid login credentials"`. `login`
  falls through, finds the email in localStorage, and logs them in anyway.

---

### Bug 5 — Slow Data Loading and Cascading API Calls

The bug manifests on application mount and on professional dashboard navigation. `loadData()` in
`App.tsx` chains five `await` calls sequentially. Each call may make one or more Supabase network
requests. The total load time is the **sum** of all round-trips rather than the slowest single one.
Additionally, `ProfessionalDashboard` polls every 3000ms; each tick calls `getEnquiriesForUser`
which itself calls `getProperties()` and `getReels()` — adding 3+ extra Supabase queries every
3 seconds on top of the main app's own load.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug5_InitialLoad(loadDataImpl)
  INPUT: loadDataImpl: async function
  OUTPUT: boolean

  RETURN loadDataImpl uses sequential await chains
         AND does NOT use Promise.all for independent calls
END FUNCTION

FUNCTION isBugCondition_Bug5_Polling(dashboardImpl)
  INPUT: dashboardImpl: { intervalMs: number, callsPerTick: number }
  OUTPUT: boolean

  RETURN dashboardImpl.intervalMs < 15000
         OR dashboardImpl.callsPerTick > 1
END FUNCTION
```

**Concrete Examples:**

- App mounts on a slow 4G connection. Each of the 5 sequential calls takes ~400ms → 2 second
  blank screen before any properties render.
- Broker navigates to dashboard. Every 3 seconds, `getEnquiriesForUser` triggers
  `getProperties()` (1 Supabase call) + `getReels()` (1 Supabase call) + the enquiries query
  itself = 3 concurrent Supabase queries, 20 times per minute.

---

## Expected Behavior

### Preservation Requirements

These behaviours must remain **completely unchanged** after all five fixes are applied:

**Unchanged Behaviors:**
- WHEN Supabase is NOT configured, all operations (sign-up, login, property creation, reel
  creation, enquiry sending, dashboard data) SHALL continue to work fully via localStorage only.
- WHEN a customer toggles save/unsave on a property card, the preference SHALL persist in
  localStorage and be reflected immediately in the Saved Properties tab.
- WHEN a user likes, saves, or comments on a reel, local counts and state SHALL update in real
  time without a page reload.
- WHEN an admin uses the Admin Panel, all moderation actions (verify, change role, update report
  status) SHALL continue to persist correctly.
- WHEN a professional deletes a property, reel, or enquiry, the item SHALL be removed immediately
  from both localStorage and Supabase.
- WHEN filter controls on the Properties tab are changed, city / type / listing / price / bedroom
  filters SHALL continue to apply correctly to the displayed grid.
- WHEN a professional views their dashboard, accurate analytics counts (listings, leads, views,
  reels) SHALL remain visible without requiring a page reload.

**Scope:**
All inputs that do NOT satisfy any of the five bug conditions above (i.e. purely local-mode
operations, filter changes, save/like/comment actions, admin operations, delete operations) must
be completely unaffected by these fixes.

---

## Hypothesized Root Cause

### Bug 1 — Duplicate Listings

The root cause is **ID divergence after optimistic local write**: `createProperty` / `createReel`
writes the item to localStorage with a local timestamp ID before the Supabase insert completes.
When the Supabase response returns a different UUID, there is no code that updates the localStorage
record to replace the local ID with the real UUID. The `getProperties` merge uses a `Map<string, Property>`
keyed by `id` — two different keys → two distinct entries → duplicate render.

### Bug 2 — Enquiries Not Received

The root cause is **recipient ID resolution using the property/reel owner field rather than the
authenticated user's session ID**. Local seed data uses human-readable IDs (`user-broker-1`).
Supabase assigns proper UUIDs at registration. `sendEnquiry` takes `owner_id` from the property
record — which was seeded with the local ID — and stores it as `recipient_id`. The dashboard's
`getEnquiriesForUser` receives the real Supabase UUID of the logged-in professional. None of the
six equality checks in the filter function ever match because `"user-broker-1" !== "a1b2c3d4-..."`.

### Bug 3 — Views Not Counting

The root cause is **passing local string IDs through `getValidUuid()` and treating the result as a
real database UUID**. `getValidUuid` was designed to produce a valid UUID *shape* for Supabase type
validation, not to actually look up rows. For seed properties with IDs like `prop-seed-1`, the
resulting fake UUID does not exist in the `properties` table, so the Supabase update silently
affects 0 rows. For user-created properties, the Supabase UUID is only stored in Supabase itself
— the local copy still carries the `prop-${timestamp}` string — so the Supabase update also
affects 0 rows.

### Bug 4 — Auth Issues

Two separate root causes:

1. **Sign-up**: The code does not distinguish between `session === null` (email confirmation
   required) and a genuine auth failure. It checks only for `error` — which is `null` when
   confirmation is merely pending — and proceeds to create a local session unconditionally.
2. **Login fallthrough**: The error-branch check for `"email not confirmed"` is the only guarded
   path; all other Supabase errors fall through to the `localStorage` login, effectively bypassing
   Supabase authentication entirely for any error condition.

### Bug 5 — Slow Loading

The root cause is **sequential `await` chaining of independent async operations**. Each `await`
blocks the JavaScript event loop for the duration of that network round-trip before the next call
even starts. Additionally, `getEnquiriesForUser` was designed to be self-contained (it fetches
all properties and reels internally to compute ownership sets), which is correct in isolation but
becomes expensive when invoked on a tight polling interval.

---

## Correctness Properties

Property 1: Bug Condition — No Duplicate Feed Entries After Creation

_For any_ creation event where `isSupabaseConfigured` is true and `supabase.insert(...).select().single()`
returns a UUID that differs from the local timestamp ID, the fixed `createProperty` / `createReel`
functions SHALL replace the local ID in localStorage with the Supabase UUID so that the subsequent
`getProperties` / `getReels` merge produces exactly one record per created item.

**Validates: Requirements 2.1, 2.2 (Bug 1 — Expected Behavior)**

---

Property 2: Bug Condition — Enquiries Always Reach the Correct Recipient's Dashboard

_For any_ enquiry submission where the property `owner_id` or reel `user_id` is a local string ID,
the fixed `sendEnquiry` SHALL resolve the recipient's real authenticated ID by email lookup
(Supabase UID first, local profile ID as fallback) and store it as `recipient_id`, so that
`getEnquiriesForUser` matches the enquiry when the professional views their dashboard.

**Validates: Requirements 2.1, 2.2, 2.3 (Bug 2 — Expected Behavior)**

---

Property 3: Bug Condition — View Counts Increment Correctly for All Property ID Types

_For any_ `incrementPropertyViews(propertyId)` call, the fixed function SHALL:
(a) detect whether `propertyId` is a local string ID or a real UUID,
(b) skip the Supabase update for local IDs (preventing a silent no-op that could corrupt merge state),
(c) pass the correct UUID to Supabase for real Supabase-persisted properties,
so that the count stored in localStorage after the call is always equal to or greater than the
count before the call.

**Validates: Requirements 3.1, 3.2, 3.3 (Bug 3 — Expected Behavior)**

---

Property 4: Bug Condition — Auth Flow Does Not Create Ghost Sessions

_For any_ `signUp` call where Supabase returns `session === null` (email confirmation pending),
the fixed function SHALL return `{ profile, needsEmailConfirmation: true }` and SHALL NOT set
`CURRENT_USER` in localStorage.

_For any_ `login` call where Supabase returns an error that is not "email not confirmed", the
fixed function SHALL return `{ profile: null, error: error.message }` and SHALL NOT fall through
to local profile creation.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4 (Bug 4 — Expected Behavior)**

---

Property 5: Bug Condition — Initial Load Time and Polling Overhead Are Bounded

_For any_ `loadData()` invocation in `App.tsx`, the fixed implementation SHALL execute all
independent async calls in a single `Promise.all`, so the total elapsed time is bounded by
`max(t_i)` rather than `sum(t_i)`.

_For any_ `ProfessionalDashboard` polling tick, the fixed implementation SHALL not trigger
`getProperties` or `getReels` as side effects, and the poll interval SHALL be ≥ 15 000ms.

**Validates: Requirements 5.1, 5.2, 5.3 (Bug 5 — Expected Behavior)**

---

Property 6: Preservation — Local-Only Mode Unchanged

_For any_ input where `isSupabaseConfigured` is false (isBugCondition returns false for all five
bugs), every fixed function SHALL produce the same observable result as the original function,
preserving all localStorage-only workflows for sign-up, login, property/reel creation, enquiry
sending, and dashboard data loading.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7 (Unchanged Behavior)**

---

## Fix Implementation

### Bug 1 — Duplicate Listings

**File:** `src/services/api.ts`

**Functions:** `createProperty`, `createReel`

**Specific Changes:**

1. **ID Reconciliation after Supabase insert** — After the `supabase.from('properties').insert(...).select().single()` call succeeds and `data` is non-null, read the returned `data.id` (the real Supabase UUID). Find the just-written localStorage record by matching the local timestamp ID. Replace its `id` field with `data.id`. Re-save the updated array to `STORAGE_KEYS.PROPERTIES`. Apply the same pattern in `createReel` for `STORAGE_KEYS.REELS`.

   ```typescript
   // After successful Supabase insert in createProperty:
   if (data) {
     const storedList = getLocalState<Property[]>(STORAGE_KEYS.PROPERTIES, []);
     const localIdx = storedList.findIndex(p => p.id === propId);
     if (localIdx !== -1) {
       storedList[localIdx] = { ...storedList[localIdx], id: data.id };
       setLocalState(STORAGE_KEYS.PROPERTIES, storedList);
     }
     // Update newProp reference so the returned object has the real UUID
     newProp.id = data.id;
   }
   ```

2. **No change to merge logic** — The existing `Map<id, Property>` keyed merge in `getProperties` / `getReels` will automatically collapse the records once both share the same key.

---

### Bug 2 — Leads Not Received

**File:** `src/services/api.ts`

**Function:** `sendEnquiry`

**Specific Changes:**

1. **Supabase UID resolution by email** — After resolving `recipientProfile` from localStorage, if `isSupabaseConfigured` is true, query `supabase.from('profiles').select('id').eq('email', recipientProfile.email).maybeSingle()`. If a row is returned, use that `id` as `exactRecipientId`. This gives the real Supabase UUID.

   ```typescript
   if (isSupabaseConfigured && recipientProfile?.email) {
     try {
       const { data: sbProf } = await supabase
         .from('profiles')
         .select('id')
         .eq('email', recipientProfile.email)
         .maybeSingle();
       if (sbProf?.id) exactRecipientId = sbProf.id;
     } catch (_e) {}
   }
   ```

2. **Fallback chain preserved** — The existing fallback (`local profile ID → hardcoded fallback`) remains intact for local-only mode.

3. **`recipient_email` always stored** — The `recipientEmail` field is already derived from `recipientProfile.email`; ensure it is written to both the local enquiry object and the Supabase `enquiries` row (add it to the Supabase insert payload if the column exists).

---

### Bug 3 — View Counts Not Persisted

**File:** `src/services/api.ts`

**Function:** `incrementPropertyViews`

**Specific Changes:**

1. **UUID detection helper** — Add an inline check: `const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId)`.

2. **Skip Supabase for local string IDs** — Wrap the entire Supabase update block in `if (isSupabaseConfigured && isRealUuid) { ... }`. When the ID is a local string, the block is skipped entirely and only localStorage is updated — no fake UUID is ever sent to Supabase.

3. **Pass `propertyId` directly to Supabase** — Inside the guarded block, replace `getValidUuid(propertyId)` with `propertyId` (since we have already asserted it is a real UUID). This ensures `.eq('id', propertyId)` matches the actual Supabase row.

4. **`Math.max` merge is correct as-is** — No change needed; the existing preservation logic already takes the higher of the two counts.

   Apply the identical pattern to `incrementReelViews` for completeness.

---

### Bug 4 — Auth Issues

**File:** `src/services/api.ts`

**Functions:** `signUp`, `login`

**Specific Changes:**

1. **`signUp` — email confirmation detection:**

   ```typescript
   // After supabase.auth.signUp:
   if (!error && authData?.user && !authData?.session) {
     // Email confirmation is required
     setLocalState(STORAGE_KEYS.CURRENT_USER, null); // Do NOT persist session
     return { profile: newProf, needsEmailConfirmation: true };
   }
   ```

   The `signUp` return type needs `needsEmailConfirmation?: boolean` added to its signature (or the callers can check for the absence of a session-backed user).

2. **`signUp` — upsert conflict safety:** The existing `supabase.from('profiles').upsert(...)` call is already correct semantically; ensure the upsert uses `onConflict: 'id'` to prevent row duplication when the `handle_new_user` trigger has already created the row.

   ```typescript
   await supabase.from('profiles').upsert({ ...newProf, id: getValidUuid(newProf.id) }, { onConflict: 'id' });
   ```

3. **`login` — no fallthrough on real errors:**

   ```typescript
   if (error) {
     if (error.message.toLowerCase().includes('email not confirmed')) {
       // existing fallback logic (look up profile directly)
     } else {
       // STOP — return the real error, do NOT fall through to local login
       return { profile: null as any, error: error.message };
     }
   }
   ```

4. **`login` — auto-create missing profile row:** After `data?.user` is confirmed, if the `supabase.from('profiles').select(*)` returns `null`, insert a new profile row using the authenticated user's `id` and `email` from `data.user`, then return that profile.

   ```typescript
   if (data?.user && !profile) {
     const newProfile: Profile = {
       id: data.user.id,
       email: data.user.email!,
       full_name: data.user.user_metadata?.full_name || data.user.email!.split('@')[0],
       role: 'customer',
       verified: false,
       created_at: new Date().toISOString(),
       updated_at: new Date().toISOString(),
     };
     await supabase.from('profiles').insert(newProfile).single();
     setLocalState(STORAGE_KEYS.CURRENT_USER, newProfile);
     return { profile: newProfile };
   }
   ```

5. **`AuthModal` caller** — The component that calls `api.signUp` must handle `needsEmailConfirmation: true` by showing a "Check your inbox to confirm your account" banner instead of navigating to the authenticated state.

---

### Bug 5 — Slow Loading and Polling

**File:** `src/App.tsx`

**Function:** `loadData`

**Specific Changes:**

1. **Parallel fetch with `Promise.all`:**

   ```typescript
   const loadData = async () => {
     const [user, profiles, propsList, reelsList, savedIds] = await Promise.all([
       api.getCurrentUser(),
       api.getAllUsers(),
       api.getProperties(filters),
       api.getReels(),
       api.getSavedPropertyIds(),
     ]);
     setCurrentUser(user);
     setAllProfiles(profiles);
     setProperties(propsList);
     setReels(reelsList);
     setSavedPropertyIds(savedIds);
   };
   ```

2. **Loading state in `App.tsx`:**

   ```typescript
   const [isLoading, setIsLoading] = useState(true);

   const loadData = async () => {
     setIsLoading(true);
     try {
       const [...results] = await Promise.all([...]);
       // set state
     } finally {
       setIsLoading(false);
     }
   };
   ```

   Render a skeleton/spinner in the properties grid while `isLoading` is true.

**File:** `src/components/ProfessionalDashboard.tsx`

**Specific Changes:**

3. **Polling interval — 3 000ms → 15 000ms:**

   ```typescript
   const timer = setInterval(() => { loadDashboardData(); }, 15000);
   ```

4. **Lightweight poll — enquiries only:**

   The `loadDashboardData` function currently calls `api.getEnquiriesForUser` which internally
   calls `api.getProperties()` and `api.getReels()` to compute ownership. To break the cascade,
   cache the user's property IDs and reel IDs in component state on mount, then pass them as
   arguments to a new lightweight variant:

   ```typescript
   // On mount (once):
   const userPropIds = await api.getProperties({ ownerId: currentUser.id })
     .then(p => p.map(x => x.id));
   const userReelIds = await api.getReels()
     .then(r => r.filter(x => x.user_id === currentUser.id).map(x => x.id));

   // Each poll tick:
   const enqs = await api.getEnquiriesForUser(currentUser.id);
   setEnquiries(enqs);
   // Properties and reels counts use the cached values from mount
   ```

   This ensures each polling tick makes at most 1 Supabase query (enquiries) instead of 3+.

5. **Loading state in dashboard:**

   Add an `isLoading` state that is `true` on mount and `false` after the first `loadDashboardData`
   completes. Render a brief spinner inside each of the three tabs while loading.

---

## Testing Strategy

### Validation Approach

Testing follows a two-phase approach: first write tests that reproduce each bug on the **unfixed**
code (exploratory / counterexample phase), then verify the fix and check preservation.

---

### Exploratory Bug Condition Checking

**Goal:** Surface counterexamples that confirm each bug before the fix is applied.

**Test Plan:**

1. **Bug 1 — Duplicate entry**: Mock `supabase.from('properties').insert` to return a different
   UUID than the local ID. Call `createProperty`, then call `getProperties`. Assert that the
   returned array contains exactly one item with the given title. **Will fail on unfixed code.**

2. **Bug 2 — Missing lead**: Seed a property with `owner_id = 'user-broker-1'`. Seed a profile
   with `id = 'real-uuid-xxxx'` (Supabase user). Call `sendEnquiry`. Then call
   `getEnquiriesForUser('real-uuid-xxxx')`. Assert the returned array has length > 0.
   **Will fail on unfixed code.**

3. **Bug 3 — Lost view count**: Call `incrementPropertyViews('prop-seed-1')`. Assert that
   `getProperties()` returns the seed property with `views_count > 142`. **Will pass locally but
   fail for the Supabase leg** (Supabase update returns 0 rows affected).

4. **Bug 4 — Ghost session**: Mock `supabase.auth.signUp` to return
   `{ data: { user: mockUser, session: null }, error: null }` (email-confirmation scenario).
   Call `signUp`. Assert that `localStorage.getItem(STORAGE_KEYS.CURRENT_USER)` is `null` and
   the return value contains `needsEmailConfirmation: true`. **Will fail on unfixed code.**

5. **Bug 5 — Sequential load**: Spy on all five `api.*` calls. Call `loadData()`. Assert that
   all five calls were initiated within the same event-loop tick (i.e., before any of them
   resolved). **Will fail on unfixed code** (sequential awaits start them one-at-a-time).

**Expected Counterexamples:**
- `getProperties()` returns arrays of length 2 for a single created property (Bug 1).
- `getEnquiriesForUser(supabaseUid)` returns `[]` even after an enquiry was sent (Bug 2).
- Supabase `update` is called with a fake UUID that matches 0 rows (Bug 3).
- `localStorage.CURRENT_USER` is set even when `session` is null (Bug 4).
- Fifth `api.*` call starts only after the fourth resolves (Bug 5).

---

### Fix Checking

**Goal:** Verify that for all inputs where each bug condition holds, the fixed functions produce
the correct behaviour.

**Pseudocode:**
```
FOR ALL ctx WHERE isBugCondition_Bug1(ctx) DO
  result := getProperties_fixed(ctx)
  ASSERT count(result, title = ctx.title) = 1
END FOR

FOR ALL enq WHERE isBugCondition_Bug2(enq, viewerProfile) DO
  result := getEnquiriesForUser_fixed(viewerProfile.id)
  ASSERT enq IN result
END FOR

FOR ALL id WHERE isBugCondition_Bug3(id) DO
  countBefore := getProperty_fixed(id).views_count
  incrementPropertyViews_fixed(id)
  countAfter  := getProperty_fixed(id).views_count
  ASSERT countAfter = countBefore + 1
END FOR

FOR ALL authData WHERE isBugCondition_Bug4_SignUp(authData, null) DO
  result := signUp_fixed(...)
  ASSERT result.needsEmailConfirmation = true
  ASSERT localStorage.CURRENT_USER = null
END FOR

FOR ALL loadDataImpl WHERE isBugCondition_Bug5_InitialLoad(loadDataImpl) DO
  ASSERT all 5 api calls initiated concurrently
END FOR
```

---

### Preservation Checking

**Goal:** Verify that for all inputs where no bug condition holds (local-only mode, non-affected
operations), the fixed functions produce results identical to the originals.

**Pseudocode:**
```
FOR ALL input WHERE NOT any isBugCondition(input) DO
  ASSERT F_original(input) = F_fixed(input)
END FOR
```

**Testing Approach:** Property-based testing is used for preservation because it generates large
volumes of randomised inputs across the full domain automatically, catching edge cases that
hand-authored unit tests would miss.

**Test Cases:**
1. **Local-mode sign-up / login**: With `isSupabaseConfigured = false`, run the full auth flow.
   Assert the returned profile and localStorage state are identical before and after the fix.
2. **Save/unsave property**: Toggle save on multiple property IDs. Assert `getSavedPropertyIds`
   returns the same result as before the fix.
3. **Filter correctness**: Generate random filter combinations. Assert `getProperties(filters)`
   returns the same subset as before the fix.
4. **Admin operations**: Run `toggleUserVerification`, `updateUserRole`, `updateReportStatus`.
   Assert the localStorage state mutations are identical.
5. **Like / save / comment on reels**: Call `toggleLikeReel`, `toggleSaveReel`, `addReelComment`.
   Assert counts and flags are unchanged.
6. **Delete operations**: Call `deleteProperty`, `deleteReel`, `deleteEnquiry`. Assert the items
   are absent from subsequent reads.

---

### Unit Tests

- `createProperty` with mocked Supabase returns exactly one item per creation in `getProperties`.
- `createReel` with mocked Supabase returns exactly one item per creation in `getReels`.
- `sendEnquiry` stores the Supabase UID (not local string ID) as `recipient_id` when Supabase
  profile lookup by email succeeds.
- `sendEnquiry` stores the local profile ID as `recipient_id` when Supabase is not configured.
- `incrementPropertyViews` with a local string ID does not call `supabase.from('properties').update`.
- `incrementPropertyViews` with a real UUID calls `supabase.from('properties').update` with the
  correct UUID.
- `signUp` with `session = null` returns `needsEmailConfirmation: true` and does not set
  localStorage.
- `login` with a non-"email not confirmed" Supabase error returns the error and does not create a
  local session.

### Property-Based Tests

- Generate random arrays of `Property` objects with mixed local and Supabase IDs. Verify that
  `getProperties` merge always produces a deduplicated result (no two items share the same
  `title + owner_id` combination after ID reconciliation).
- Generate random pairs of `(localOwnerId, supabaseUid)` for the same email. Verify
  `getEnquiriesForUser(supabaseUid)` always finds enquiries sent to `localOwnerId`.
- Generate random `propertyId` strings (mix of real UUIDs and local strings). Verify
  `incrementPropertyViews` always increases the localStorage count by exactly 1 regardless of ID
  format.
- Generate random sequences of `loadData()` calls with varying simulated latencies. Verify the
  total wall-clock time is always ≤ the slowest individual call + a fixed epsilon.

### Integration Tests

- Full creation → discovery flow: professional creates property → customer browses → property
  appears exactly once in grid.
- Full enquiry flow: customer submits enquiry on property → professional opens dashboard → lead
  appears in "Received Leads" tab with correct contact details.
- Full auth flow: new user registers (Supabase confirms email) → user is shown confirmation
  message → user confirms email → user logs in → authenticated session is established.
- Performance regression: measure `loadData()` wall-clock time before and after
  `Promise.all` refactor; assert that time with 5 equally-slow mocked calls is ≤ 1.1× the
  slowest single call.
