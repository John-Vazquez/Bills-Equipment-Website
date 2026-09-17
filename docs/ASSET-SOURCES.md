# Asset sources and content integrity

`assets/bills-logo-original.png` is the original uploaded `Main Images/BE Logo.png` artwork. `bills-logo-horizontal.png` is a horizontal crop/recomposition of its existing mascot and wordmark artwork, including HARDWARE & EXPORT. It is not an AI replacement logo and no new brand identity was invented.

`location.webp`, `storefront.webp`, `rentals.webp` and `mortar-mixer.webp` are optimized versions of the supplied website’s existing location, business, rental and mixer assets. The original repository assets are not deleted by the installer. Optimization changes file size/dimensions, not the claimed business inventory.

`hero-equipment.webp` is an equipment-only crop from the user-approved generated mockup. It is **illustrative banner artwork**, not a claim that the pictured machine is a verified Bill’s listing. Employees can replace it with an approved real photograph through Site Settings after setup. Do not reuse the rendered mockup’s fabricated stock/prices as catalog data.

Production category tiles use employee-selected category media, then images from actual published category products. Missing images get a generic equipment placeholder. The initial repository does not contain a full set of verified manufacturer logos; brand navigation therefore uses brand names from actual catalog data rather than invented logos.

`tests/fixtures/images/` contains equipment crops from the approved mockup solely for controlled browser rendering tests. The synthetic product names/IDs/prices in `tests/fixtures/mock-browser.js` are **not migrated, seeded, published, or copied into `dist/`**. Screenshots in this package show those test records and are labeled accordingly; they demonstrate layout and workflows, not verified current inventory.

No font binaries are distributed. Typography uses the visitor’s available system sans-serif stack.
