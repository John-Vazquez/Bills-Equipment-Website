# Implemented and pending

## Delivered in this release

| Area | Delivered behavior |
|---|---|
| Visual design | Approved red/black/white arrangement; real pelican/wordmark artwork; contact strip, search/cart, active department navigation, compact hero and category-image grid. Responsive desktop/tablet/mobile layouts. |
| Browsing | Click department panels, full catalog pages, nested categories, brand navigation, sale/rental-aware routes, keyword/model/SKU search, 24-item pagination, filter URLs and browser-back state. |
| Product details | Ordered gallery/lightbox, primary photo, brand/model/SKU, text/specifications, related products, sale price or quote wording, independent rental rates, contact buttons. Existing `productDesc.html?id=` and rental routes retained. |
| Cart | Guest request cart and drawer, quantities/removal, local persistence, product revalidation, known-price estimates separate from unknown prices, contact/rental/mixed enquiry composition. No payment or confirmed reservation claims. |
| Employee products | Existing master-login mapping preserved; draft default, multi-category assignments, bulk placement/publication, photo validation/reordering/primary selection, specifications, stock review, rental rates, private saved-draft preview and inventory JSON export. |
| Organization | Create/edit/hide/reorder catalogs/categories; parent categories; catalog-category associations; thumbnails; one product record appears in multiple places. Staff-only Manage catalog shortcut. |
| Safer saves | Staged, immutable image paths; transaction-based product/placement/image metadata saves; operation IDs and retained product IDs; optimistic concurrency; lost-response retry handling; fields retained on errors. |
| Enquiries | Source for validated public Edge Function, CAPTCHA verification, request idempotency, server product snapshots, rate limits, private staff queue/status/notes, supplementary email notification and guarded retry. Requires deployment/configuration. |
| Other pages | Restyled About/Contact/privacy-information pages, real map/phone/email actions, common footer, explicit loading/empty/error states, no fake successful contact form. |
| Security source | Additive schema plus restrictive RLS/grants, explicit RPC permissions, staff/admin checks, nonpublic enquiries, host CSP/security-header file. Requires database and normal-browser integration validation. |
| Maintenance | Shared templates/modules, optimized local assets, public-output allowlist, static sitemap/metadata, offline inventory reconciliation report, storage orphan-candidate report, tests, checked local installer/rollback/build/deployment verifier. |

## Defaults used because the earlier questions were unanswered

The homepage itself follows the approved category-led Equipment view; every catalog also has a dedicated view. The cart submits **requests only**, not payments. Customers do not need accounts. Employee authentication retains the original master-account mapping and does not create users or reset passwords.

Imported quantities are not treated as confirmed stock. Stock confirmation requires an employee review and positive quantity, and ages back to “Confirm availability” after 30 days. Existing publication/listing types remain unchanged by the migration. Existing sale prices are not converted into rental rates.

OEM Catalogs and Parts are configurable but initially hidden. Rental enquiries use existing rental/both listings; no new equipment is invented or converted into a rental. There is no booking/dispatch calendar.

Both existing telephone numbers remain: 305-591-3933 for general contact, 954-789-9459 on product/rental actions. Public email remains earenas@billsequipment.net. Notifications require separately configured server recipients; configuring those is not the same as changing the public email field.

## Account-specific work still required before launch

**Database:** inspect the actual schema and every relevant legacy policy/privileged function, reconcile discrepancies, back up data and image bytes, test/apply the migration, compare baseline fingerprints, and test anon/staff/revoked access over real HTTP. The source ZIP did not contain the full original database definition. No installed/live schema or current inventory was certified.

**Enquiry infrastructure:** deploy `bills-enquiries`, configure allowed origins, Turnstile secret and public site key, an email provider’s verified sender and notification recipients, and a random rate-limit salt. Run real staging success/failure/retry tests. Only then enable production submissions. The supplied code does not fabricate these credentials.

**Hosting:** select and configure the commercial site host, publish only `dist/`, apply security headers, retain/point the existing domain, verify TLS and served files, and preserve a production rollback deployment. None of those account/DNS actions were taken.

**Inventory/content:** compare the current Supabase export with the old import reports before any retry/import. The historical report’s failures, review items and default quantities are not resolved by a visual rebuild. Employees/owner must confirm stock, prices, rental rates, actual products, department memberships, legal/operational copy and phone routing. Brand navigation uses real catalog text, not invented manufacturer logo art. Category pictures prefer employee-selected images, then real catalog photos; test screenshots are not the production image dataset.

## Plan items not implemented as complete production systems

- Credit-card checkout, payments/webhooks/orders/refunds, tax/shipping/freight rules and inventory reservation. No paid product is made purchasable merely because it has a price.
- Customer registration, accounts/order history, individual employee provisioning, or changes to the master login. Shared-login history identifies the account, not a specific worker.
- OEM exploded diagrams, parts-fitment data, a populated Parts catalog, automatic rental booking, confirmed delivery dates, or a new inventory/accounting integration.
- Build-time product prerendering/SSR and automatic product-specific sitemap generation. Static page metadata/sitemap and JavaScript-updated product metadata are included; social crawlers that do not run JavaScript still need the chosen host’s prerendering/export strategy.
- Automated backups, a proven database disaster-recovery restore, retention/deletion scheduling, email delivery/bounce webhooks or a production monitoring/alert service. Export/report tools and operating guidance are not a substitute for these.
- Automatic destruction of retired image files. Removing a photo removes its gallery association; bytes are retained for recovery/shared legacy references. The read-only orphan-candidate report supports separately reviewed cleanup. Category/hero retired files are retained as well.
- A full visual drag-and-drop page builder, analytics/marketing integrations, reviews, wishlists, promotions, bulk legacy reimport or a framework migration.

## Verification limits

Automated JavaScript and controlled browser scenarios passed, but this is not a claim that the database migration, Windows installer, live backend, hosted security headers or production email have been exercised. See TEST-REPORT.md. The delivered code needs the explicit staging/launch checklist, not an unreviewed push over the live site.
