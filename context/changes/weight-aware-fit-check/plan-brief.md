# Weight-Aware Fit Check — Plan Brief

> Full plan: `context/changes/weight-aware-fit-check/plan.md`

## What & Why

Roadmap slice S-01 of milestone M-3 (Weight-aware loading): extend the core fit-check (M-1) so weight is a first-class feasibility constraint alongside volume — a "fits" result requires the load to also stay within the vehicle's max payload, the packing order never stacks a heavier item above a lighter one, and the user sees a weight-utilization percentage next to the existing volume one. Covers FR-001/FR-002 (amended) and FR-009/FR-010/FR-011.

## Starting Point

The packing algorithm (`packer.ts`/`support.ts`) and all its types/schemas are purely geometric today — zero weight awareness, confirmed by direct read. The feature is entirely stateless (no persistence), so this is a pure extension of already-shipped, already-tested business logic and UI, not new infrastructure.

## Desired End State

Every goods row gets a weight field, the vehicle section gets a max-payload field (prefillable from a preset, same as dimensions), and submitting returns a fit/no-fit result that's weight-aware: three distinguishable no-fit reasons (payload exceeded / weight-stacking blocked / volume doesn't fit), and on success, a weight-utilization percentage alongside the volume one.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Saved profiles/templates scope | Do NOT add weight/payload to them in this change | Neither FR-007 nor FR-008 declares it; keeps this change focused, deferred as a Parked follow-up | Plan (user-confirmed) |
| Vehicle presets | Add illustrative max-payload values to all 4 | Keeps "select and go" working for presets, same illustrative spirit as their existing dimensions | Plan (user-confirmed) |
| Packing heuristic | Keep volume-based unit ordering; enforce weight only as a placement-time filter | Minimal, targeted change to a working, tested algorithm — no new sort key | Plan (user-confirmed) |
| No-fit reason granularity | Three distinct reasons: payload-exceeded, weight-stacking-blocked, volume-doesn't-fit | Matches the existing oversized-item precedent and the PRD's own correctness-over-vagueness guardrail | Plan (user-confirmed) |
| Testing rigor | Add property tests for both new invariants, not just unit tests | Property testing already caught this exact class of subtle bug for the volume guarantee | Plan (user-confirmed) |
| Priority if scope tight | Nothing negotiable — FR-009/010/011 ship together | All three are must-have in the PRD; no invented scope-cutting | Plan (user-confirmed) |
| Manual test rigor | Include a heavier-item-entered-first adversarial scenario | Proves the rule works, not that it coincidentally passed due to input order | Plan (user-confirmed) |
| Schema sharing | New `.extend()`-ed schema for fit-check's vehicle only; `vehicleDimensionsSchema` itself untouched | Adding `maxPayload` directly to the shared schema would silently force vehicle-profile saves to require it too | Plan |

## Scope

**In scope:**
- Weight on every goods item, max payload on the vehicle (types, schema, UI)
- Hard weight cap on feasibility (FR-009)
- Heavier-below-lighter packing rule (FR-010)
- Weight-utilization percentage (FR-011)
- Illustrative max-payload values on the 4 hardcoded vehicle presets
- Unit + property test coverage for both new invariants

**Out of scope:**
- Weight/payload fields on saved goods-item templates or vehicle profiles (M-2 features)
- Any change to `src/pages/api/fit-check.ts`, auth, or persistence
- Changing the packing algorithm's unit-ordering heuristic
- Raising or removing `TOTAL_UNIT_CAP`
- A numeric breakdown of how far over payload a load is

## Architecture / Approach

Two-phase, bottom-up: business logic (types → schema → algorithm → tests) fully verified via `npm run test` before any UI depends on it, then UI wiring. The trickiest piece is reusing `isFullySupported` with a sentinel weight (`-Infinity`) to diagnostically distinguish "blocked by weight rule" from "doesn't fit geometrically" without a second code path.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Model & Packing Algorithm | Weight/payload types & schema, weight cap, weight-aware support check, 3-way reason differentiation, weight-utilization calc, unit + property tests | Getting the schema-extension right so vehicle-profile validation isn't accidentally broken; getting the weight-vs-volume failure classification correct |
| 2. UI Integration | Weight input per row, max-payload input on vehicle section, preset payload values, weight-utilization display | Preset/profile prefill interaction (payload from preset, left alone for saved profiles) |

**Prerequisites:** None — builds entirely on the already-shipped, stateless M-1 fit-check feature.
**Estimated effort:** ~2 focused sessions, one per phase — Phase 1 is algorithmically the denser of the two.

## Open Risks & Assumptions

- Illustrative preset payload values (Phase 2, item 1) are approximate, not sourced from real vehicle specs — same caveat that already applies to the existing preset dimensions.
- The diagnostic re-check for weight-stacking-blocked classification (Critical Implementation Details in the full plan) adds a second geometric pass on placement failure — negligible cost given the existing `TOTAL_UNIT_CAP`, but worth knowing it exists if profiling ever becomes relevant.

## Success Criteria (Summary)

- A load whose total weight exceeds the vehicle's max payload is correctly rejected even when it fits by volume, with a reason naming the payload constraint specifically
- The packing order never places a heavier item above a lighter one — verified both by a targeted manual scenario and by an independent property test
- A successful fit displays both volume- and weight-utilization percentages correctly
