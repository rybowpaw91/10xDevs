# Fit-Check Correctness Hardening — Plan Brief

> Full plan: `context/changes/testing-fit-check-correctness/plan.md`
> Research: `context/changes/testing-fit-check-correctness/research.md`

## What & Why

Harden the fit-check packing test suite against two failure scenarios named in `test-plan.md`: a future heuristic refactor silently breaking the FR-010 weight-stacking rule despite passing tests (Risk #1), and `fits: true` being reported despite a rotation, stacking, or payload violation (Risk #2). Both risks are about the *invariant surviving change*, not about anything currently broken — the packer is correct today; the tests need to prove it stays correct.

## Starting Point

The packer (`src/lib/services/packing/{packer,geometry,support}.ts`) already enforces FR-010 in one place (`support.ts:27`) independent of pack order, and already combines geometry+weight into `fits` via a single sequential gate (`tryPlace`, `packer.ts:141-180`) rather than two ANDed booleans. Existing coverage (`packer.test.ts`, `packer.property.test.ts`, `support.test.ts`, `geometry.test.ts`) is solid but has two blind spots: nothing checks that a placed orientation is actually a valid rotation of its item, and the property arbitraries are integer-only, so the `EPSILON` tie-breaking boundary is only ever hand-tested, never randomized.

## Desired End State

`packer.property.test.ts` gains a property proving rotation+stacking+weight+bounds hold together on every random `fits:true`, plus a property that directly probes the production `EPSILON` boundary. `packer.test.ts` gains three deterministic scenarios proving rotation flexibility can't be used to bypass the weight rule. `test-plan.md` §6.1 documents the pattern for future test authors.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Combined-invariant structure | One new property block, existing 3 left untouched | Directly realizes "niezmiennik łączony"; failure isolates to one property while existing coverage stays intact | Plan |
| Dedicated unit tests | Add 3 scenario-table cases | change.md names "unit (niezmiennik łączony)" as its own deliverable distinct from property-based | Plan |
| Boundary coverage | Extend arbitraries with near-EPSILON deltas | Closes a gap a prior impl-review already flagged; risk response explicitly asks for boundary inputs | Research + Plan |
| Property depth | `numRuns: 250` on risk-critical blocks only | More coverage where a confirmed past incident happened, bounded CI cost | Plan |
| Stale PRD reference | Note only (cite `prd-v3.md`), no edit to `prd.md` | Keeps this change scoped to fit-check tests; PRD hygiene is a separate follow-up | Research + Plan |

## Scope

**In scope:**
- New combined property (rotation + stacking + weight + bounds) in `packer.property.test.ts`
- New boundary-focused property targeting the production `EPSILON` tie
- `numRuns` increase on the 4 risk-critical property blocks
- 3 new deterministic unit-test scenarios in `packer.test.ts`
- `test-plan.md` §6.1 cookbook update

**Out of scope:**
- Any production code change in `packer.ts` / `support.ts` / `geometry.ts` — packer is already correct
- Fixing `context/foundation/prd.md`'s staleness (v1 vs. `prd-v3.md`)
- Deduplicating the `EPSILON` constant repeated across 3 files
- API/integration tests for `fit-check.ts` (that's Phase 3 of the test-plan rollout)

## Architecture / Approach

Everything happens inside the existing test files (`packer.property.test.ts`, `packer.test.ts`, plus a doc update to `test-plan.md`). No new files, no production code touched. Two phases: property-based work first (Phase 1), then the deterministic counterpart plus cookbook close-out (Phase 2).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Combined property-based invariant | New combined + boundary property blocks, raised `numRuns` | Boundary arbitrary must target production `EPSILON` (1e-9), not the test file's own looser `1e-6` constant |
| 2. Deterministic tests + cookbook | 3 scenario unit tests, `test-plan.md` §6.1 updated | Scenarios must be genuinely distinct from what the property already covers, not restated examples |

**Prerequisites:** None — existing test infra (Vitest + fast-check) is already in place.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- The boundary property's controlled two-unit stack scenario must be crafted so stacking is the *only* valid arrangement — if the packer finds an alternative floor placement instead, the property would trivially pass without exercising the boundary at all. Implementer should verify this manually (see Phase 1 manual criteria).
- Raising `numRuns` to 250 assumes local runs already show current CI time has headroom; if `npm run test` is already slow, the plan's own manual criterion (timing check) will surface that before it lands in CI.

## Success Criteria (Summary)

- Temporarily reintroducing the historical FR-010 bug (commenting out `support.ts:27`'s weight clause) causes the new tests to fail, proving they catch what they're meant to catch.
- `npm run test` and `npm run lint` pass with the new coverage in place.
- `test-plan.md` §6.1 no longer reads `TBD` for this pattern.
