# Employee guide

Use the existing **billsadmin** account and its existing password. No password change, customer registration or new employee provisioning is part of this release. A shared login’s history identifies that shared account, not the individual employee.

The manager becomes editable after the reviewed database migration. Before it exists, the new manager shows a read-only compatibility notice. Localhost preview always blocks writes.

## Catalogs, categories and products

A **catalog** is a top navigation department, such as Equipment or Concrete. A **category** groups related equipment, such as Concrete Saws. A **product** is the individual listing. Create each real product once; assign it to more than one category when needed.

In **Catalog Organization**, select a catalog, choose its categories and arrange them. Edit a category to change its name, parent, description, picture, visibility or placements. Parent/category order and catalog category order are independent. Empty categories remain hidden unless “show empty” is chosen. OEM and Parts sections start hidden, not prepopulated with invented content.

Example: assign Concrete Saws to both Equipment and Concrete; assign the saw product to Concrete Saws. The same product then appears in both shopping routes. Its price/photos are still one record. Hiding a catalog does not delete its products. Removing a placement does not delete a product. Unpublishing the product hides it everywhere in the public catalog.

The staff-only **Manage catalog** shortcut appears on the public browsing header after a valid employee session is detected. It opens the organization tools; ordinary customers do not see it.

## Products and publication

Create/edit products from **Products**. New products start as drafts. Fill in identification, descriptions/specifications, categories, sale/rental type, prices or request-price behavior, status and pictures. Use the category selections and “Appears in” preview to see placement.

Choose **Quote** for items customers may include in a request; choose **Information only** when they should contact Bill’s without adding it. Online purchase eligibility does not activate checkout in this release. A price is not a payment button.

Save, then use the private saved-product preview. Preview shows the last saved record; it is not a live unsaved-form preview. Publish only after checking the product. Bulk controls support publication and category assignment, not destructive mass deletion.

An “edited in another session” message means reopen the latest record before saving. Do not repeatedly recreate the item. When a response is lost, retrying the same still-open save preserves its product/operation IDs so the server can return the original successful save. If an upload or request fails, the form remains available for correction/retry.

## Photos

Upload JPEG, PNG, WebP or AVIF, at most 10 MB per source image and 12 photos per product. New images are decoded/resized/re-encoded before upload. Move the first image into the primary position and add useful alternative text.

Removing a gallery photo removes its association from the product. File bytes are retained for recovery and possible old/shared references. Do not delete random files directly from Storage. The technical operator has a read-only orphan-candidate report for a separately approved cleanup. Category and hero images are also stored independently of catalog names; moving equipment does not move or duplicate its photographs.

## Availability and rentals

Imported quantity values are not physical stock confirmation. Use **Confirm availability** unless inventory has been checked. To mark stock confirmed, enter a positive quantity and check the stock-review acknowledgement. After 30 days the public wording asks customers to confirm availability again; it does not claim perpetual stock.

Sale prices and rental day/week/month rates are separate. Keep “Request rental rate” selected when rates are unconfirmed. Rental dates submitted by a customer are requested dates, not a booking. The site does not reserve equipment or decrement stock.

## Enquiries

When the backend is enabled, **Enquiries** stores contact, quote, rental and mixed requests. Open a reference to see the submitted product snapshots, customer details and dates. Update status and private staff notes. “Open reply draft” opens your email client; sending that reply remains your action.

The stored request is the primary record. “Accepted by email provider” does not mean inbox delivery has been verified. Review failed notifications in the queue. Use Retry notification only as allowed; old ambiguous attempts require manual review to avoid duplicates. No customer auto-confirmation email is sent by this release.

When online submission is disabled, email drafts/copies made on the public site do not automatically appear in this queue.

## Settings and exports

An admin can edit shared public phone/email/address, tagline, hero headline/subtitle/background and the public Turnstile site key. **Never enter server secrets here.** The two original phone numbers stay separate until the owner confirms routing.

Keep online enquiry submission disabled until the operator finishes backend configuration and real staging tests. The readiness check is a configuration check, not proof of email delivery.

Export inventory JSON for reconciliation/backup assistance. It includes staff-visible inventory such as drafts, so store it privately. It excludes customer enquiries but is not a complete database/auth/storage backup. Regular approved product/category/photo changes require no website code deployment.
