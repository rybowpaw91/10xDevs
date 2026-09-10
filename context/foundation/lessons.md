# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Benchmark compute-heavy caps against the real runtime, not just algorithmic estimates

- **Context**: `src/lib/services/packing/packer.ts:157-200` — the fit-check packing algorithm, exposed via a Cloudflare Workers API route.
- **Problem**: The 200-unit cap bounding the packing algorithm's input size was chosen from algorithmic complexity research (an estimated sub-second runtime), not a live timing benchmark against the actual deployed Cloudflare Workers isolate. A worst-case near-cap input (all-rotatable, densely-stacking) could approach tens of millions of primitive operations synchronously within one single-threaded isolate call.
- **Rule**: Before raising or removing a numeric cap bounding a CPU-bound synchronous computation on Cloudflare Workers, benchmark the worst-case input against the actual deployed Workers runtime; don't rely on algorithmic estimates alone.
- **Applies to**: Any Workers API route running unbounded or compute-heavy synchronous logic behind a numeric safety cap.
