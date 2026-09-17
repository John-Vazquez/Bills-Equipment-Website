# Release test report

Release: `bills-catalog-20260917-r1` · 17 September 2026

## Executed

**48 Node tests passed.** They cover input/HTML/URL safety, cart validation and privacy of stored cart data, unknown-price ordering, rental versus sale rates, 30-day stock wording, global search, multiple category placements, URL state, CSV reconciliation, image validation, deployment boundaries, and the real Edge handler exercised against controlled provider/database responses. Edge tests include CAPTCHA/origin failures, request validation, idempotent receipts, server-only product values, email failures, notification authorization and rate/error handling.

**12 controlled Chromium browser scenario groups passed, with no unhandled JavaScript exceptions recorded.** Coverage includes desktop navigation and Escape, category/product rendering, URL/back filters, request cart persistence and quantity editing, rental-only routing, honest network/legacy fallbacks, employee access gating, product creation with a response lost after commit followed by retry without duplication, default draft state, multi-category editing, organization/settings views, private draft preview, honest form success/failure handling, and pagination. The responsive scenario exercised seven public pages at 320, 390, 768, 1024 and 1440 pixels. A tablet navigation overflow found during testing was corrected.

Source syntax/link checks and the allowlisted static build passed. Generated root pages reference existing local assets/modules/styles; public output excludes the test fixtures, SQL, secrets examples, reports, old crawls and installer backups.

Rendered desktop/mobile storefront and employee screenshots were visually inspected. They are generated from the implementation using synthetic test inventory, not screenshots of a live production deployment.

## Important browser limitation

The container’s managed Chromium configuration blocks all top-level URL navigation. It was not modified. Tests rendered the actual page markup/styles/native ES modules in `about:blank`, fulfilled local resources from disk and supplied controlled SDK/backend responses. In-memory adapters supplied URL/history/storage behavior needed by the page code; they are test-only and are not written to production files.

This verifies DOM rendering, UI behavior and source logic under the fixture adapter. **It does not verify native browser navigation, normal origin/CSP/CDN behavior, actual Supabase RLS/SQL, real Turnstile or provider delivery.** The native-navigation test script is included separately for use in a normal test environment, and still needs to be run there.

## Not executed / not certified

- No PostgreSQL server/parser/runtime or Deno runtime was available. The migration was reviewed as source, and the extracted Edge handler was tested with Node mocks, but SQL creation/execution, constraints, RLS, RPC transactions and hosted Deno deployment were not exercised.
- No Windows PowerShell runtime was available. Windows launchers were statically reviewed; separate manifest-rule simulations/checks do not establish that they ran successfully on Windows. First Windows execution remains required.
- No production schema/inventory reconciliation, live credential validation, live image upload, real CAPTCHA challenge, email-provider acceptance/delivery, hosting upload, DNS/TLS change or deployed version check was performed.
- No Safari/Firefox/physical mobile, formal accessibility audit, full load test, normal-browser CSP integration, production restore drill or full product-crawler rendering test was performed.

The packet contains source, tests and a staged installation path. It is **not a certification that it is safe to skip database review and publish immediately**.

## Reproduce

```powershell
npm test
npm run check
npm run build
```

Controlled browser tests require Python, Playwright and Chromium; those are development test tools, not storefront runtime dependencies. `tests/browser-qa.py` contains the constrained-renderer harness used here. `tests/browser-native-qa.py` contains the native navigation harness and must be checked in a normal browser environment. Both intentionally use fake database/provider responses and test-only inventory.

For real-world acceptance and recovery tests use DATABASE-SETUP.md and DEPLOYMENT.md. Keep source backups, the preflight SQL result, baseline fingerprints, migration result, staged test evidence and the previous hosting deployment together.
