# GitHub Actions Recovery Runbook

This runbook documents the current GitHub-hosted runner provisioning failure for the private Medical MEQ Bank repository.

## Confirmed failure signature

Repository:

`Hafez-Alhoot/medical-meq-bank`

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

## Most likely account / organization checks

GitHub-hosted Actions usage for private repositories is charged to the **repository owner** after included usage. An account-level billing lock or Actions budget restriction can stop hosted-runner provisioning before a job starts.

Check the organization that owns this repository:

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

- repository: `Hafez-Alhoot/medical-meq-bank`
- repository ID: `1320445840`
- synthetic workflow ID: `351923769`
- run `37139141492`
- minimal-probe run `37140311659`
- symptom: `path=BuildFailed`, `conclusion=startup_failure`, `jobs=0`, no runner, no logs
- note that the same workflow file previously produced real jobs on `main`
- note that a one-job shell-only probe reproduces the same pre-job failure.

Ask Support to inspect the private repository / organization Actions execution entitlement and any stale synthetic `BuildFailed` routing or hosted-runner provisioning lock.

## What not to do

Do **not**:

- make the medical repository public merely to bypass private-repository Actions billing;
- weaken the quality workflow;
- merge PR #19 just because source-level checks pass;
- allow Cloudflare to auto-promote an unverified commit.

## Verification after recovery

Once the account/repository issue is fixed, push or update the modernization branch and confirm:

1. the run is named **Validate Medical MEQ Bank** instead of blank / `BuildFailed`;
2. job `validate` is created;
3. the shared static quality gate passes;
4. `chromium-quality` passes;
5. `webkit-quality` passes;
6. generated artifacts are present;
7. only then remove Draft status from PR #19 and consider production promotion.

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

This does **not** replace browser E2E/accessibility/WebKit verification, but it prevents Cloudflare or a local build from accepting obvious source/data/PWA regressions while GitHub-hosted runners are unavailable.
