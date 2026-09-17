# Backend setup and launch gates

**Production Bill’s project:** `rvgyfacefruqgclcbwgb`. This is NOT the Speedpack project.

These are operator instructions, not actions already performed. The release migration has not run against a PostgreSQL server in the build environment. Do not treat unit/browser mocks as database validation. Start on an isolated staging copy with the actual original schema, not an empty project with invented tables.

## A. Baseline and backups

1. Open the correct Bill’s Supabase project and execute **`supabase/00-read-only-preflight.sql`** in the SQL Editor. It starts a read-only transaction and rolls it back. Preserve all result sets, especially table definitions, RLS policies, grants, existing privileged functions, counts and row fingerprints. Do not paste service keys or passwords into a chat/export.
2. Compare the returned original tables with the schema assumed by the migration. Resolve additional required columns, differing enums/types, custom triggers, namespace collisions and existing RPCs before proceeding. The migration deliberately refuses unsupported types, unknown `bills_*` objects and missing active employee profiles instead of guessing.
3. Obtain a real recoverable database backup, including schema/policies/functions and authentication configuration appropriate to the project. Back up **Storage file bytes separately**. A Git commit, product JSON export or CSV is not a full backup.
4. Record current product/category/image/profile counts and fingerprints. Create an isolated staging project/copy with the same applicable schema/data; do not change production authentication/passwords. Keep customer enquiries out of any public test fixture.

## B. Apply and test on staging

1. Run the entire file **`supabase/migrations/202609170001_bills_catalog_v2.sql`** in a single SQL Editor execution on staging. It wraps the changes in a transaction, adds `bills_*` tables, backfills relationships, installs RPCs/triggers and changes permissions. It does not intentionally reprice, republish, reset stock, recreate products or modify `auth.users`.
2. Any error means STOP and review it. Do not remove guards, split out failed statements or apply a partial subset to production. Review changes against the actual preflight results. Keep the migration version tracked alongside the release.
3. Run **`supabase/01-read-only-verify.sql`**. Initial schema version should be 2; online enquiries should be disabled. Baseline table row fingerprints/counts should match the preflight when no concurrent user edits occurred. Review every private-table/public-role privilege and function execution grant. Investigate every unrelated older SECURITY DEFINER function; new RLS alone does not certify those.
4. Use a separate staging source copy and edit only that copy’s `js/supabase-config.js` to use the staging public URL/key. Build and deploy it to an approved **HTTPS staging hostname**. Do not point an editing-enabled HTTPS test site at live Bill’s data by accident. Localhost preview is intentionally read-only, so it cannot replace this write-path test.
5. Sign in with the deliberately configured staging counterpart of the employee account. Test creation, draft default, multi-category placement, category moves/hiding, publication, settings, optimistic conflict errors, gallery ordering, uploads and a retry after a dropped successful-save response. Confirm one product record, not duplicate inserts. Never use a real production product as disposable test data.

## C. Edge Function, CAPTCHA and email configuration

The function consists of `supabase/functions/bills-enquiries/index.ts` plus `handler.js`. Deploy the whole function folder, not just the TypeScript wrapper.

Supabase function configuration is in `supabase/config.toml`. Only this public enquiry endpoint has `verify_jwt = false`; its handler performs request/CAPTCHA validation and checks real user authentication for staff-only notification retries. Do not disable authentication on unrelated functions.

For a configured CLI, an explicit staging command is:

```powershell
supabase functions deploy bills-enquiries --project-ref YOUR_STAGING_PROJECT_REF --no-verify-jwt
```

This is an **actual deployment command**; it is not run by any Windows launcher. Substitute only the intended staging project reference. A later production deployment must separately name `rvgyfacefruqgclcbwgb` after approval. The function’s deployed configuration must be checked, not inferred from a successful CLI message.

Set real values through the project’s Edge Function secret settings. Names/examples are in `supabase/.env.example`; no live secret values are supplied.

| Variable | Required value |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side project environment. Check the hosted function’s environment; never put the service credential into the browser. |
| `BILLS_ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins allowed to use the function. Staging and production should have deliberately separate lists. No wildcard. |
| `TURNSTILE_ALLOWED_HOSTNAMES` | Comma-separated hostnames, without scheme/path. Must match the origin and the token hostname. |
| `TURNSTILE_SECRET_KEY` | Private key of the configured Turnstile widget. Server-only. |
| `RATE_LIMIT_SALT` | At least 32 securely random characters, unique to this environment. Do not use the example text. |
| `RESEND_API_KEY` | Server-only email provider key. |
| `BILLS_MAIL_FROM` | Sender authorized by the email provider, such as Bill’s Equipment `<website@your-verified-domain>`. |
| `BILLS_NOTIFY_TO` | Approved staff recipient address(es), comma-separated. Use test recipients in staging. |

Create a real staging Turnstile widget with the exact staging hostname. Its **public site key**, not its secret, goes into Employee Manager → Site Settings. The application uses action `enquiry`. The handler checks both action and hostname after server-side token validation. Dummy challenge tokens are not a replacement for real integration tests with this strict hostname policy.

Configure the email provider/domain through the owner-approved account. No DNS/email-provider configuration is performed by the package. Notifications contain the customer’s request and are sent to staff; no automatic customer confirmation email or delivery/bounce tracking is implemented.

## D. Enable and test on staging

Keep the submission toggle off while the database/function/secrets are incomplete. In Site Settings, save the public Turnstile key, then enable submissions **on staging only**. Use “Check service readiness”; it must report the expected configuration/schema. Readiness is not proof that an email reached an inbox.

Submit a marked test enquiry from the actual staging browser. Confirm the returned `BE-…` reference exists in the private queue with the correct item snapshots, quantities and requested dates. Confirm the email provider accepted the message and independently check the approved recipient inbox.

Test all of the following before launch:

- Guest cannot read enquiries, staff notes, draft products or management snapshots; cannot insert/update/delete products, categories, images, profiles or orders; cannot call management/service-only RPCs. Use actual anon credentials, not the SQL Editor’s privileged session.
- Signed-in nonstaff and revoked staff cannot acquire management permissions, change their own profile role/active flag, or use notification retries. Check base-table routes as well as every RPC. Valid staff can do only the intended tasks; settings require admin.
- Public queries never return unpublished/hidden items; category visibility and multiple placements behave correctly. Published product pictures are not confidential. This release’s public image buckets are not suitable for private documents.
- CAPTCHA expired/invalid/wrong-host tokens and unapproved origins fail. Malformed bodies, extra client prices, excessive quantities, sold/hidden/information-only items, mismatched rental modes/dates and rate limits are rejected or revalidated correctly.
- Drop a successful request response and retry the same submission. Confirm one enquiry; never two. Change request contents and confirm a new valid attempt is required. Customer fields remain after failed submissions.
- Simulate email failure: the stored enquiry must still exist and be usable by staff. Provider acceptance is labeled separately from inbox delivery. A retry within the guarded window should not send duplicates; ambiguous old attempts require manual review rather than blind resending.
- Test recent stock changes while the customer has a cart open. Submitted records must use the server’s current eligible products/prices, not browser-supplied amounts. No quantity decrement, payment or reservation should occur.

## E. Production release

After staging passes, take fresh backups/preflight results, apply the reviewed migration to the explicit Bill’s production project, compare fingerprints/counts again, and deploy the same function with production secrets/origins. Keep submissions disabled until the production host and CAPTCHA match. Publish the vetted static build, run a deliberately marked production smoke test, confirm its stored record and recipient delivery, then open the feature for normal use.

Retain a previous website deployment for file rollback. Database grants/policies/triggers changed by this migration require their own reviewed restore plan. **Do not drop the new tables as an automatic rollback:** doing so can destroy enquiries/placement information and does not reliably restore the old grants.

## Operational follow-through

Set backup/restore ownership, enquiry retention policy, notification/error monitoring and storage cleanup review. `02-read-only-media-review.sql` reports only candidate orphaned images. It does not delete anything, and references outside current database metadata must be checked. Product exports contain staff-visible drafts; keep them private.

## Official implementation references

Checked on 17 September 2026. These describe provider behavior, not proof that this project was deployed:

- Supabase function deployment/configuration: `https://supabase.com/docs/guides/functions/deploy`
- Supabase server environment/secrets: `https://supabase.com/docs/guides/functions/secrets`
- Turnstile requires server validation; token action/hostname checks and retry validation: `https://developers.cloudflare.com/turnstile/get-started/server-side-validation/`
- Resend idempotency behavior: `https://resend.com/docs/dashboard/emails/idempotency-keys`
