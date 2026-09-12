---
change_id: weight-aware-fit-check
title: Weight-aware fit check
status: impl_reviewed
created: 2026-09-12
updated: 2026-09-12
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Phase 2 scope was extended during manual testing based on user feedback (2026-09-12), beyond what Phase 1/2 originally specified:
  1. No-fit reasons now show actual numbers (total weight vs. max payload; item dimensions vs. vehicle dimensions), not just descriptive text — composed backend-side in `packer.ts` for the weight-cap/weight-stacking cases, enriched client-side (using the already-known submitted items) for the oversized-dimensions case.
  2. Whether the algorithm may reorder items for placement is now a user choice, not fixed: a `preserveOrder` boolean (default `false`, via an unchecked "Preserve entry order" checkbox) drives `packer.ts`'s `expandUnits` to either respect the exact entered order or sort heaviest-first. This replaces Phase 1's original "always sort by volume descending" default — Phase 1's own plan text describes the shape as originally implemented; the actual shipped behavior is documented in Phase 2's addendum.
- See `context/changes/weight-aware-fit-check/plan.md` Phase 2's "Addendum" subsection for the full technical detail.
