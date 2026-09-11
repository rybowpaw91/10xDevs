---
project: "LoadFit"
version: 3
status: draft
created: 2026-09-11
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

# LoadFit — Product Requirements Document

## Vision & Problem Statement

Dispatchers, warehouse staff, and small transport-company owners planning a single vehicle's load currently decide by eye or in a spreadsheet how much cargo fits and how to arrange it. This manual step is workflow friction in otherwise routine trip prep, and it produces underused cargo space, avoidable extra runs, and load-planning errors — goods that don't physically fit, or that exceed the vehicle's weight limit.

Purpose-built load-optimization tooling exists, but it lives inside enterprise WMS/ERP suites built for large fleets. No one has built an accessible, standalone tool for small and mid-size operators who plan loads case-by-case, one run at a time.

## User & Persona

**Primary persona:** A single person planning one run — a dispatcher, warehouse worker, or small transport-company owner-operator. They plan one vehicle, one load, one trip at a time. They reach for this tool right before a run, when they need to know whether today's goods fit on the vehicle and how to arrange them.

## Success Criteria

### Primary
- A user can enter a list of goods (dimensions, weight, quantity) and a vehicle's cargo volume and weight capacity, and the app correctly reports whether everything fits — by both volume and weight — with a recommended text-based packing order.
- If the goods don't fit, the app reports how many trips/vehicles would be needed.

### Secondary
- User can save and reuse a goods item (as a reusable template — label, dimensions, rotatable, stackable) across sessions.

### Guardrails
- The packing-order output must never claim a fit that physically doesn't work (correctness of the fit-check is non-negotiable — a false "it fits" is worse than no answer).
- A "fits" result must never place a heavier item on top of a lighter one, and must never claim a fit when the total goods weight exceeds the vehicle's maximum payload.

## User Stories

### US-01: User checks whether a goods list fits on a vehicle in a single trip

- **Given** a logged-in user with a list of goods (dimensions, weight, quantity, rotation and stackable flags per item) and a selected vehicle's cargo dimensions and maximum payload
- **When** they submit the goods list and vehicle for calculation
- **Then** they see whether everything fits within the vehicle's volume and weight capacity, a recommended text-based packing order, the volume utilization percentage, and the weight utilization percentage

#### Acceptance Criteria
- A "fits" result must correspond to an actually valid packing arrangement respecting each item's rotation and stackable constraints — no false positives
- A "fits" result also requires the total goods weight not exceed the vehicle's maximum payload
- The packing order must never place a heavier item on top of a lighter one
- If it doesn't fit, the number of additional trips/vehicles needed is shown instead of a bare "doesn't fit"
- Volume utilization % is computed only over volume actually used by placed items; weight utilization % is computed over total goods weight against the vehicle's maximum payload

## Functional Requirements

### Goods & vehicle input
- FR-001: User can enter a list of goods, each with length/width/height, weight, quantity, whether it can be rotated, and whether other items can be stacked on it. Priority: must-have
  > Socrates: No counter-argument raised; stands as written. Amended 2026-09-11 to add per-item weight, required by FR-009/FR-010.
- FR-002: User can enter or select a vehicle's cargo space dimensions (length/width/height) and maximum payload (weight capacity). Priority: must-have
  > Socrates: Counter-argument considered: "ad-hoc entry is repetitive if the same vehicle is reused." Resolution: kept as must-have; added FR-008 for vehicle-profile save/reuse rather than folding persistence into this FR. Amended 2026-09-11 to add maximum payload, required by FR-009.
- FR-007: User can save a single goods item (label, dimensions, whether it can be rotated, whether other items can be stacked on it) as a reusable template and reuse it in a later session, mirroring FR-008's vehicle-profile pattern applied to one goods item at a time. Priority: nice-to-have
  > Socrates: No counter-argument raised; stands as written. Corrected 2026-09-11 — originally written and built as saving a whole goods list; the actual intent is a per-item reusable template, not a list.
- FR-008: User can save a vehicle profile and reuse it in a later session. Priority: nice-to-have
  > Socrates: Added in response to FR-002's Socrates round — mirrors FR-007's pattern, applied to vehicles.

### Packing & fit calculation
- FR-003: System calculates whether the full goods list fits within the vehicle's cargo volume, respecting each item's rotation and stacking constraints. Priority: must-have
  > Socrates: Counter-argument considered: "a heuristic solver can also produce false negatives, not just false positives." Resolution: accepted as a known heuristic limitation — the guardrail protects against false positives (claiming a fit that doesn't work); false negatives are a documented trade-off of a heuristic vs. an exact solver, not a defect requiring a fix.
- FR-004: System outputs a recommended packing order as a lightweight grid/diagram plus text (not full 2D/3D rendering) for the goods that fit. Priority: must-have
  > Socrates: Counter-argument considered: "text alone is hard to trust or execute without any visual reference." Resolution: revised — output includes a simple grid/ASCII-style diagram alongside the text order, short of the full 2D/3D visualization already cut from MVP scope.
- FR-005: System shows the volume utilization percentage of the loaded vehicle, explicitly labeled as volume-only. Priority: must-have
  > Socrates: Counter-argument considered: "volume-only utilization can mislead about weight." Resolution: kept, with an explicit "volume-only" label added to the output so the number isn't mistaken for a weight-inclusive metric. Superseded 2026-09-11: weight utilization is reported as its own separate percentage — see FR-011.
- FR-006: If the goods don't fit in one vehicle, system reports the exact number of additional trips/vehicles needed. Priority: nice-to-have
  > Socrates: Counter-argument considered: "computing an exact trip count is itself a non-trivial repeated bin-packing problem — a bare 'doesn't fit' might be enough for v1." Resolution: demoted to nice-to-have; the must-have baseline is simply reporting that the goods don't fit in one trip (already covered by FR-003's fit determination), with the precise count as a stretch/nice-to-have.
- FR-009: A "fits" result requires both the volume-based packing arrangement to succeed AND the total goods weight to not exceed the vehicle's maximum payload — weight is a hard cap on feasibility, not just an ordering concern. Priority: must-have
  > Socrates: Added 2026-09-11 in response to the user reversing the original MVP scope cut on weight/max-load checking. Counter-argument considered: "a load could exceed the weight limit while easily fitting by volume, so treating weight as feasibility-blocking (not just an ordering nudge) is necessary to satisfy 'determine loading feasibility.'" Resolution: kept as a hard cap, mirroring FR-003's volume-based fit check.
- FR-010: The recommended packing order (FR-004) enforces a weight-based stacking rule: an item may only be placed on top of another item if the item below is at least as heavy, so heavier items are never stacked above lighter ones. Priority: must-have
  > Socrates: Added 2026-09-11 alongside FR-009. Counter-argument considered: "this changes the packing heuristic itself (previously geometry/support-only), which is a larger change than a simple post-hoc weight check." Resolution: accepted as necessary — the user explicitly wants weight to affect packing order, not just a pass/fail gate; the increased algorithmic scope is deliberate, not incidental.
- FR-011: System shows the weight utilization percentage (total goods weight ÷ vehicle's maximum payload) alongside the existing volume utilization percentage (FR-005). Priority: must-have
  > Socrates: Added 2026-09-11, closing the door FR-005 explicitly left open ("weight utilization is a v2 addition"). No counter-argument raised; stands as written.

## Non-Functional Requirements

- A user sees the calculated fit/packing result within a few seconds for a reasonably-sized goods list, not minutes.

## Business Logic

Given a set of goods with size, weight, and stacking constraints and a vehicle's cargo volume and maximum payload, the app decides whether everything fits — by both volume and weight — and, if so, in what order to load it (heavier items lower) to maximize the chance of a valid, space-efficient arrangement.

The rule consumes user-facing inputs: a list of goods (each with dimensions, weight, quantity, whether it can be rotated, and whether other items can stack on it) and a vehicle's cargo space dimensions and maximum payload. Its output is a fit/no-fit determination, a recommended loading order (as text plus a lightweight grid diagram) that never stacks a heavier item above a lighter one, a volume-utilization percentage, and a weight-utilization percentage.

The user encounters this rule as the core result of the primary flow (US-01): after entering goods and a vehicle, they submit once and receive the calculated answer — not a manual trial-and-error process.

## Access Control

Login required (email/password, OAuth, or passwordless — specific mechanism is a downstream tech-stack decision, not a product decision). Flat user model: every logged-in user sees the same thing and has the same capabilities. No admin/member/guest role split for the MVP.

## Non-Goals

- **No 2D/3D visual load rendering.** The packing order is communicated as text plus a lightweight grid diagram (FR-004), not a full visual/3D renderer. Explicit v2 candidate.
- **No multi-vehicle fleet assignment or managing multiple simultaneous loads.** The locked persona is one person planning one run on one vehicle at a time — assigning goods across a fleet of vehicles is out of scope for this MVP.

## Open Questions

_(none — quality cross-check passed with no gaps; the weight/max-load scope reversal and the FR-007 unit-of-reuse correction on 2026-09-11 were fully resolved through direct user decisions, not left open)_
