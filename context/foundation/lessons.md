# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Benchmark compute-heavy caps against the real runtime, not just algorithmic estimates

- **Context**: `src/lib/services/packing/packer.ts:157-200` — the fit-check packing algorithm, exposed via a Cloudflare Workers API route.
- **Problem**: The 200-unit cap bounding the packing algorithm's input size was chosen from algorithmic complexity research (an estimated sub-second runtime), not a live timing benchmark against the actual deployed Cloudflare Workers isolate. A worst-case near-cap input (all-rotatable, densely-stacking) could approach tens of millions of primitive operations synchronously within one single-threaded isolate call.
- **Rule**: Before raising or removing a numeric cap bounding a CPU-bound synchronous computation on Cloudflare Workers, benchmark the worst-case input against the actual deployed Workers runtime; don't rely on algorithmic estimates alone.
- **Applies to**: Any Workers API route running unbounded or compute-heavy synchronous logic behind a numeric safety cap.

## Create the change branch as the very first step of `/10x-implement`, before any edit

- **Context**: `testing-fit-check-correctness` change — CLAUDE.md's git workflow requires each change to be implemented on its own branch (named after the change-id), created when `/10x-implement` starts, merged back to `master` only after the change is done (and reviewed, if `/10x-impl-review` runs).
- **Problem**: All phase commits and the epilogue commit for this change landed directly on `master` instead of on a `testing-fit-check-correctness` branch, because the branch was never created at the start of `/10x-implement`. Caught only during `/10x-impl-review`'s wrap-up, after 4 commits already existed — required retroactive branch surgery (create branch at HEAD, reset `master` back, fast-forward merge) to fix, which only worked cleanly because nothing had been pushed to `origin` yet.
- **Rule**: Before making the first edit of `/10x-implement`, create and check out the change's branch (`git checkout -b <change-id>`) if it doesn't already exist. Do this even when it feels like "just committing straight to master would be fine" for a solo project — the workflow only holds together if it's followed the same way every time.
- **Applies to**: The first phase of every `/10x-implement` invocation, for every change.
