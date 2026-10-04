# GitHub Actions Incident Record and Recovery Runbook

> **Resolved 2026-10-04.** The repository is now public under personal account `Hafezalhoot`, and the complete quality matrix is green. Run `37190821886` passed `validate`, `chromium-quality`, and `webkit-quality` on the current PR head. The exact organization-side cause was not identified.
>
> The material below is retained as the incident record and fallback diagnostic procedure if the same zero-job signature ever returns.

This runbook documents the former GitHub-hosted runner provisioning failure.

## Confirmed failure signature

Current repository:

`Hafezalhoot/medical-meq-bank`

Owner during the incident:

`Hafez-Alhoot` organization

Repository ID:

`1320445840`

The failure happens **before repository code or a runner starts**:

- workflow name is empty;
- workflow path is synthetic `BuildFailed`;
- conclusion is `startup_failure`;
- zero jobs are created;
- zero artifacts are created;
- no checkout/build/npm/Playwright step starts;
- a failed synthetic run cannot be retried as failed jobs because it contains no jobs.

Representative production-quality run:

- run: `37139141492`
- workflow id: `351923769`
- conclusion: `startup_failure`
- jobs: `0`

Minimal diagnostic probe:

- commit: `705338e64d86e1755999b3e1b559786aca5b6f72`
- run: `37140311659`
- workflow content: one `ubuntu-latest` job with only shell commands (`echo`, `uname`, `python3 --version`)
- result: the same synthetic `BuildFailed/startup_failure` before any job object was created.

This minimal probe excludes the application build, Node/npm, Playwright, external Actions steps, and medical-bank source code as causes.

GitHub public status reported the **Actions** component as `operational` and `All Systems Operational` on 2026-10-03 while this repository continued producing the zero-job synthetic failure:

https://www.githubstatus.com/api/v2/summary.json

That makes a broad GitHub Actions outage unlikely and increases the likelihood of a repository/organization/account-specific execution entitlement, billing, policy, or control-plane state.

The temporary probe workflow has been removed after diagnosis.

## Historical account / organization checks

GitHub-hosted Actions usage for private repositories is charged to the **repository owner** after included usage. An account-level billing lock or Actions budget restriction can stop hosted-runner provisioning before a job starts.

At the time of the incident the repository was organization-owned. These were the relevant checks:

### 1. Billing and payment state

Open the owner organization's **Settings → Billing and licensing**.

Verify:

- the payment method is valid and has no failed authorization/payment;
- the account/organization is not locked for billing;
- GitHub Actions included minutes have not been exhausted with usage blocked;
- an Actions budget is not set to `$0` with **Stop usage when budget limit is reached** enabled;
- if a budget is used, it has remaining allowance.

GitHub Actions billing reference:

https://docs.github.com/en/billing/concepts/product-billing/github-actions

### 2. Organization Actions policy

Open **Organization Settings → Actions → General**.

Verify:

- GitHub Actions is enabled;
- GitHub-hosted runners are allowed;
- the allowed-actions policy includes the official actions used by this repository;
- no organization policy is blocking workflow execution.

The repository quality workflow uses:

- `actions/checkout@v6`
- `actions/setup-node@v6`
- `actions/upload-artifact@v6`

The minimal diagnostic probe used **no external action at all**, so an allow-list problem alone does not explain the confirmed zero-job probe unless the entire Actions execution path is disabled/restricted.

### 3. Repository Actions policy

Open **Repository Settings → Actions → General**.

Verify:

- Actions is enabled for the repository;
- workflow execution is not disabled by repository policy;
- GitHub-hosted runners are allowed by inherited organization policy.

## If billing and policies are healthy

Escalate to GitHub Support as a hosted-runner/control-plane issue.

Provide:

- repository during incident: `Hafez-Alhoot/medical-meq-bank` (same repository ID, now `Hafezalhoot/medical-meq-bank`)
- repository ID: `1320445840`
- synthetic workflow ID: `351923769`
- run `37139141492`
- minimal-probe run `37140311659`
- symptom: `path=BuildFailed`, `conclusion=startup_failure`, `jobs=0`, no runner, no logs
- note that the same workflow file previously produced real jobs on `main`
- note that a one-job shell-only probe reproduces the same pre-job failure.

If the same signature recurs, ask Support to inspect Actions execution entitlement and any stale synthetic `BuildFailed` routing or hosted-runner provisioning lock.

## What not to do

The project is now intentionally public; repository visibility is a product/release decision, not an incident-response workaround.

Do **not**:

- weaken the quality workflow;
- merge PR #19 just because source-level checks pass;
- allow Cloudflare to auto-promote an unverified commit.

## Verified recovery

Recovery is confirmed:

1. the workflow is named **Validate Medical MEQ Bank** instead of blank / `BuildFailed`;
2. job `validate` is created and passes;
3. the shared static quality gate passes;
4. `chromium-quality` passes;
5. `webkit-quality` passes;
6. generated artifacts are present.

Latest current-head evidence: run `37190821886`. PR #19 remains Draft only because `main` branch protection and Cloudflare production controls still require external configuration.

## Current deployment safety fallback

`bash build.sh` now runs the shared `scripts/quality_gate.sh`.

That gate checks:

- generated required files;
- build/data validators;
- mobile/runtime/progress/course integrity;
- lecture image integrity;
- repository HTML/CSP/reference audit;
- performance budgets;
- repository hygiene when a Git worktree is available;
- JavaScript syntax for source, generated runtime, tests, and Playwright configs.

This does **not** replace browser E2E/accessibility/WebKit verification. It remains defense in depth even though GitHub-hosted runners are now operational.
