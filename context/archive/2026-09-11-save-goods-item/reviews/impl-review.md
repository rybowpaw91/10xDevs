<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Save Goods Item Implementation Plan

- **Plan**: context/changes/save-goods-item/plan.md
- **Scope**: Full plan (Phases 1-3, all complete)
- **Date**: 2026-09-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Nested delete button inside a Select dropdown option is likely keyboard-inaccessible

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/fit-check/GoodsFitForm.tsx:503-525
- **Detail**: A `<button>` is nested inside `SelectPrimitive.Item` (`role="option"`). Radix Select drives keyboard navigation (arrow keys, typeahead) at the item level while the listbox is open, and Tab closes/exits the popup rather than moving focus into child elements. There is no `onKeyDown` handler giving a keyboard-only user a way to reach or activate the nested delete button — nesting one interactive element inside another interactive/option role is also an ARIA anti-pattern independent of the focus question. This mirrors the shape of S-01's own accepted-risk pattern but goes one step further by putting an actionable control inside the option itself.
- **Fix A ⭐ Recommended**: Add a keyboard activation path on the focused item (e.g. `Delete`/`Backspace` while a template's `SelectPrimitive.Item` has roving focus triggers the same `deleteItemTemplate` call as the pointer button).
  - Strength: Preserves the dropdown-only UX you explicitly asked for twice this session, while closing the keyboard gap with a small, additive change.
  - Tradeoff: A keyboard shortcut inside a listbox is a slightly unusual pattern and needs a short inline comment so a future reader understands why it's there.
  - Confidence: MED — the approach is sound, but the exact Radix focus/key-event wiring needs a quick manual keyboard pass to confirm it fires only when that item is focused.
  - Blind spot: Haven't verified whether Radix's own `onKeyDown` on `SelectPrimitive.Item` already intercepts `Delete`/`Backspace` for something else (typeahead only matches printable characters, so this is unlikely but unverified).
- **Fix B**: Move delete back out of the dropdown into a small separate control (e.g. a compact list purely for delete, dropdown purely for loading).
  - Strength: Every control becomes a plain, natively-accessible `<button>` — no nested-interactive-element concern at all.
  - Tradeoff: Directly reverses the "only visible in dropdown" requirement you gave twice this session.
  - Confidence: HIGH — this is exactly the pattern S-01 already uses, so it's known-good, but it's the option you already moved away from.
  - Blind spot: None significant.
- **Decision**: FIXED (via Fix A — added `onKeyDown` on `SelectPrimitive.Item` triggering delete on `Delete`/`Backspace` while the option has roving focus)

### F2 — Phase 3 plan text is stale relative to the shipped UI (disclosed drift)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/save-goods-item/plan.md (Phase 3 "Changes Required" §3, "Desired End State", "Testing Strategy")
- **Detail**: The plan describes a "compact management list (label + dimensions, Load + Delete actions)" for Phase 3. What actually shipped — disclosed live during manual testing and recorded in `change.md`'s Notes — is a `<Select>` dropdown next to "Add item" with per-option delete, and no separate list at all. This is the same category of gap as S-01's own F1 (an in-session change disclosed in conversation but never folded back into the plan document), not hidden scope creep — Agent 1's independent drift check confirms no other file or behavior deviates from plan intent.
- **Fix**: Add a short addendum to Phase 3 (or edit the relevant paragraphs directly) noting the dropdown-based UI actually shipped, mirroring how S-01 documented its own in-session addition.
- **Decision**: FIXED (added an addendum paragraph to Phase 3's "Changes Required" §3 in plan.md)

### F3 — `stopPropagation` guards `onPointerDown`/`onClick` but not `onPointerUp`

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/fit-check/GoodsFitForm.tsx:515-521
- **Detail**: If a given Radix Select version ever commits selection on `pointerup` for some input modality (e.g. touch), a tap on the delete button could theoretically still fire `handleTemplateSelect` alongside `deleteItemTemplate`. You already manually confirmed in this session that delete works "without adding a row" on your current setup, so this is a defensive-robustness note rather than an observed bug.
- **Fix**: If it's ever seen to double-fire (especially on touch devices), add the same `stopPropagation` call to `onPointerUp`.
- **Decision**: FIXED (added `stopPropagation` on `onPointerUp` as well)

### F4 — Delete option uses raw `SelectPrimitive.Item` instead of the shared `SelectItem` wrapper

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/fit-check/GoodsFitForm.tsx:503-525 vs. `src/components/ui/select.tsx`'s `SelectItem`
- **Detail**: Every other `<Select>` option in this codebase (vehicle presets, saved vehicle profiles) uses the shared `SelectItem` wrapper, which adds the check-indicator and consistent padding. This one option drops to the raw Radix primitive to fit the nested delete button, so it looks slightly different from its siblings, and the item's derived `textValue` (used for keyboard typeahead) now includes the button's structure rather than being a clean label string.
- **Fix**: Not urgent. If keyboard typeahead ever misbehaves on this dropdown, pass an explicit `textValue` prop to `SelectPrimitive.Item`.
- **Decision**: SKIPPED (not urgent; revisit if typeahead is ever observed to misbehave)

## Additional verification

- **Automated success criteria**: `npm run lint` (clean on every file this branch touched — a pre-existing, unrelated repo-wide CRLF/autocrlf lint noise affects untouched files too and is not part of this change), `npx astro check` (0 errors), `npm run test` (31/31 passing), and `npm run build` all re-verified green against the final state of the branch.
- **Manual success criteria**: all 20 manual Progress rows across Phases 1-3 are `[x]` with commit SHAs. Phase 1's RLS check was independently verified via `psql` (all three policies confirmed `roles = {authenticated}`, contradicting one of Agent 2's raw findings — see below). Phase 2's manual checks were executed live against the local Supabase instance with real `user1`/`user2` test accounts during this session. Phase 3's manual checks were confirmed live by the user, including the mid-review UX pivot to the dropdown.
- **False-positive discarded**: one sub-agent flagged the migration's RLS policies as missing `to authenticated` (calling it a regression of S-01's own F2 fix). Re-read the actual migration file directly: all three policies (`goods_item_templates_select_own/insert_own/delete_own`) explicitly declare `to authenticated`, matching the plan and CLAUDE.md's per-role-policy rule. This was independently confirmed via `psql` during Phase 1 implementation. Discarded as incorrect — not included as a finding.
- **Security deep-dive**: confirmed `user_id: context.locals.user.id` cannot be overridden by a client-supplied `user_id` in the POST body — the zod schema has no `.passthrough()` and `user_id` is spread onto the insert object after `parsed.data`, identical to the safe pattern already verified in S-01's own review. No privilege-escalation path found.
- **Plan Adherence**: all 8 planned file-level changes across 3 phases verified MATCH by independent drift-detection sub-agent, with one disclosed, pre-known deviation (F2 above) in Phase 3's UI shape. No hidden scope creep found — no unplanned files, routes, or schema changes.
