# Save Vehicle Profile — Plan Brief

> Full plan: `context/changes/save-vehicle-profile/plan.md`

## What & Why

Roadmap slice S-01 of milestone M-2 (Save and reuse): a logged-in user saves a vehicle's cargo dimensions as a named profile and reuses it on a later fit check, instead of retyping the same vehicle every time. This is the app's first persistence-backed feature.

## Starting Point

The fit-check page already has a `<Select>` populated from hardcoded `VEHICLE_PRESETS` that prefills the vehicle fields on selection, still editable afterward (`GoodsFitForm.tsx:178-193`). No persistence exists anywhere in the app yet — `supabase/migrations/` is empty, no ORM. The JSON API + zod validation pattern is already established by the fit-check feature (`src/pages/api/fit-check.ts`).

## Desired End State

On the fit-check page, a user types a label and saves the current vehicle fields as a profile. Saved profiles show up as their own group in the existing vehicle select (selecting one prefills the fields, editable afterward, just like today's hardcoded presets) and in a small management list with a delete action per profile. Every saved row is private to its owner via RLS.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Delete capability | Included in this change | A growing list needs a way to be tidied; small addition given the table/RLS is already being built. |
| Cap on saved profiles | No limit | Low-complexity MVP; the persona (one person, one vehicle at a time) makes hundreds of profiles implausible. |
| Label uniqueness | Duplicates allowed | The database row id is the real identity; dimensions shown in the option text disambiguate, same as today's presets. |
| Editing/renaming | Out of scope | Delete + re-save covers the same need at lower scope; matches the low-complexity goal. |
| RLS policy shape | Separate SELECT/INSERT/DELETE policies, no UPDATE policy | CLAUDE.md requires granular per-operation policies; omitting UPDATE denies it by default, matching the no-edit scope for free. |
| User id source for INSERT | Always `context.locals.user.id`, never the request body | A client-supplied `user_id` would let a request claim another user's profile before RLS evaluates the insert. |

## Scope

**In scope:**
- `vehicle_profiles` table + RLS (select/insert/delete)
- `GET`/`POST /api/vehicle-profiles`, `DELETE /api/vehicle-profiles/[id]`
- Save-current-as-profile control, saved-profiles select group, delete management list — all inside the existing fit-check form

**Out of scope:**
- Editing/renaming an existing profile
- Any cap or uniqueness constraint on profiles
- The goods-list save/reuse slice (S-02) — separate change
- The weight-aware fit-check work queued for M-3

## Architecture / Approach

Bottom-up, mirroring the fit-check feature's own pattern: migration + RLS + shared types/schema first, then the API routes that enforce them, then the UI that consumes both. Local Supabase (Docker is running, CLI installed) lets the migration and RLS policy get verified — including a real two-user isolation check — before touching the deployed project.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Layer, Types & Validation Schema | `vehicle_profiles` table + RLS, `VehicleProfile` type, zod schema | First persistence feature — the RLS pattern set here is the template every later saved-entity feature follows |
| 2. Vehicle Profiles API Routes | GET/POST/DELETE endpoints, middleware protection | Getting the user-id-from-locals-not-body rule right (see plan's Critical Implementation Details) |
| 3. UI Integration | Select group, save control, delete list in `GoodsFitForm.tsx` | None significant — extends an existing, already-working UI pattern |

**Prerequisites:** None beyond the existing auth baseline (already present) and local Supabase/Docker for development verification (already confirmed available).
**Estimated effort:** ~3 focused sessions, one per phase, for a solo after-hours developer.

## Open Risks & Assumptions

- Two-user RLS isolation is verified manually against the local Supabase instance in Phase 2 — no automated integration test harness exists yet in this repo for HTTP-level checks (same gap noted in the fit-check feature's own plan).

## Success Criteria (Summary)

- A user can save, see, select (with correct prefill), and delete a vehicle profile from the fit-check page
- Saved profiles are genuinely private per user — enforced by RLS, verified with a real second test account, not just assumed from client-side filtering
- No regression to the existing hardcoded-preset or manual-entry vehicle input paths
