---
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
---

## Why this stack

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
