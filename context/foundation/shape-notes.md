---
project: "LoadFit"
context_type: greenfield
created: 2026-09-04
updated: 2026-09-04
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "workflow friction — manual/spreadsheet load planning is a slow, clunky step in otherwise routine trip prep"
    - topic: "insight"
      decision: "no one has built an accessible load-planning tool for small/mid operators — existing tools target enterprise fleets (WMS/ERP)"
    - topic: "primary persona scope"
      decision: "one person planning a single run (dispatcher / warehouse worker / small owner-operator), one vehicle, one load, one trip at a time"
    - topic: "access model"
      decision: "login required (mechanism TBD downstream); flat role model, no role separation"
    - topic: "MVP scope cut"
      decision: "dropped visual (2D/3D) load-plan rendering and weight/max-load constraint from v1; kept volume-based fit check + text packing order. Both deferred to v2."
  frs_drafted: 8
  quality_check_status: accepted
---

# LoadFit — Shape Notes

Seed idea source: `ideas_notes.md` (Polish working notes, course input for PRD generation).

## Vision & Problem Statement

Dispatchers, warehouse staff, and small transport-company owners planning a single vehicle's load currently decide by eye or in a spreadsheet how much cargo fits and how to arrange it. This manual step is workflow friction in otherwise routine trip prep, and it produces underused cargo space, avoidable extra runs, and load-planning errors — goods that don't physically fit, or that exceed the vehicle's weight limit.

Purpose-built load-optimization tooling exists, but it lives inside enterprise WMS/ERP suites built for large fleets. No one has built an accessible, standalone tool for small and mid-size operators who plan loads case-by-case, one run at a time.

## User & Persona

**Primary persona:** A single person planning one run — a dispatcher, warehouse worker, or small transport-company owner-operator. They plan one vehicle, one load, one trip at a time. They reach for this tool right before a run, when they need to know whether today's goods fit on the vehicle and how to arrange them.

## Access Control

Login required (email/password, OAuth, or passwordless — specific mechanism is a downstream tech-stack decision, not a product decision). Flat user model: every logged-in user sees the same thing and has the same capabilities. No admin/member/guest role split for the MVP.

## Success Criteria

### Primary
- A user can enter a list of goods (dimensions + quantity) and a vehicle's cargo volume, and the app correctly reports whether everything fits, with a recommended text-based packing order.
- If the goods don't fit, the app reports how many trips/vehicles would be needed.

### Secondary
- User can save and reuse a goods list across sessions.

### Guardrails
- The packing-order output must never claim a fit that physically doesn't work (correctness of the fit-check is non-negotiable — a false "it fits" is worse than no answer).

**MVP scope note:** visual (2D/3D) load-plan rendering and weight/max-load constraint checking were scoped out of v1 after a timeline-cost check (bundling both with the packing algorithm exceeded a 3-week after-hours budget). Both are explicit v2 candidates — see `## Non-Goals`.

## User Stories

### US-01: User checks whether a goods list fits on a vehicle in a single trip

- **Given** a logged-in user with a list of goods (dimensions, quantity, rotation and stackable flags per item) and a selected vehicle's cargo dimensions
- **When** they submit the goods list and vehicle for calculation
- **Then** they see whether everything fits within the vehicle's volume, a recommended text-based packing order, and the volume utilization percentage

#### Acceptance Criteria
- A "fits" result must correspond to an actually valid packing arrangement respecting each item's rotation and stackable constraints — no false positives
- If it doesn't fit, the number of additional trips/vehicles needed is shown instead of a bare "doesn't fit"
- Utilization % is computed only over volume actually used by placed items

## Functional Requirements

### Goods & vehicle input
- FR-001: User can enter a list of goods, each with length/width/height, quantity, whether it can be rotated, and whether other items can be stacked on it. Priority: must-have
  > Socrates: No counter-argument raised; stands as written.
- FR-002: User can enter or select a vehicle's cargo space dimensions (length/width/height). Priority: must-have
  > Socrates: Counter-argument considered: "ad-hoc entry is repetitive if the same vehicle is reused." Resolution: kept as must-have; added FR-008 for vehicle-profile save/reuse rather than folding persistence into this FR.
- FR-007: User can save a goods list and reuse it in a later session. Priority: nice-to-have
  > Socrates: No counter-argument raised; stands as written.
- FR-008: User can save a vehicle profile and reuse it in a later session. Priority: nice-to-have
  > Socrates: Added in response to FR-002's Socrates round — mirrors FR-007's pattern, applied to vehicles.

### Packing & fit calculation
- FR-003: System calculates whether the full goods list fits within the vehicle's cargo volume, respecting each item's rotation and stacking constraints. Priority: must-have
  > Socrates: Counter-argument considered: "a heuristic solver can also produce false negatives, not just false positives." Resolution: accepted as a known heuristic limitation — the guardrail protects against false positives (claiming a fit that doesn't work); false negatives are a documented trade-off of a heuristic vs. an exact solver, not a defect requiring a fix.
- FR-004: System outputs a recommended packing order as a lightweight grid/diagram plus text (not full 2D/3D rendering) for the goods that fit. Priority: must-have
  > Socrates: Counter-argument considered: "text alone is hard to trust or execute without any visual reference." Resolution: revised — output includes a simple grid/ASCII-style diagram alongside the text order, short of the full 2D/3D visualization already cut from MVP scope in Phase 3.
- FR-005: System shows the volume utilization percentage of the loaded vehicle, explicitly labeled as volume-only (weight utilization is a v2 addition). Priority: must-have
  > Socrates: Counter-argument considered: "volume-only utilization can mislead about weight." Resolution: kept, with an explicit "volume-only" label added to the output so the number isn't mistaken for a weight-inclusive metric.
- FR-006: If the goods don't fit in one vehicle, system reports the exact number of additional trips/vehicles needed. Priority: nice-to-have
  > Socrates: Counter-argument considered: "computing an exact trip count is itself a non-trivial repeated bin-packing problem — a bare 'doesn't fit' might be enough for v1." Resolution: demoted to nice-to-have; the must-have baseline is simply reporting that the goods don't fit in one trip (already covered by FR-003's fit determination), with the precise count as a stretch/nice-to-have.

## Non-Functional Requirements

- A user sees the calculated fit/packing result within a few seconds for a reasonably-sized goods list, not minutes.

## Business Logic

Given a set of goods with size and stacking constraints and a vehicle's cargo volume, the app decides whether everything fits and, if so, in what order to load it to maximize the chance of a valid, space-efficient arrangement.

The rule consumes user-facing inputs: a list of goods (each with dimensions, quantity, whether it can be rotated, and whether other items can stack on it) and a vehicle's cargo space dimensions. Its output is a fit/no-fit determination, a recommended loading order (as text plus a lightweight grid diagram), and a volume-utilization percentage.

The user encounters this rule as the core result of the primary flow (US-01): after entering goods and a vehicle, they submit once and receive the calculated answer — not a manual trial-and-error process.

## Non-Goals

- **No 2D/3D visual load rendering.** The packing order is communicated as text plus a lightweight grid diagram (FR-004), not a full visual/3D renderer. Cut during the Phase 3 timeline-cost check; explicit v2 candidate.
- **No weight/max-load (udźwig) constraint checking.** v1 calculates fit by volume only. Cut during the Phase 3 timeline-cost check alongside visualization; explicit v2 candidate.
- **No multi-vehicle fleet assignment or managing multiple simultaneous loads.** The locked persona (Phase 1) is one person planning one run on one vehicle at a time — assigning goods across a fleet of vehicles is out of scope for this MVP.

## Open Questions

_(none — quality cross-check passed with no gaps)_
