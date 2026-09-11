---
change_id: save-goods-item
title: Save goods item
status: archived
created: 2026-09-11
updated: 2026-09-11
archived_at: 2026-09-11T19:22:02Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Phase 3 UX was revised during manual testing: saved goods-item templates are surfaced only in a dropdown next to "Add item" (not a separate management list). Delete is a small icon button rendered inside each dropdown option (`SelectPrimitive.Item` with a nested `<button>` that stops event propagation on `pointerdown`/`click` so it doesn't also trigger selection).
- Follow-up noted by the user (2026-09-11): the same in-dropdown delete pattern should be applied to the vehicle-profile select in `GoodsFitForm.tsx` (S-01, `save-vehicle-profile`, already shipped/archived), which currently uses a separate "saved profiles" management list with its own delete button instead. Not implemented as part of this change — out of scope for S-02 — but tracked here as a candidate follow-up change for consistency across both saved-entity types.
