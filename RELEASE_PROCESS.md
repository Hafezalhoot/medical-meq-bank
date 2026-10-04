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

## GitHub Actions operational status

The 2026-10-03 synthetic `BuildFailed/startup_failure` incident was operationally resolved on 2026-10-04 by transferring the same public repository from the `Hafez-Alhoot` organization to the personal `Hafezalhoot` account. The repository ID and history were preserved. The exact organization-side policy/provisioning cause was not identified.

The current release gate is healthy. On PR #19 head `f5eaa43d9b08a3b0e2129685e344bc836bc9641a`, GitHub Actions run `37191073031` passed:

- `validate`;
- `chromium-quality` including axe, performance, Print/PDF and offline coverage;
- `webkit-quality` including Safari desktop and iPhone WebKit.

Issue #20 is closed. `ACTIONS_RECOVERY.md` is retained as an incident record and fallback runbook if the same zero-job signature ever returns.

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
