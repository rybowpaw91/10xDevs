---
bootstrapped_at: 2026-09-04T21:05:02Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: loadfit
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: loadfit
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

LoadFit is a solo, after-hours, 3-week-budget web app requiring login and
session-spanning persistence (saved goods lists and vehicle profiles), with a
non-negotiable correctness guardrail on the packing algorithm's fit-check.
10x-astro-starter is the recommended default for `(web, js)`, clears all four
agent-friendly gates, and ships auth, PostgreSQL, and TypeScript-first
contracts (Zod schemas at the boundaries) out of the box — directly covering
the login requirement, the save/reuse features (FR-007, FR-008), and the
type-safety that reduces risk around the guardrail's correctness bar. Its
bootstrapper confidence is first-class: expect mostly-smooth scaffolding with
occasional manual steps. Deployment stays on the starter's own default,
Cloudflare Pages/Workers; CI runs on GitHub Actions with auto-deploy on merge
to main. No payments, realtime, AI, or background-job features are in scope
per the PRD.

## Pre-scaffold verification

| Signal             | Value                              | Severity | Notes                              |
| ------------------- | ---------------------------------- | -------- | ---------------------------------- |
| npm package        | not run                            | n/a      | `cmd_template` starts with `git clone`; no npm-distributed CLI to check per `pre-scaffold-verification.md` |
| GitHub repo        | not run                            | n/a      | `gh` CLI not installed and `curl` in this shell has a broken CA bundle (`error setting certificate verify locations`); network check unavailable — WARN-AND-CONTINUE |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 19 top-level entries (`.env.example`, `.github`, `.gitignore`, `.husky`, `.nvmrc`, `.prettierrc.json`, `.vscode`, `CLAUDE.md`→sidelined, `README.md`, `astro.config.mjs`, `components.json`, `eslint.config.js`, `node_modules`, `package-lock.json`, `package.json`, `public`, `src`, `supabase`, `tsconfig.json`, `wrangler.jsonc`)
**Conflicts (.scaffold siblings)**: `CLAUDE.md.scaffold` (cwd already had a `CLAUDE.md`; existing kept, scaffold copy sidelined)
**.gitignore handling**: moved silently (cwd had no pre-existing `.gitignore`)
**.bootstrap-scaffold cleanup**: deleted (cloned `.git/` was removed before move-up, per the git-clone strategy, so upstream history was not carried into this repo)

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 1 CRITICAL, 14 HIGH, 7 MODERATE, 3 LOW (25 total across 895 resolved dependencies)
**Direct vs transitive**: 0/1/2/0 direct of total 1/14/7/3 (CRITICAL/HIGH/MODERATE/LOW) — the two direct findings are `astro` (HIGH) and `supabase` + `wrangler` (both MODERATE)

#### CRITICAL findings

- **tar** `<=7.5.20` (transitive) — fix available. Multiple advisories rolled into this range; the critical one is [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) "node-tar: Decompression/parse DoS via unlimited input". Also carries HIGH-tier [GHSA-8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w) and [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) (both DoS via crafted archives).

#### HIGH findings

- **astro** `<=7.0.9` (**direct**) — fix available. Highest-severity advisory: [GHSA-8hv8-536x-4wqp](https://github.com/advisories/GHSA-8hv8-536x-4wqp) "Reflected XSS via unescaped slot name" (range `<6.3.3`); also [GHSA-2pvr-wf23-7pc7](https://github.com/advisories/GHSA-2pvr-wf23-7pc7) "Host header SSRF in prerendered error page fetch" (range `<6.4.6`), plus several MODERATE/LOW XSS advisories in the same range.
- **brace-expansion** `<=1.1.17 || 3.0.0-5.0.8` (transitive) — fix available. DoS via exponential-time `{}` expansion: [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg), [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895).
- **browserslist** `<=4.28.6` (transitive) — fix available. [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) unbounded memory growth; [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) crash/prototype-write via untrusted stats file.
- **devalue** `5.6.3-5.8.0` (transitive) — fix available. [GHSA-77vg-94rm-hx3p](https://github.com/advisories/GHSA-77vg-94rm-hx3p) DoS via sparse array deserialization.
- **fast-uri** `3.0.0-3.1.5` (transitive) — fix available. Multiple host-confusion / SSRF advisories, e.g. [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) "server-side request forgery via malformed IPv6 normalization".
- **js-yaml** `4.0.0-4.3.0` (transitive) — fix available. [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) quadratic CPU consumption in `!!omap` resolution.
- **miniflare** `<=0.0.0-fff677e35 || 3.20250204.0-5.20260801.0-alpha` (transitive) — fix available; advisory metadata not resolved by the tool for this range.
- **nanoid** `<=3.3.17` (transitive) — fix available. [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) custom generators can loop indefinitely when size is zero.
- **postcss** `<=8.5.22` (transitive) — fix available. [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) path traversal via source-map auto-loading, arbitrary `.map` file disclosure.
- **sharp** `<0.35.0` (transitive) — fix available. [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) inherited libvips CVEs (CVE-2026-33327/33328/35590/35591).
- **svgo** `4.0.0-4.0.1` (transitive) — fix available. [GHSA-2p49-hgcm-8545](https://github.com/advisories/GHSA-2p49-hgcm-8545) `removeScripts` plugin leaves some executable scripts intact.
- **undici** `7.0.0-7.28.0` (transitive) — fix available. Several advisories; highest-signal is [GHSA-vmh5-mc38-953g](https://github.com/advisories/GHSA-vmh5-mc38-953g) "TLS certificate validation bypass via dropped requestTls in SOCKS5 ProxyAgent" and [GHSA-hm92-r4w5-c3mj](https://github.com/advisories/GHSA-hm92-r4w5-c3mj) "cross-origin request routing via SOCKS5 proxy pool reuse".
- **vite** `7.0.0-7.3.3` (transitive) — fix available. [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) `server.fs.deny` bypass on Windows alternate paths.
- **ws** `8.0.0-8.20.1` (transitive) — fix available. [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) memory exhaustion DoS from tiny fragments/data chunks.

#### MODERATE findings

- **@astrojs/language-server** `2.14.0-2.16.10` (transitive) — fix available.
- **@cloudflare/vite-plugin** `<=0.0.0-fff677e35 \|\| 0.0.7-1.41.0` (transitive) — fix available.
- **supabase** `1.1.6-2.98.2` (**direct**) — fix available.
- **volar-service-yaml** `<=0.0.70` (transitive) — fix available.
- **wrangler** `<=0.0.0-kickoff-demo \|\| 3.108.0-4.101.0` (**direct**) — fix available.
- **yaml** `2.0.0-2.8.2` (transitive) — fix available.
- **yaml-language-server** (transitive) — fix available.

#### LOW / INFO findings

- **@babel/core** `<=7.29.0` (transitive) — fix available.
- **esbuild** `0.27.3-0.28.0` (transitive) — fix available.
- **postcss-selector-parser** `7.1.0-7.1.2` (transitive) — fix available.

## Hints recorded but not acted on

| Hint                       | Value                              |
| --------------------------- | ----------------------------------- |
| bootstrapper_confidence    | first-class                        |
| quality_override           | false                               |
| path_taken                 | standard                           |
| self_check_answers         | null                                |
| team_size                  | solo                                |
| deployment_target          | cloudflare-pages                   |
| ci_provider                | github-actions                     |
| ci_default_flow            | auto-deploy-on-merge               |
| has_auth                   | true                                |
| has_payments                | false                               |
| has_realtime                | false                               |
| has_ai                      | false                               |
| has_background_jobs         | false                               |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review `CLAUDE.md.scaffold` against your existing `CLAUDE.md` and decide which parts of the starter's guidance to fold in.
- Address audit findings per your project's risk tolerance — all 25 have a fix available (`npm audit fix` / targeted upgrades); the CRITICAL finding (`tar`, transitive via the toolchain) and the direct HIGH finding (`astro`) are the highest-value ones to look at first.
