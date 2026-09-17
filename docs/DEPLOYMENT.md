# Build, deploy and verify

## Build boundary

The only public output is `dist/`. The build explicitly includes the generated storefront/employee pages, their modules/styles, original-branding assets, public Supabase configuration, icons, manifest, robots, sitemap, security-header directives and release metadata.

It excludes SQL/functions, tests/test inventory, documentation, old crawled websites/import CSVs, editor caches, `.git`, backup receipts, `.env` secrets and package tools. Keep that boundary even when connecting a new host to GitHub. Do not publish the repository root.

Node.js 20+; no npm package install is needed:

```powershell
npm test
npm run check
npm run build
```

`BUILD.cmd` wraps the checks/build and creates a public upload ZIP. It does not publish. The package’s prebuilt `public-site.zip` uses the supplied public project configuration; rebuild after any intended configuration change.

## Hosting configuration still required

No host account was configured, no Pages setting was changed and no DNS record was modified. Keep GitHub for source control, but choose the approved production hosting destination before publishing. Do not assume a successful Git push means a verified deployment. Existing repository automation may publish root files when pushed, so do not push this local update until that workflow is reviewed.

The host needs HTTPS, correct JavaScript/module MIME types, conventional static file paths, and the security/cache policies in `dist/_headers` or their host-specific equivalents. Preserve nested `assets/`, `js/store/` and `styles/store/` paths. Do not configure every missing asset/API URL to return `index.html`; a missing JavaScript file must not become a successful HTML response.

Set the publish directory to `dist` and, for a Git-connected build, use `npm run build` with Node 20+. Build from the repository root. The domain stays Bill’s existing domain when the approved DNS/hosting move is made. Canonical metadata currently names `https://www.billsequipmentandrentals.com`.

The host must not inject unknown scripts that conflict with the CSP. The browser needs the pinned Supabase CDN client, project API/image connectivity and Turnstile assets. These external resources were mocked, not fetched in the controlled browser tests; verify actual loading and headers in staging.

## Request service

Online requests are not handled by the static host. The deployed `bills-enquiries` Supabase function performs validation, persistence and supplementary email notification. Follow DATABASE-SETUP.md first. Until configured/enabled, the UI deliberately offers direct contact/email-draft/copy alternatives and never reports that an offline draft was sent.

## Verification

After deployment, run `VERIFY-DEPLOY.cmd` against the final HTTPS address. Equivalent command:

```powershell
node tools/verify-deploy.mjs --url=https://www.billsequipmentandrentals.com/
```

This compares release metadata and each served public file against the local build, with four concurrent read-only GETs. `_headers` is a host directive, not an expected public asset. It warns when no Content-Security-Policy header is observed. A redirect is reported so the final canonical host can be verified explicitly.

Also use a normal browser to test header/menu interactions, keyboard/touch use, reload/back behavior, existing product IDs, employee login, draft denial, empty/network errors, photos, cart quantities and an end-to-end enquiry. Check Safari/Firefox and real phones, not only the included Chromium fixture tests. Verify the actual email inbox and private enquiry record independently.

## SEO scope

Static page titles/descriptions/canonical/social fields, robots and a static sitemap are included. Product detail metadata and Product JSON-LD are set from published data in JavaScript. Full product prerendering/SSR and product-specific sitemap generation are not delivered; choose a public-data export/prerender approach with the host before claiming reliable product previews for crawlers that do not run JavaScript.

## Rollback boundaries

The Windows installer backs up affected local files and can restore them if their hashes still match the installed/baseline versions. It leaves unknown files, `.git`, Supabase configuration and live services alone. Build output is generated separately and is not restored by local file rollback.

A previous hosting deployment is the production-file rollback. A database/storage backup plus reviewed schema/policy restoration is the data rollback. Those are different from local file rollback and were not executed here.
