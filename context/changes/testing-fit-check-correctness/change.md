---
change_id: testing-fit-check-correctness
title: Harden fit-check correctness guarantees
status: implemented
created: 2026-09-13
updated: 2026-09-14
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Twardnienie gwarancji poprawności fit-check".
Risks covered: #1 (refaktor heurystyki pakowania łamie regułę wagową FR-010 mimo przechodzących testów), #2 (fit-check zwraca fałszywe "fits" mimo przekroczenia udźwigu lub naruszenia rotacji/stackowania).
Test types planned: property-based, unit (niezmiennik łączony).
Risk response intent:
- #1: prove refaktor heurystyki zachowuje niezmiennik FR-010 (nigdy cięższy na lżejszym) niezależnie od zmiany kolejności; unikać brutalnego snapshotu dokładnej kolejności zamiast reguły.
- #2: prove że żaden wynik "fits" nie pojawia się przy naruszeniu rotacji/stackowania lub przekroczeniu max. udźwigu, nawet dla wejść granicznych; unikać asercji przepisanej z bieżącego wyjścia packera.
