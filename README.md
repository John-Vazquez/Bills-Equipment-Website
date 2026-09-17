# Bill’s Equipment — catalog storefront release

Release: `bills-catalog-20260917-r1` · 17 September 2026

This replaces the public presentation with the approved red/black catalog design and extends the existing Supabase inventory with employee-managed catalogs, multiple category placements, a guest request cart and stored enquiries. It is a **quote/request release, not a payment checkout**.

## Start here

Use `START-HERE.md` in the update package for the Windows installer and local preview. Do not copy the entire repository onto a web host. The public build is **only `dist/`**.

```powershell
npm test
npm run check
npm run build
npm run preview
```

Node.js 20+ is required; the build has no npm package dependencies and needs no `npm install`. The browser loads the pinned Supabase client separately. Localhost preview blocks website writes/uploads/submissions, but may read the current public catalog.

## Operational documents

- `docs/IMPLEMENTED-AND-PENDING.md`: exact scope, defaults and unfinished setup.
- `docs/DATABASE-SETUP.md`: database preflight, staging migration, Edge Function, CAPTCHA, email and security acceptance tests.
- `docs/DEPLOYMENT.md`: safe build/hosting workflow and deployment verification.
- `docs/EMPLOYEE-GUIDE.md`: product/category organization, photos, stock and enquiries.
- `docs/TEST-REPORT.md`: executed checks versus tests still required.
- `docs/ASSET-SOURCES.md`: original branding and illustrative imagery.

## Architecture

`tools/pages.mjs` produces the shared HTML pages; `js/store/` contains the storefront and employee modules; `styles/store/` contains their styles. Keep edits in the templates/modules, then build. `supabase/` is private operational source, not deployed static content.

Existing product/category/image tables and IDs remain the foundation. Website placement and rental/availability metadata use additive `bills_*` tables. The SQL also changes grants and RLS policies, so it requires a real backup and staging validation, not just a Git rollback. No migration, authentication change, production deployment or DNS change was performed while creating this package.

Historical import reports and old working files may remain in the original repository for review. The allowlisted build excludes them. They are not silently reimported, deleted or republished.
