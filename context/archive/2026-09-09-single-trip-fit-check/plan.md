# Single-Trip Fit Check Implementation Plan

## Overview

Implement the single-trip fit-check flow (roadmap slice S-01, the entirety of milestone M-1): a logged-in user enters a goods list (dimensions, quantity, rotatable/stackable flags per item) and a vehicle's cargo dimensions, submits once, and receives a fit/no-fit verdict, a recommended packing order (text + per-layer grid), and a volume-utilization percentage. This is a pure compute flow — no persistence, no saved goods lists or vehicle profiles (those are parked as FR-007/FR-008 for a later milestone).

## Current State Analysis

- **Auth & routing baseline is complete and reusable as-is**: `src/middleware.ts` resolves `context.locals.user` on every request and redirects unauthenticated users away from any path prefix listed in `PROTECTED_ROUTES` (currently `["/dashboard"]`). This feature only needs to add its own path prefix(es) to that array — no new auth work.
- **No domain code exists yet**: no `src/types.ts`, no `src/lib/services/`, no domain API routes, no non-auth React forms. This is the first feature to populate all of these.
- **No JSON API precedent**: the three existing API routes (`src/pages/api/auth/{signin,signup,signout}.ts`) all parse `context.request.formData()` and respond with `context.redirect(...)` — a native-form-POST-and-redirect model, not fetch/JSON. None of them set `export const prerender = false` despite CLAUDE.md prescribing it. This feature needs a genuine JSON request/response API (the UI needs a dynamic, client-side goods list with add/remove rows, which a full-page form POST can't support), so it necessarily introduces a new pattern rather than copying the auth routes' shape.
- **No zod usage exists yet**: zod is only a transitive dependency (not in `package.json`, never imported in `src/`). This feature is the first real use of the validate-with-zod convention CLAUDE.md already documents.
- **No test runner is configured**: CLAUDE.md states plainly there is no `npm test` script. The packing algorithm's correctness guardrail ("never claim a fit that doesn't work") is non-negotiable per the PRD, which makes a test runner a hard prerequisite for this feature, not an optional nice-to-have — Phase 1 adds one.
- **Only two shadcn components are installed** (`button`, and a non-shadcn `LibBadge.astro`). Input, checkbox, label, select, and card/table equivalents all need installing via `npx shadcn@latest add [name]`.
- **Existing React form patterns use plain `useState` + manual validation** (`src/components/auth/{SignInForm,SignUpForm,FormField,SubmitButton,ServerError}.tsx`), with native `<form method="POST">` submission (not fetch). No dynamic/repeatable-row list UI exists anywhere in the repo — this feature is the first.

### Key Discoveries:

- `src/middleware.ts:4` — `PROTECTED_ROUTES` array is the single hook point for protecting both the new page and its API route (the middleware runs on every request and matches by path prefix, so one array entry per new path protects both).
- `src/env.d.ts:1-5` — `Locals` type only carries `user`; no changes needed there since this feature adds no new locals.
- `src/lib/supabase.ts` — existing `createClient()` pattern is reusable if the API route needs to confirm the user server-side beyond what middleware already guarantees (not required here since the route is behind the same middleware).
- `components.json` — shadcn style is `"new-york"`, base color `"neutral"`, aliases already point at `@/components`, `@/components/ui`, `@/lib`, `@/hooks` — new component installs will land in the right place automatically.
- `eslint.config.js:15` — `tseslint.configs.strictTypeChecked` + `stylisticTypeChecked` apply to the new algorithm module; no complexity/max-lines rule constrains it, but strict type-checking does (no implicit `any`, exhaustive unions, etc.).
- Research into 3D bin-packing heuristics (Crainic/Perboli/Tadei Extreme-Point method) confirms an EP-based placer with first-fit-decreasing-by-volume ordering enforces non-overlap **by construction** — each candidate placement is validated against every already-placed unit before acceptance, which is exactly the guarantee the guardrail needs and is straightforward to unit-test.
- Existing lightweight npm packages for 3D bin packing (`binpackingjs` and forks) have thin maintenance signals and no built-in stacking-support constraints — hand-rolling the placer (a few hundred lines, fully under our own test coverage) is the safer choice for a guardrail we can't afford to get wrong.

## Desired End State

A logged-in user can navigate to the fit-check page, add one or more goods line items (length/width/height/quantity/rotatable/stackable), enter a vehicle's cargo dimensions (manually or via a preset dropdown), and submit. Within a few seconds they see: a clear fit/no-fit verdict; if it fits, a text packing order plus a per-layer 2D grid diagram and a volume-utilization percentage labeled as volume-only; if it doesn't fit, a specific reason (including which item(s), if any, are individually oversized for the vehicle). Unauthenticated visitors are redirected to sign in, matching the existing dashboard's protection pattern.

**Verification**: automated tests (unit + property-based) prove the packer never reports `fits: true` for an overlapping or unsupported arrangement; manual walkthrough in a browser confirms the full submit → result flow, the oversized-item message, the >200-unit rejection message, and the redirect for unauthenticated access.

## What We're NOT Doing

- No exact trip/vehicle count when goods don't fit (FR-006, parked) — a bare "doesn't fit" (with oversized-item detail when applicable) is the full must-have scope.
- No saving/reusing goods lists (FR-007, parked) or vehicle profiles (FR-008, parked) — no persistence, no database, no `supabase/migrations/` entries. Vehicle presets are a hardcoded, non-editable, non-persisted constant list.
- No 2D/3D visual rendering beyond the per-layer 2D grid (explicit PRD Non-Goal).
- No weight/max-load constraint checking — fit is volume-only, explicitly labeled as such (explicit PRD Non-Goal).
- No multi-vehicle fleet assignment or multi-load management (explicit PRD Non-Goal).
- No exact/optimal bin-packing solver — this is a heuristic; false negatives (reporting "doesn't fit" when a cleverer arrangement exists) are an accepted trade-off per the PRD's own Socrates resolution on FR-003. Only false positives are disallowed.
- No arbitrary/tilted rotations — only axis-aligned orientations are considered (see Critical Implementation Details).
- No spatial-index/performance work beyond the 200-unit cap — scaling past that is out of scope for this slice.

## Implementation Approach

Build bottom-up: test infrastructure and domain types first (nothing else can be verified without them), then the packing algorithm as a pure, framework-free TypeScript module with its own test suite, then the API route that wraps it behind validation and auth, then the UI that drives it. Each phase is independently verifiable before the next begins, and the algorithm (the highest-risk, correctness-critical piece) is fully tested in isolation before any UI exists to obscure its behavior.

## Critical Implementation Details

### Rotation semantics

The PRD's `rotatable` flag (FR-001) doesn't specify rotation granularity. To keep the guardrail unambiguous: when `rotatable` is `true`, the placer may try all 6 axis-aligned orientations (every permutation of assigning the item's length/width/height to the three spatial axes) when searching for a valid placement; when `false`, only the single orientation exactly as entered (length along X, width along Y, height along Z) is tried. The `stackable` flag is a per-item attribute independent of orientation — whichever face ends up on top after placement is treated as the stackable (or not) surface. This is the standard simplification used in the Extreme-Point heuristic literature and keeps the correctness guardrail's contract precise for testing.

### Support-area invariant

An item may be placed at height `z > 0` only if 100% of its base footprint is covered by the top face(s) of already-placed stackable items sitting exactly at that `z`, or `z = 0` (the vehicle floor, always valid). Coverage is computed as the sum of rectangle-intersection areas between the candidate base and every supporting item's top face at that height; the sum must equal the candidate's base area exactly (no partial-support placements). This must be checked in the same pass as the overlap check, before a placement is accepted — a placement that passes overlap-checking but fails support-checking must be rejected, not accepted with a "wobbly" flag.

### Total-unit cap is a cross-field invariant

The 200-unit cap applies to the **sum of `quantity` across all goods items**, not any single field — it must be enforced via a `.refine()` (or equivalent) on the whole parsed request object in the zod schema, not as a per-item `max()`. A request with 50 line items of quantity 5 each (250 total) must be rejected even though no individual field looks out of range.

## Phase 1: Test Infrastructure, Domain Types & Vehicle Presets

### Overview

Stand up the ability to test the packing algorithm before it exists, and define the shared data contracts every later phase builds on.

### Changes Required:

#### 1. Test runner

**File**: `package.json`, `vitest.config.ts` (new)

**Intent**: Add a test runner capable of running both hand-crafted unit tests and randomized property-based tests, since none exists in this repo yet — a hard prerequisite for verifying the correctness guardrail.

**Contract**: Add `vitest` and `fast-check` as devDependencies. Add an `npm run test` script (`vitest run`) and keep it green with zero test files present at this phase (`--passWithNoTests` or equivalent). `vitest.config.ts` resolves the `@/*` path alias to `./src` (matching `tsconfig.json`) so test files can import via the same alias as application code — no Astro-specific test integration is needed since only plain TypeScript modules are under test in this feature, not `.astro` components.

#### 2. CI wiring

**File**: `.github/workflows/ci.yml`

**Intent**: Run the new test suite in CI so the non-negotiable correctness guardrail is enforced on every push/PR, not just locally.

**Contract**: Add an `npm run test` step after the existing lint step and before the build step, matching the existing job's step style.

#### 3. Domain types

**File**: `src/types.ts` (new)

**Intent**: Define the shared request/response DTOs for the fit-check feature so the API route, algorithm, and UI all speak the same shapes.

**Contract**: Export `GoodsItemInput` (id, length, width, height, quantity, rotatable, stackable — all dimensions in centimeters), `VehicleDimensionsInput` (length, width, height), `FitCheckRequest` (items, vehicle), `PlacedUnit` (source item id, unit index, position `{x,y,z}`, placed size `{length,width,height}` post-rotation), `LayerGrid` (z-level plus a 2D cell array referencing placed unit ids), and `FitCheckResult` (fits: boolean, reason for a no-fit including which item id(s) are individually oversized when applicable, packing order as an ordered text description, `layers: LayerGrid[]`, `utilizationPercent: number`).

#### 4. Vehicle presets

**File**: `src/lib/constants/vehicle-presets.ts` (new)

**Intent**: Provide a small, hardcoded set of common cargo-vehicle dimensions so users with a known vehicle type can skip manual entry, per FR-002's "enter or select" wording.

**Contract**: Export `VEHICLE_PRESETS: { id: string; label: string; length: number; width: number; height: number }[]` with 4-5 common types (e.g. small panel van, long-wheelbase high-roof van, 3.5t box truck, 7.5t truck), dimensions in centimeters. Non-persisted, non-editable — a plain constant module.

### Success Criteria:

#### Automated Verification:

- `npm install` completes and adds `vitest`/`fast-check` to `package.json`
- `npm run test` runs successfully with zero test files present
- `npm run lint` passes
- `npx astro check` (or `npx tsc --noEmit`) passes with the new `src/types.ts` in place

#### Manual Verification:

- None required for this phase — pure scaffolding, fully covered by automated checks.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Packing Algorithm Core (Extreme-Point Heuristic)

### Overview

Implement the fit-check computation as a pure, framework-free TypeScript module, fully covered by unit and property-based tests before any API or UI code touches it.

### Changes Required:

#### 1. Geometry helpers

**File**: `src/lib/services/packing/geometry.ts` (new)

**Intent**: Provide the low-level box/vector math the placer needs — rotation enumeration and overlap testing — as small, independently testable functions.

**Contract**: Export a function producing the eligible orientation set for an item given its `rotatable` flag (1 orientation if `false`, up to 6 distinct axis-aligned permutations if `true`, deduplicated when dimensions are equal), and a pairwise AABB-overlap test between two placed boxes.

#### 2. Support-area check

**File**: `src/lib/services/packing/support.ts` (new)

**Intent**: Implement the 100%-base-support invariant described in Critical Implementation Details as its own testable unit, since it's the piece most likely to hide a subtle bug that would violate the guardrail.

**Contract**: Given a candidate base rectangle at height `z` and the set of already-placed units, return whether the candidate's full base area is covered by stackable-tagged top faces at exactly that `z` (or `z === 0`, always valid).

#### 3. Oversized-item pre-check

**File**: `src/lib/services/packing/packer.ts` (new — see item 4 for the rest of this file)

**Intent**: Before running the placement search, detect any item whose smallest eligible orientation still exceeds the vehicle's cargo box in some dimension, so a no-fit result can name the specific offending item(s) rather than surfacing a generic failure after wasted placement work.

**Contract**: For each distinct goods item, check whether *any* of its eligible orientations (per the rotation semantics above) fits within the vehicle's dimensions on all three axes; collect the ids of items where none do.

#### 4. Extreme-Point placer

**File**: `src/lib/services/packing/packer.ts`

**Intent**: Implement the main `runFitCheck(request: FitCheckRequest): FitCheckResult` entry point: expand items by quantity into individual units, order them by descending volume (first-fit-decreasing), and place each unit at the best available Extreme Point that passes both the overlap check and the support-area check, generating new Extreme Points from each accepted placement's far corners. Compute the final `fits` boolean (true only if every unit was placed), the ordered packing-order text, the per-`z`-level `LayerGrid`s from the accepted placements, and `utilizationPercent` as (sum of placed unit volumes) / (vehicle volume) — computed only over units actually placed, per the PRD's acceptance criteria.

**Contract**: `runFitCheck` never returns `fits: true` if any pairwise overlap or unsupported placement exists among the returned units — every accepted placement must have passed both checks in `geometry.ts`/`support.ts` before being added to the result. This is the guardrail; it is verified in this phase's test suite, not assumed.

#### 5. Unit tests

**File**: `src/lib/services/packing/packer.test.ts` (new)

**Intent**: Cover the hand-picked scenarios that most directly exercise the guardrail and the PRD's acceptance criteria.

**Contract**: Test cases include: exact volumetric fit, clear no-fit by volume, a single oversized item (verifies the pre-check names it), a valid stack (100% support), an invalid stack rejected for partial support, a non-rotatable item placed only in its given orientation, and multiple identical items with mixed rotatable/stackable flags. Each assertion checks both the `fits` boolean and, where `fits: true`, that no two returned units overlap.

#### 6. Property-based tests

**File**: `src/lib/services/packing/packer.property.test.ts` (new)

**Intent**: Prove the no-false-positive guardrail across a wide input space, not just the scenarios above.

**Contract**: Using `fast-check`, generate randomized goods lists (bounded dimensions, quantities, and flags) and a randomized vehicle box; for every generated case where `runFitCheck` returns `fits: true`, assert no pairwise overlap exists among the returned placed units and every placement lies fully within the vehicle's bounds. Run with a fixed, reasonable iteration count (order of 100 runs) so the suite stays fast in CI.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes, including all unit tests and the fast-check property suite
- `npm run lint` passes
- `npx astro check` (or `npx tsc --noEmit`) passes

#### Manual Verification:

- Run the packer directly against 2-3 hand-picked realistic scenarios (e.g. via a scratch script or the Node REPL) and eyeball that the reported utilization % and packing order look physically sensible, not just that assertions pass

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Fit-Check API Route

### Overview

Expose the packer behind a validated, authenticated JSON endpoint.

### Changes Required:

#### 1. Request validation schema

**File**: `src/lib/validation/fit-check-schema.ts` (new)

**Intent**: Define the zod schema once so both the API route and the client-side form (Phase 4) validate against the same rules, establishing this repo's first real zod usage per CLAUDE.md's documented (but previously unexemplified) convention.

**Contract**: Schema validates `FitCheckRequest` shape: positive numeric dimensions for every item and the vehicle, `quantity >= 1` per item, and a whole-object `.refine()` enforcing the sum of all item quantities is `<= 200` (per Critical Implementation Details — this is a cross-field check, not a per-item `max()`).

#### 2. API route

**File**: `src/pages/api/fit-check.ts` (new)

**Intent**: Accept a JSON `FitCheckRequest`, validate it, run the packer, and return a JSON `FitCheckResult` or a structured validation error.

**Contract**: `export const prerender = false;` and `export const POST: APIRoute`. Parses `context.request.json()` (this route departs from the existing auth routes' `formData()` + redirect pattern, since the dynamic goods-list UI requires fetch/JSON, not a full-page POST). On validation failure, respond with a 400 and the zod error's field-level messages as JSON (no clamping — invalid input is rejected, not sanitized, per the earlier decision). On success, call `runFitCheck` and return its result as JSON with a 200.

#### 3. Route protection

**File**: `src/middleware.ts`

**Intent**: Ensure the new endpoint is only reachable by authenticated users, matching the existing dashboard's protection model.

**Contract**: Add `/api/fit-check` (and the Phase 4 page path) to the `PROTECTED_ROUTES` array.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx astro check` (or `npx tsc --noEmit`) passes
- `npm run build` succeeds with the new route present

#### Manual Verification:

- A valid `curl`/HTTP client POST to `/api/fit-check` (while authenticated) returns a 200 with a correctly-shaped `FitCheckResult`
- An invalid payload (e.g. negative dimension, >200 total units) returns a 400 with a clear validation message
- An unauthenticated request to `/api/fit-check` is redirected/rejected per the middleware's existing protected-route behavior

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Fit-Check Page & Results UI

### Overview

Build the user-facing page: a dynamic goods-list form, vehicle input with presets, and a results view rendering the packer's output.

### Changes Required:

#### 1. shadcn components

**File**: `src/components/ui/` (new files via CLI)

**Intent**: Install the form primitives this feature needs that aren't in the repo yet.

**Contract**: Run `npx shadcn@latest add input checkbox label select card` (or the subset actually used) so the goods-row fields, rotatable/stackable checkboxes, vehicle-preset dropdown, and result panels have consistent styling.

#### 2. Protected page

**File**: `src/pages/fit-check.astro` (new)

**Intent**: Serve the feature at a protected route, following the `signin.astro` + React-island pairing (not the fully-server-rendered `dashboard.astro` pairing), since this page needs client-side interactivity for the dynamic goods list.

**Contract**: A `.astro` page wrapped in the existing `Layout`, rendering a `<GoodsFitForm client:load />` React island. Protected via the `PROTECTED_ROUTES` entry added in Phase 3.

#### 3. Goods-list form component

**File**: `src/components/fit-check/GoodsFitForm.tsx` (new)

**Intent**: Let the user build a goods list of arbitrary length (add/remove rows) plus vehicle dimensions (manual or preset), validate client-side against the shared schema before submitting, and POST to `/api/fit-check` via `fetch`.

**Contract**: Local component state holds an array of goods-row form values (first dynamic list UI in this repo) and vehicle-input values; the preset `<select>` (from `VEHICLE_PRESETS`) pre-fills the manual dimension fields on selection without locking them (still editable after). On submit, validates with the Phase 3 zod schema client-side (surfacing the same field-level messages the API would return) before calling `fetch("/api/fit-check", { method: "POST", body: JSON.stringify(...) })`, then hands the parsed `FitCheckResult` to the results component.

#### 4. Results display component

**File**: `src/components/fit-check/FitCheckResult.tsx` (new)

**Intent**: Render the packer's output in the format the PRD and earlier decisions specify: a clear fit/no-fit verdict, the no-fit reason (including named oversized items when applicable), the text packing order, one 2D grid per layer, and the utilization percentage explicitly labeled as volume-only.

**Contract**: Renders one grid block per distinct `z` value present in `result.layers`, each showing item footprints from above for that height level, alongside the ordered text list and the labeled utilization percentage.

#### 5. Dashboard entry point

**File**: `src/pages/dashboard.astro`

**Intent**: Give the user a way to discover the new feature from the page they land on after login.

**Contract**: Add a link/card to `/fit-check` on the dashboard.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx astro check` (or `npx tsc --noEmit`) passes
- `npm run build` succeeds

#### Manual Verification:

- Adding and removing goods rows works correctly in the browser
- Selecting a vehicle preset pre-fills the dimension fields, and the fields remain editable afterward
- Submitting a goods list that fits shows the fit verdict, text packing order, per-layer grids, and volume-only-labeled utilization %
- Submitting a goods list with one oversized item shows the specific-reason no-fit message
- Submitting a goods list exceeding 200 total units shows the cap's validation message before any request is sent (or on the API's 400 response)
- Visiting `/fit-check` while signed out redirects to sign-in, matching the dashboard's existing behavior
- The dashboard shows a working link to the new page

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Geometry: orientation enumeration (rotatable vs fixed, including deduplication when two dimensions are equal), pairwise AABB overlap
- Support: full support at `z=0`, full support from a single stackable item below, full support from multiple co-planar items summing to 100%, rejection when coverage is partial
- Packer: exact fit, clear no-fit by volume, single oversized item (named in the result), valid stack, invalid stack (partial support rejected), non-rotatable item respecting its given orientation, multiple identical items with mixed flags

### Integration Tests:

- None automated for the API layer in this slice (no HTTP test harness exists yet in this repo) — covered by the manual verification steps in Phase 3 instead.

### Manual Testing Steps:

1. Sign in, navigate to `/fit-check` from the dashboard link.
2. Add several goods rows with varied dimensions/quantities/flags; submit a list that should fit; confirm the verdict, packing order, per-layer grids, and utilization % all render correctly.
3. Submit a list containing one item larger than the vehicle in every orientation; confirm the no-fit reason names that item.
4. Submit a list totaling more than 200 units; confirm the cap is enforced with a clear message.
5. Sign out and attempt to visit `/fit-check` directly; confirm the redirect to sign-in.

## Performance Considerations

The 200-total-unit cap (enforced in the Phase 3 zod schema) keeps the greedy Extreme-Point heuristic comfortably within the "few seconds" NFR on Cloudflare Workers — research indicates sub-second runtime at this scale in a JS engine, well clear of Workers' CPU-time limits. No spatial indexing or backtracking is implemented; if a future milestone needs to raise the cap significantly, the overlap/support checks would need a spatial index (grid or BVH) to stay fast, which is out of scope here.

## Migration Notes

Not applicable — this is a purely additive slice with no existing data model, no database schema changes, and no user-facing behavior being replaced. Rolling back means removing the new files, the `PROTECTED_ROUTES` entries, and the CI test step.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01, milestone M-1)
- PRD: `context/foundation/prd.md` (US-01, FR-001–FR-005)
- Existing auth route pattern (for contrast, not reuse): `src/pages/api/auth/signin.ts`
- Existing protected-page pattern: `src/pages/dashboard.astro`
- Existing middleware protection: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test Infrastructure, Domain Types & Vehicle Presets

#### Automated

- [x] 1.1 `npm install` completes and adds vitest/fast-check to package.json — 2fb51f6
- [x] 1.2 `npm run test` runs successfully with zero test files present — 2fb51f6
- [x] 1.3 `npm run lint` passes — 2fb51f6
- [x] 1.4 Type checking passes with new `src/types.ts` in place — 2fb51f6

### Phase 2: Packing Algorithm Core (Extreme-Point Heuristic)

#### Automated

- [x] 2.1 `npm run test` passes, including unit tests and the fast-check property suite — 3aebd7c
- [x] 2.2 `npm run lint` passes — 3aebd7c
- [x] 2.3 Type checking passes — 3aebd7c

#### Manual

- [x] 2.4 Hand-picked realistic scenarios produce sensible utilization % and packing order — 3aebd7c

### Phase 3: Fit-Check API Route

#### Automated

- [x] 3.1 `npm run lint` passes — 125b263
- [x] 3.2 Type checking passes — 125b263
- [x] 3.3 `npm run build` succeeds with the new route present — 125b263

#### Manual

- [x] 3.4 Valid authenticated POST to `/api/fit-check` returns a correctly-shaped 200 result — 125b263
- [x] 3.5 Invalid payload (bad dimension, >200 total units) returns a 400 with a clear message — 125b263
- [x] 3.6 Unauthenticated request is redirected/rejected per middleware behavior — 125b263

### Phase 4: Fit-Check Page & Results UI

#### Automated

- [x] 4.1 `npm run lint` passes — e360bbb
- [x] 4.2 Type checking passes — e360bbb
- [x] 4.3 `npm run build` succeeds — e360bbb

#### Manual

- [x] 4.4 Adding/removing goods rows works correctly — e360bbb
- [x] 4.5 Vehicle preset selection pre-fills editable dimension fields — e360bbb
- [x] 4.6 Fitting goods list shows verdict, text order, per-layer grids, volume-only utilization % — e360bbb
- [x] 4.7 Oversized single item shows the specific-reason no-fit message — e360bbb
- [x] 4.8 Exceeding 200 total units shows the cap's validation message — e360bbb
- [x] 4.9 Signed-out visit to `/fit-check` redirects to sign-in — e360bbb
- [x] 4.10 Dashboard link to the new page works — e360bbb
