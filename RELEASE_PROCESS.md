# Release, Versioning & Rollback Policy

This document defines the release contract for the Medical MEQ Bank.

## Version format

The application version uses:

```text
YYYY.MM.DD.REVISION
```

Example:

```text
2026.10.03.1
```

The same application version must appear in:

- `version.json`
- `service-worker.js` as `APP_VERSION`
- `src/pwa-client.js` as `APP_VERSION`

`scripts/validate_build.py` rejects a generated build when these versions diverge.

## When to bump the version

Bump the application version for any production-visible change that can affect:

- application runtime behavior;
- lecture delivery or content metadata;
- service-worker caching;
- offline packs;
- progress storage/import/export;
- search indexes;
- accessibility or interaction behavior;
- security/deployment behavior.

Documentation-only commits do not require a version bump unless the release package itself changes.

## Cache policy

The service-worker cache name is derived from `APP_VERSION`.

A version bump creates a new cache namespace. On activation the worker removes older application caches. Do not manually reuse an old version after changing cache-sensitive runtime files.

Mandatory install cache is deliberately limited to the application shell and metadata required to start the bank. Lecture payloads are cached on use or by explicit offline download.

## Release gate

A commit is **release-candidate only** until all repository checks complete successfully:

1. `bash build.sh` (which invokes the canonical `scripts/quality_gate.sh`)
2. Python validators, repository/CSP audit and performance budgets
3. JavaScript syntax checks
4. Chromium E2E
5. axe WCAG A/AA
6. layout/performance/print/offline regressions
7. WebKit desktop + iPhone smoke tests

Generated `dist/` and Playwright reports are CI artifacts, not source-controlled release inputs.

## GitHub Actions control-plane recovery

The 2026-10-03 modernization branch reproduced a GitHub-side `startup_failure` before job creation. A diagnostic workflow containing only `runs-on: ubuntu-latest` plus `echo`/`uname` failed with the same synthetic `BuildFailed` result and zero jobs. This rules out application code, Playwright, Docker containers, checkout/setup actions, and the project validators as the cause.

The repository connector does not expose organization Actions administration, so recovery requires an organization owner or a user with the relevant Actions-policy/runners permission. The evidence and exact recovery/escalation steps are maintained in `ACTIONS_RECOVERY.md`.

Check **Hafez-Alhoot → Settings → Actions → General**:

1. **Actions permissions:** GitHub Actions must be enabled for this repository. If selected repositories are used, include `medical-meq-bank`.
2. **Standard hosted runners:** ensure standard GitHub-hosted runners are enabled for this repository/organization.
3. **Action policy:** the restored quality workflow uses GitHub-authored `actions/checkout`, `actions/setup-node`, and `actions/upload-artifact`. If actions are restricted, allow GitHub-authored actions or explicitly allow those actions. If the organization requires full commit-SHA pinning, pin them before rerunning.
4. **Workflow execution protections:** ensure pushes/PRs from the repository owner are allowed to execute workflows.
5. **Billing/usage:** because this is a private repository, confirm the account has available Actions minutes/allowed spending and that Actions is not in a GitHub-controlled disabled state.

After changing the setting, rerun PR #19. The first expected signal is that GitHub creates a real `validate` job rather than a synthetic `BuildFailed` run.

The reusable local equivalent is:

```bash
npm run quality:static
```

Then run browser tests:

```bash
npm ci --no-audit --no-fund
npm run test:e2e
npx playwright test --config=playwright.webkit.config.js
```

## Production promotion

The intended production flow is:

```text
feature branch
  -> pull request
  -> full quality matrix green
  -> merge to main
  -> Cloudflare version/build
  -> explicit production promotion
```

Cloudflare branch/deployment control is an external setting and cannot be guaranteed by repository code. Verify it in the Cloudflare dashboard before promotion.

## Rollback

If a release regresses:

1. stop further promotion;
2. restore the last approved Cloudflare Worker version;
3. branch from the source commit that needs repair;
4. fix source files only — never patch generated `dist/`;
5. bump the application version;
6. rerun the full quality matrix;
7. promote the repaired version.

Progress schema and content IDs are persistent user data. Never roll back by deleting or silently rewriting user progress.

## Release record

For every major release, update `PROJECT_PROGRESS.md` with:

- the release candidate version;
- completed phases;
- verification status;
- external blockers;
- any deferred work and the trigger that would justify it.
