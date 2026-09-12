---
change_id: edit-vehicle-profile
title: Edit saved vehicle profile
status: implementing
created: 2026-09-12
updated: 2026-09-12
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

**2026-09-12 — Phase 3 scope revision.** Mid-implementation, after the original inline-edit-in-a-list design (Phase 3 as originally planned) was built and spot-checked, the user asked to rework it: saved vehicle profiles should be visible only in the preset dropdown (no separate management list), Edit and Delete actions should live inside the dropdown, and max payload should become a real editable database-backed field (previously explicitly parked out of scope). Scoped to vehicles only for this change — the same treatment for `goods_item_templates` (adding a `weight` field, dropdown-only edit/delete) is deferred to S-02 (`edit-goods-item-template`), a separate future change. See the addendum in `plan.md`'s Phase 3 section for the full design and superseded manual-verification checklist.