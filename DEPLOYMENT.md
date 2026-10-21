# Deployment and access setup

The source repository is **public** under the personal `Hafezalhoot` account. Repository visibility and deployed-app access are separate; use Cloudflare Access if the Worker must be restricted.

## Current platform

The application is configured as a **Cloudflare Worker with static assets** through `wrangler.jsonc`.

Repository:

`Hafezalhoot/medical-meq-bank`

Production source branch:

`main`

Build command:

```bash
bash build.sh
```

`build.sh` finishes by running the canonical `scripts/quality_gate.sh`, so Cloudflare refuses the build when generated files, medical-data validators, repository/CSP audit, performance budgets, or JavaScript syntax checks fail.

Generated static assets:

```text
dist/
```

The Worker serves `dist/` through the `assets.directory` setting in `wrangler.jsonc`.

## Public Worker health endpoint / Access diagnosis

The production smoke requires `GET https://medical-meq-bank.hafztamr.workers.dev/version.json`
to return HTTP 200 with a JSON object matching the repository `version.json`.
This is a **live release gate**, not a GitHub build/preview substitute.

On 2026-10-21 the independent live smoke [run #39667473228](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39667473228)
received an HTML document instead of JSON on **18 consecutive requests**. The exact
HTML page type (login page, fallback HTML, or another route) was not identified
by that earlier version of the smoke test. The improved health check reports the
HTML title/content type or redirect target *without logging the full page*.

1. Open the production URL and then `/version.json` in an unauthenticated/private browser window.
2. If you see a Cloudflare Access login, confirm whether public access is intended. **Do not disable Access just to make CI green**. For private deployment, arrange an approved service-authenticated health check through a narrowly scoped Access policy; never commit client secrets to this repo or its workflow YAML.
3. If you see the main application HTML instead of a login, inspect Workers Routes/Asset routing. Ensure the Worker serves `dist/version.json` as JSON rather than rewriting it to `index.html`. Check the deployed Worker version and build output.
4. If an old JSON version is returned, verify Workers Builds deployment and version promotion from protected `main`; do not delete IndexedDB or the user-selected offline cache to fix a release routing issue.
5. Run the independent GitHub workflow **Live Cloudflare Production Smoke** after correcting the root cause, and review its JSON/screenshot artifact. Only a passing live smoke confirms production presentation of the exact release.

### Protected-site production smoke (confirmed Access redirect)

The improved smoke run [#39669065228](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39669065228) identified **HTTP 302 to `hafztamr.cloudflareaccess.com/cdn-cgi/access/login/`**. This confirms that Cloudflare Access is intercepting the unauthenticated health request. It does **not** mean the application JS, images, or lecture content are broken. Public production verification is blocked until the smoke has approved authentication.

To keep the study site protected **without disabling Access**:

1. In Cloudflare Zero Trust, open **Access controls → Service credentials → Service Tokens**, create a dedicated token named e.g. `MEQ Production Smoke`, and copy the Client ID and Client Secret **to a secure manager**. Cloudflare displays the Secret only when it is created.
2. In **Access → Applications**, edit the policy protecting `medical-meq-bank.hafztamr.workers.dev`. Add a narrowly scoped **Service Auth** policy that includes **only this token**. Keep existing human login policies. A token alone is insufficient without the matching Service Auth policy.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**. Create `MEQ_CF_ACCESS_CLIENT_ID` and `MEQ_CF_ACCESS_CLIENT_SECRET` using the values from Cloudflare. **Never put token values in a PR, file, chat message, workflow log, or URL.** Rotate/revoke according to your Access policy.
4. Trigger **Live Cloudflare Production Smoke** via GitHub Actions → Run workflow. The script attaches token headers **only to the pinned approved Worker origin**, not to redirects or external resources. Both secrets must be configured together; if absent, the health check honestly fails at the existing Access boundary.
5. Confirm live `/version.json` matches repository `version.json`, all static assets share the release cohort, and responsive UI/source-JPEG SHA checks pass. An authorized CI test does **not** make the protected app public.

Cloudflare reference: [Service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) and [Authenticate coding agents](https://developers.cloudflare.com/cloudflare-one/access-controls/authenticate-agents/).

## One-click promotion of an approved uploaded Worker

GitHub CI validated source release `2026.10.21.6` on merge commit
`7a01299ffa9d0b2ca066903b02918feb8ec7761f`. Cloudflare Workers Builds
reported a **successfully uploaded** Worker Version ID
`693d6a6f-f459-4080-ba98-5a14b935946e` with build ID
`57145de7-0235-4daf-a687-1be75070aaa1`.
**An uploaded Worker is not necessarily the version currently receiving traffic.**

An independent release workflow is available at
[Promote approved MEQ Worker](https://github.com/Hafezalhoot/medical-meq-bank/actions/workflows/promote-production.yml)
once this workflow PR has merged. The exact protected-main merge titled
**Promote approved MEQ Worker via protected CI (#41)** makes **one**
owner-requested automatic attempt using the already-approved SHA and Worker
Version ID; **future pushes do not auto-promote**. The same workflow also
supports manual runs for an authorized retry or subsequent approved release.
It promotes an **existing approved version** to 100% traffic via
`wrangler versions deploy`, without rebuilding, uploading book photos again,
clearing student progress, or weakening Cloudflare Access.

**One-time credentials — owner action:** In Cloudflare, create a limited
"Edit Cloudflare Workers" API token scoped to the correct account. Under GitHub
**Settings → Secrets and variables → Actions**, store
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as *repository secrets*.
Never commit or paste the token. These are **Cloudflare deployment API**
credentials and are **different from** the `MEQ_CF_ACCESS_CLIENT_ID` and
`MEQ_CF_ACCESS_CLIENT_SECRET` login-testing credentials.

To promote the approved version:

1. In GitHub Actions, select **Promote approved MEQ Worker** → **Run workflow**
   on `main` (do not select a development branch).
2. Set **source_sha** to `7a01299ffa9d0b2ca066903b02918feb8ec7761f`,
   **worker_version_id** to `693d6a6f-f459-4080-ba98-5a14b935946e`,
   and explicitly check the 100% production traffic confirmation.
3. The job refuses unreviewed commits, mismatched release metadata,
   a failed Chromium/WebKit/static check, or a Worker version not reported
   in the successful Cloudflare Workers Build for that exact commit.
4. Review the Wrangler deployment-status output and retain the previously
   active Worker version for rollback. Then run **Live Cloudflare Production
   Smoke** with the separate narrowly scoped Access Service Auth policy.
   The smoke's successful checks for responsive presentation, same-release
   CSS/JS and original-photo hashes are the final verification gate.

If a new application version is merged before promotion, do **not** use the
old inputs; select and verify the newer build's source SHA and Worker version.
A successful GitHub Workers Builds check alone is **not** a traffic-promotion
receipt. Cloudflare official references: [versions deploy](https://developers.cloudflare.com/workers/wrangler/commands/workers/#versions-deploy)
and [GitHub Actions authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).

## Cloudflare Workers Builds

Open the existing `medical-meq-bank` Worker in the Cloudflare dashboard → **Settings → Build**. The repository was transferred from an organization to the personal GitHub account, so verify the integration still points to the **new personal owner**; do not create another production Worker.

Recommended settings:

- Git provider: GitHub
- Repository: `Hafezalhoot/medical-meq-bank`
- Production branch: `main` (**Settings → Build → Branch control**)
- Build command: `bash build.sh`
- Production deploy command: use the release policy below
- Preview builds: enabled for pull-request branches when available

### Release safety

Production must not be promoted from an unverified commit.

Preferred release flow:

```text
Pull request
  -> build + static validators
  -> Chromium / accessibility checks
  -> WebKit / iPhone checks
  -> merge to main
  -> Cloudflare build
  -> production promotion
```

When GitHub Actions quality gates are unavailable, configure Workers Builds so a push only uploads a version rather than immediately promoting it:

```bash
npx wrangler versions upload
```

Promote a version only after the same commit has passed the project validation matrix.

Alternatively, temporarily disable automatic production-branch deployments in Cloudflare Branch control and deploy an approved build manually.

> Repository code cannot enforce the Cloudflare Dashboard branch-control or the active production deployment command. Treat both as operational release controls and verify them before a production release. [Cloudflare verification issue #22](https://github.com/Hafezalhoot/medical-meq-bank/issues/22) contains the operator acceptance checklist.

## Restrict access with Cloudflare Access

If the bank is intended for a restricted group:

1. Open Cloudflare Zero Trust → Access → Applications.
2. Add the Worker's production hostname as a self-hosted application.
3. Create the required Allow policy.
4. Use the chosen identity provider or One-time PIN.
5. Test both allowed and denied users before publishing the URL.

Public repository visibility does **not** control access to the deployed Worker. If the deployed bank must be restricted, enforce that separately with Cloudflare Access.

## PWA and offline behavior

The first successful online load installs the application shell through the service worker. Lecture/offline behavior is versioned with the application and must be validated before release.

Student progress remains local to the browser unless the user explicitly exports/imports a progress backup.

## Release checklist

Before promoting a production version:

- `bash build.sh` succeeds, including the canonical static quality gate.
- GitHub PR quality checks are green and `main` branch protection requires them (import [the prepared ruleset](./.github/rulesets/main-protection.json) and verify enforcement; issue #21).
- All Python validators/repository audits and performance budgets succeed.
- JavaScript syntax checks succeed.
- Chromium/Playwright checks succeed.
- WebKit/iPhone checks succeed.
- Accessibility checks succeed.
- Offline/service-worker checks succeed.
- `version.json`, `service-worker.js`, and the generated PWA version agree.
- No medical content count or image-integrity regression is present.
- The existing Cloudflare Worker is connected to `Hafezalhoot/medical-meq-bank`, its production branch is `main`, and the actual deploy command is verified.
- Automatic production promotion cannot bypass the approved GitHub PR/CI process.
- The exact production URL and Cloudflare Access policy are verified.
- The last approved Worker version is available for rollback.
- `PROJECT_PROGRESS.md` is updated for the release.

## Rollback

Keep the previously approved Worker version available in Cloudflare.

If a production regression is found:

1. Stop further promotion.
2. Roll back to the last approved Worker version in Cloudflare.
3. Open/fix the regression on a branch.
4. Re-run the full validation matrix.
5. Promote the corrected version only after verification.

Do not repair production by editing generated `dist/` files directly. Fix source files and rebuild.
