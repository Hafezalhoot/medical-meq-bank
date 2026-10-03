# Private deployment setup

The source repository remains **private**. Deployment visibility and user access are controlled separately in Cloudflare.

## Current platform

The application is configured as a **Cloudflare Worker with static assets** through `wrangler.jsonc`.

Repository:

`Hafez-Alhoot/medical-meq-bank`

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

## Cloudflare Workers Builds

Connect the GitHub repository from Cloudflare Dashboard → Workers & Pages → the `medical-meq-bank` Worker → Settings → Builds.

Recommended settings:

- Git provider: GitHub
- Repository: `Hafez-Alhoot/medical-meq-bank`
- Production branch: `main`
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

> Repository code cannot enforce the Cloudflare Dashboard branch-control setting. Treat this as an operational release control and verify it before a production release.

## Restrict access with Cloudflare Access

If the bank is intended for a restricted group:

1. Open Cloudflare Zero Trust → Access → Applications.
2. Add the Worker's production hostname as a self-hosted application.
3. Create the required Allow policy.
4. Use the organization's chosen identity provider or One-time PIN.
5. Test both allowed and denied users before publishing the URL.

Repository privacy does **not** make the deployed Worker private by itself.

## PWA and offline behavior

The first successful online load installs the application shell through the service worker. Lecture/offline behavior is versioned with the application and must be validated before release.

Student progress remains local to the browser unless the user explicitly exports/imports a progress backup.

## Release checklist

Before promoting a production version:

- `bash build.sh` succeeds, including the canonical static quality gate.
- All Python validators/repository audits and performance budgets succeed.
- JavaScript syntax checks succeed.
- Chromium/Playwright checks succeed.
- WebKit/iPhone checks succeed.
- Accessibility checks succeed.
- Offline/service-worker checks succeed.
- `version.json`, `service-worker.js`, and the generated PWA version agree.
- No medical content count or image-integrity regression is present.
- The exact production URL and Cloudflare Access policy are verified.
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
