# V5.8 — Manual-only Protected Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans and test-driven-development. Work test-first and verify the exact branch head with complete GitHub CI before review.

**Goal:** Prevent any GitHub Action from autonomously promoting a Cloudflare Worker version when source CI finishes; only an explicit owner-selected manual production run may shift traffic.

**Architecture:** Make the existing `.github/workflows/promote-production.yml` strictly `workflow_dispatch`, require `confirm_production` and the exact HEAD commit of protected main, and reuse the existing `scripts/promotion_gate.mjs` for four check-run gates and immutable Worker ID matching. Do not introduce a second deploy mechanism or change the Worker/Access configuration.

**Tech Stack:** GitHub Actions YAML, Node 22 existing gate, Python unittest (stdlib) for workflow-policy regression, Workers Builds + Wrangler (owner configured).

**Spec:** [#50](https://github.com/Hafezalhoot/medical-meq-bank/issues/50) CI-before-Cloudflare-production, [#35](https://github.com/Hafezalhoot/medical-meq-bank/issues/35) authenticated smoke, and [#74](https://github.com/Hafezalhoot/medical-meq-bank/issues/74) My Medical Library roadmap.

## Global constraints
- The current live Worker must stay unchanged in this work item: **no merge or deploy** until the owner has confirmed Cloudflare Workers Builds' production command is `npx wrangler versions upload` (build-only) and service-token smoke credentials are installed in an authorized environment.
- Keep Cloudflare Access enabled, keep existing `wrangler.jsonc`, saved progress and all medical lecture/source data unchanged.
- Cloudflare settings and GitHub production environment/ruleset configurations cannot be inferred from repository YAML; owner verification required.
- Require an explicit manual release approval, full source SHA at current `main`, successfully uploaded matching Worker Version, and all source/Cloudflare CI checks.
- Keep source branch PR-only; this change must be integrated **before** any staged feature PR #75/#76/#78/#79/#80, after external Cloudflare build-only setting is established.

## Task 1 — Policy test RED
- Add `tests/test_manual_production_promotion.py`.
- Assert top-level workflow triggers **only** `workflow_dispatch`: no `push`, `workflow_run`, or time-based promotion; no retained one-time bypass.
- Assert manual `source_sha` has no hard-coded stale default; `confirm_production` defaults false; promotion job only runs on `main`; both steps use manual `inputs.source_sha`.
- Assert source SHA is equal to *current checked-out protected main*; no older SHA allowed merely because app version matches.
- Run repository static CI on test-only commit and inspect expected failures.

## Task 2 — Make release explicitly manual
- Edit only `.github/workflows/promote-production.yml`.
- Remove `workflow_run` trigger and old push one-time exception; keep `workflow_dispatch` with required SHA, optional Worker Version ID, confirmation checkbox, production environment protection.
- Reject non-current-main `source_sha` and retain `promotion_gate.mjs` checks for validate, Chromium, WebKit and Cloudflare Workers Build, including exact immutable build/version binding.
- Record *currently active* Worker version status before mutation for rollback evidence. Do not deploy in this branch.

## Task 3 — Document operator preflight, then verify
- Update `DEPLOYMENT.md` with a tightly scoped 1-page release runbook: Cloudflare Deploy command `versions upload` (not deploy), retain human Access, create dedicated Access Service Auth (without sharing secrets), GitHub environment protection, branch protection, inspect Worker ID/traffic, manually promote after CI, authenticated production smoke, exact version rollback.
- Run full GitHub CI on exact PR head and inspect diff; only workflow, policy test, runbook and plan may change.
- Leave PR unmerged until owner confirms settings; update #50, #74 with observed CI evidence only. Mark #35 and #50 open until live verification.

**Ruling:** Preparing this guard is an authorized branch change. Installing credentials, changing Cloudflare settings, merging into production branch, activating a Worker version or weakening Cloudflare Access is **not** authorized by this generic continuation request.
