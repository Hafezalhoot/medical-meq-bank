# Private deployment setup

This repository stays **Private**.

## Cloudflare Pages project

1. Open Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Authorize GitHub and select `Hafezalhoot/medical-meq-bank`.
3. Use these build settings:
   - Production branch: `main`
   - Build command: `bash build.sh`
   - Build output directory: `dist`
4. Deploy.

## Restrict access with Cloudflare Access

1. Open Zero Trust → Access → Applications → Add an application → Self-hosted.
2. Add the deployed Pages hostname.
3. Create an Allow policy for the email addresses that may open the bank.
4. Use One-time PIN as the login method.

The first successful online load installs the PWA assets in the browser cache. The bank can then open offline on that device. Progress remains stored locally in that browser unless exported and imported.

## Future lecture updates

Replace `Medical_MEQ_Bank_PWA_GitHub_Pages.zip` in the repository root with the new package. Cloudflare Pages will rebuild and publish the update on the same link.
