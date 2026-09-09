import { supabase, PRODUCT_IMAGE_BUCKET, getPublicImageUrl, slugify } from './supabase-client.js';

const state = {
  profile: null,
  products: [],
  categories: [],
  editingProduct: null,
  removedImageIds: new Set(),
};

const el = {
  loading: document.getElementById('adminLoading'),
  app: document.getElementById('adminApp'),
  logoutButton: document.getElementById('logoutButton'),
  adminIdentity: document.getElementById('adminIdentity'),
  productCount: document.getElementById('productCount'),
  publishedCount: document.getElementById('publishedCount'),
  inactiveCount: document.getElementById('inactiveCount'),
  categoryCount: document.getElementById('categoryCount'),

  addProductButton: document.getElementById('addProductButton'),
  addProductTile: document.getElementById('addProductTile'),
  productSearch: document.getElementById('productSearch'),
  typeFilter: document.getElementById('typeFilter'),
  statusFilter: document.getElementById('statusFilter'),
  categoryFilter: document.getElementById('categoryFilter'),
  productGrid: document.getElementById('productGrid'),
  emptyState: document.getElementById('emptyState'),
  inventoryMessage: document.getElementById('inventoryMessage'),

  productDialog: document.getElementById('productDialog'),
  productForm: document.getElementById('productForm'),
  productDialogTitle: document.getElementById('productDialogTitle'),
  closeProductDialog: document.getElementById('closeProductDialog'),
  cancelProductButton: document.getElementById('cancelProductButton'),
  deleteProductButton: document.getElementById('deleteProductButton'),
  saveProductButton: document.getElementById('saveProductButton'),
  productFormMessage: document.getElementById('productFormMessage'),

  productId: document.getElementById('productId'),
  productName: document.getElementById('productName'),
  listingType: document.getElementById('listingType'),
  categoryId: document.getElementById('categoryId'),
  newCategoryButton: document.getElementById('newCategoryButton'),
  brand: document.getElementById('brand'),
  model: document.getElementById('model'),
  sku: document.getElementById('sku'),
  condition: document.getElementById('condition'),
  price: document.getElementById('price'),
  callForPrice: document.getElementById('callForPrice'),
  quantity: document.getElementById('quantity'),
  status: document.getElementById('status'),
  displayOrder: document.getElementById('displayOrder'),
  description: document.getElementById('description'),
  isPublished: document.getElementById('isPublished'),
  featured: document.getElementById('featured'),
  existingImages: document.getElementById('existingImages'),
  productImages: document.getElementById('productImages'),

  categoryDialog: document.getElementById('categoryDialog'),
  categoryForm: document.getElementById('categoryForm'),
  newCategoryName: document.getElementById('newCategoryName'),
  categoryMessage: document.getElementById('categoryMessage'),
  closeCategoryDialog: document.getElementById('closeCategoryDialog'),
  cancelCategoryButton: document.getElementById('cancelCategoryButton'),
  saveCategoryButton: document.getElementById('saveCategoryButton'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setMessage(target, message = '', type = '') {
  target.textContent = message;
  target.className = `admin-message ${type}`.trim();
}

function formatPrice(product) {
  if (product.call_for_price) return 'Call for Price';
  if (product.price === null || product.price === undefined) return 'Price not set';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(product.price));
}

function typeLabel(type) {
  return {
    product: 'Sale',
    rental: 'Rental',
    both: 'Sale + Rental',
  }[type] || type;
}

function statusLabel(status) {
  return {
    active: 'Active',
    out_of_stock: 'Out of stock',
    sold: 'Sold',
    hidden: 'Hidden',
  }[status] || status;
}

function redirectToLogin(reason = '') {
  const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  window.location.replace(`admin-login.html${suffix}`);
}

async function requireAuthorizedAdmin() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    redirectToLogin();
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('admin_profiles')
    .select('id, email, display_name, role, active')
    .eq('id', session.user.id)
    .eq('active', true)
    .maybeSingle();

  if (profileError || !profile || !['admin', 'editor'].includes(profile.role)) {
    await supabase.auth.signOut();
    redirectToLogin('unauthorized');
    return null;
  }

  return { session, profile };
}

async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, active, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;

  state.categories = data || [];
  renderCategoryOptions();
}

async function loadProducts() {
  setMessage(el.inventoryMessage, 'Loading products...');

  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      slug,
      description,
      brand,
      model,
      sku,
      category_id,
      listing_type,
      condition,
      price,
      call_for_price,
      quantity,
      status,
      featured,
      is_published,
      display_order,
      source,
      external_id,
      created_at,
      updated_at,
      categories ( id, name ),
      product_images (
        id,
        storage_path,
        alt_text,
        sort_order,
        is_primary
      )
    `)
    .order('display_order', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) throw error;

  state.products = (data || []).map((product) => ({
    ...product,
    product_images: [...(product.product_images || [])]
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
  }));

  setMessage(el.inventoryMessage, '');
  renderStats();
  renderProducts();
}

function renderStats() {
  el.productCount.textContent = String(state.products.length);
  el.publishedCount.textContent = String(
    state.products.filter((product) => product.is_published && product.status !== 'hidden').length
  );
  el.inactiveCount.textContent = String(
    state.products.filter((product) => ['sold', 'hidden'].includes(product.status)).length
  );
  el.categoryCount.textContent = String(state.categories.filter((category) => category.active).length);
}

function renderCategoryOptions(selectedId = null) {
  const activeCategories = state.categories.filter((category) => category.active || category.id === selectedId);

  el.categoryId.innerHTML =
    '<option value="">Uncategorized</option>' +
    activeCategories
      .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
      .join('');

  const currentFilter = el.categoryFilter.value || 'all';
  el.categoryFilter.innerHTML =
    '<option value="all">All categories</option>' +
    activeCategories
      .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
      .join('');

  if ([...el.categoryFilter.options].some((option) => option.value === currentFilter)) {
    el.categoryFilter.value = currentFilter;
  }
}

function getFilteredProducts() {
  const term = el.productSearch.value.trim().toLowerCase();
  const type = el.typeFilter.value;
  const status = el.statusFilter.value;
  const category = el.categoryFilter.value;

  return state.products.filter((product) => {
    const haystack = [
      product.name,
      product.brand,
      product.model,
      product.sku,
      product.categories?.name,
      product.description,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesTerm = !term || haystack.includes(term);
    const matchesType = type === 'all' || product.listing_type === type;
    const matchesStatus = status === 'all' || product.status === status;
    const matchesCategory = category === 'all' || product.category_id === category;

    return matchesTerm && matchesType && matchesStatus && matchesCategory;
  });
}

function renderProducts() {
  const products = getFilteredProducts();

  const addCard = `
    <button class="admin-add-card" type="button" data-action="add-product">
      <span class="admin-add-icon">+</span>
      <strong>Add Product</strong>
      <small>Create a new sale listing</small>
    </button>
  `;

  const cards = products.map((product) => {
    const primaryImage =
      product.product_images.find((image) => image.is_primary) ||
      product.product_images[0];

    const imageHtml = primaryImage
      ? `<img src="${escapeHtml(getPublicImageUrl(primaryImage.storage_path))}" alt="${escapeHtml(primaryImage.alt_text || product.name)}" loading="lazy" />`
      : '<div class="admin-card-placeholder">No photo</div>';

    const quickAction = product.status === 'sold'
      ? `<button type="button" class="admin-card-button" data-action="mark-active" data-id="${product.id}">Mark Active</button>`
      : `<button type="button" class="admin-card-button" data-action="mark-sold" data-id="${product.id}">Mark Sold</button>`;

    return `
      <article class="admin-product-card">
        <div class="admin-card-image">
          ${imageHtml}
          ${product.featured ? '<span class="admin-featured-badge">Featured</span>' : ''}
        </div>

        <div class="admin-card-body">
          <div class="admin-card-badges">
            <span class="admin-type-badge">${escapeHtml(typeLabel(product.listing_type))}</span>
            <span class="admin-status-badge status-${escapeHtml(product.status)}">${escapeHtml(statusLabel(product.status))}</span>
            ${product.is_published ? '' : '<span class="admin-draft-badge">Draft</span>'}
          </div>

          <h3>${escapeHtml(product.name)}</h3>

          <div class="admin-card-meta">
            ${product.brand ? `<span>${escapeHtml(product.brand)}</span>` : ''}
            ${product.model ? `<span>${escapeHtml(product.model)}</span>` : ''}
            ${product.sku ? `<span>SKU ${escapeHtml(product.sku)}</span>` : ''}
            ${product.categories?.name ? `<span>${escapeHtml(product.categories.name)}</span>` : ''}
          </div>

          <div class="admin-card-price">${escapeHtml(formatPrice(product))}</div>

          <div class="admin-card-footer">
            <small>Order ${Number(product.display_order || 0)}</small>
            <div class="admin-card-actions">
              ${quickAction}
              <button type="button" class="admin-card-button admin-card-button-primary" data-action="edit" data-id="${product.id}">Edit</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  el.productGrid.innerHTML = addCard + cards;
  el.emptyState.hidden = products.length > 0 || state.products.length === 0;

  if (state.products.length === 0) {
    el.emptyState.hidden = true;
  }
}

function nextDisplayOrder() {
  if (!state.products.length) return 10;
  return Math.max(...state.products.map((product) => Number(product.display_order || 0))) + 10;
}

function resetProductForm() {
  state.editingProduct = null;
  state.removedImageIds.clear();

  el.productForm.reset();
  el.productId.value = '';
  el.listingType.value = 'product';
  el.condition.value = 'unspecified';
  el.quantity.value = '1';
  el.status.value = 'active';
  el.displayOrder.value = String(nextDisplayOrder());
  el.isPublished.checked = true;
  el.featured.checked = false;
  el.callForPrice.checked = false;
  el.price.disabled = false;
  el.categoryId.value = '';
  el.existingImages.innerHTML = '<div class="admin-photo-empty">No photos yet.</div>';
  el.productImages.value = '';
  el.deleteProductButton.hidden = true;
  el.productDialogTitle.textContent = 'Add Product';
  setMessage(el.productFormMessage, '');
}

function renderExistingImages(product) {
  const images = product?.product_images || [];

  if (!images.length) {
    el.existingImages.innerHTML = '<div class="admin-photo-empty">No photos yet.</div>';
    return;
  }

  el.existingImages.innerHTML = images.map((image, index) => `
    <div class="admin-photo-thumb" data-image-id="${image.id}">
      <img src="${escapeHtml(getPublicImageUrl(image.storage_path))}" alt="${escapeHtml(image.alt_text || product.name)}" />
      <button type="button" class="admin-photo-remove" data-action="remove-image" data-image-id="${image.id}" aria-label="Remove image">Ã—</button>
      ${image.is_primary || index === 0 ? '<span>Primary</span>' : ''}
    </div>
  `).join('');
}

function openProductDialog(product = null) {
  resetProductForm();

  if (product) {
    state.editingProduct = product;
    el.productDialogTitle.textContent = 'Edit Product';
    el.productId.value = product.id;
    el.productName.value = product.name || '';
    el.listingType.value = product.listing_type || 'product';
    renderCategoryOptions(product.category_id || null);
    el.categoryId.value = product.category_id || '';
    el.brand.value = product.brand || '';
    el.model.value = product.model || '';
    el.sku.value = product.sku || '';
    el.condition.value = product.condition || 'unspecified';
    el.price.value = product.price ?? '';
    el.callForPrice.checked = Boolean(product.call_for_price);
    el.price.disabled = el.callForPrice.checked;
    el.quantity.value = String(product.quantity ?? 0);
    el.status.value = product.status || 'active';
    el.displayOrder.value = String(product.display_order ?? 0);
    el.description.value = product.description || '';
    el.isPublished.checked = Boolean(product.is_published);
    el.featured.checked = Boolean(product.featured);
    el.deleteProductButton.hidden = false;
    renderExistingImages(product);
  } else {
    renderCategoryOptions();
  }

  el.productDialog.showModal();
  setTimeout(() => el.productName.focus(), 50);
}

function closeProductDialog() {
  if (el.productDialog.open) el.productDialog.close();
}

function openCategoryDialog() {
  el.categoryForm.reset();
  setMessage(el.categoryMessage, '');
  el.categoryDialog.showModal();
  setTimeout(() => el.newCategoryName.focus(), 50);
}

function closeCategoryDialog() {
  if (el.categoryDialog.open) el.categoryDialog.close();
}

function productPayload() {
  const name = el.productName.value.trim();

  if (!name) {
    throw new Error('Product name is required.');
  }

  const rawPrice = el.price.value.trim();
  const price = rawPrice === '' ? null : Number(rawPrice);

  if (!el.callForPrice.checked && price !== null && (!Number.isFinite(price) || price < 0)) {
    throw new Error('Enter a valid price or choose Call for Price.');
  }

  const quantity = Number(el.quantity.value || 0);
  const displayOrder = Number(el.displayOrder.value || 0);

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error('Quantity must be a whole number of 0 or greater.');
  }

  if (!Number.isInteger(displayOrder)) {
    throw new Error('Display order must be a whole number.');
  }

  return {
    name,
    description: el.description.value.trim() || null,
    brand: el.brand.value.trim() || null,
    model: el.model.value.trim() || null,
    sku: el.sku.value.trim() || null,
    category_id: el.categoryId.value || null,
    listing_type: el.listingType.value,
    condition: el.condition.value,
    price: el.callForPrice.checked ? null : price,
    call_for_price: el.callForPrice.checked,
    quantity,
    status: el.status.value,
    featured: el.featured.checked,
    is_published: el.isPublished.checked,
    display_order: displayOrder,
    source: state.editingProduct?.source || 'manual',
    external_id: state.editingProduct?.external_id || null,
  };
}

async function removeMarkedImages() {
  if (!state.editingProduct || state.removedImageIds.size === 0) return;

  const removedImages = state.editingProduct.product_images.filter((image) =>
    state.removedImageIds.has(image.id)
  );

  const paths = removedImages.map((image) => image.storage_path).filter(Boolean);

  if (paths.length) {
    const { error: storageError } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .remove(paths);

    if (storageError) throw storageError;
  }

  const { error: rowError } = await supabase
    .from('product_images')
    .delete()
    .in('id', [...state.removedImageIds]);

  if (rowError) throw rowError;
}

async function uploadImages(productId, productName) {
  const files = [...el.productImages.files];
  if (!files.length) return;

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

  const { data: remainingRows, error: remainingError } = await supabase
    .from('product_images')
    .select('id, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (remainingError) throw remainingError;

  const startingOrder = remainingRows?.length || 0;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`${file.name}: unsupported image type.`);
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`${file.name}: image is larger than 10 MB.`);
    }

    const extension = (file.name.split('.').pop() || 'jpg')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'jpg';

    const storagePath = `${productId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { error: rowError } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        storage_path: storagePath,
        alt_text: productName,
        sort_order: startingOrder + index,
        is_primary: startingOrder + index === 0,
      });

    if (rowError) {
      await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([storagePath]);
      throw rowError;
    }
  }
}

async function normalizePrimaryImage(productId) {
  const { data: images, error } = await supabase
    .from('product_images')
    .select('id, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  if (!images?.length) return;

  const ids = images.map((image) => image.id);

  const { error: clearError } = await supabase
    .from('product_images')
    .update({ is_primary: false })
    .in('id', ids);

  if (clearError) throw clearError;

  const { error: primaryError } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', images[0].id);

  if (primaryError) throw primaryError;
}

async function saveProduct(event) {
  event.preventDefault();
  el.saveProductButton.disabled = true;
  el.saveProductButton.textContent = 'Saving...';
  setMessage(el.productFormMessage, '');

  try {
    const payload = productPayload();
    const editingId = el.productId.value || null;
    let productId = editingId;

    if (editingId) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingId);

      if (error) throw error;
    } else {
      payload.slug = `${slugify(payload.name) || 'item'}-${crypto.randomUUID().slice(0, 8)}`;

      const { data, error } = await supabase
        .from('products')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;
      productId = data.id;
    }

    await removeMarkedImages();
    await uploadImages(productId, payload.name);
    await normalizePrimaryImage(productId);

    closeProductDialog();
    await loadProducts();
    setMessage(
      el.inventoryMessage,
      editingId ? 'Product updated.' : 'Product added.',
      'success'
    );
  } catch (error) {
    console.error('Unable to save product:', error);
    setMessage(el.productFormMessage, error.message || 'Unable to save product.', 'error');
  } finally {
    el.saveProductButton.disabled = false;
    el.saveProductButton.textContent = 'Save Product';
  }
}

async function deleteCurrentProduct() {
  const product = state.editingProduct;
  if (!product) return;

  const confirmed = window.confirm(
    `Permanently delete "${product.name}"?\n\nUsually it is safer to set the product to Hidden instead.`
  );

  if (!confirmed) return;

  el.deleteProductButton.disabled = true;
  setMessage(el.productFormMessage, 'Deleting product...');

  try {
    const imagePaths = (product.product_images || [])
      .map((image) => image.storage_path)
      .filter(Boolean);

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id);

    if (error) throw error;

    let cleanupWarning = '';

    if (imagePaths.length) {
      const { error: storageError } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .remove(imagePaths);

      if (storageError) {
        console.warn('Product deleted, but storage cleanup failed:', storageError);
        cleanupWarning = ' Old image files may remain in storage.';
      }
    }

    closeProductDialog();
    await loadProducts();
    setMessage(el.inventoryMessage, `Product deleted.${cleanupWarning}`, cleanupWarning ? 'warning' : 'success');
  } catch (error) {
    console.error('Unable to delete product:', error);
    setMessage(el.productFormMessage, error.message || 'Unable to delete product.', 'error');
  } finally {
    el.deleteProductButton.disabled = false;
  }
}

async function setProductStatus(productId, status) {
  const { error } = await supabase
    .from('products')
    .update({ status })
    .eq('id', productId);

  if (error) {
    setMessage(el.inventoryMessage, error.message, 'error');
    return;
  }

  await loadProducts();
  setMessage(
    el.inventoryMessage,
    status === 'sold' ? 'Product marked sold.' : 'Product marked active.',
    'success'
  );
}

async function createCategory(event) {
  event.preventDefault();

  const name = el.newCategoryName.value.trim();
  if (!name) return;

  el.saveCategoryButton.disabled = true;
  el.saveCategoryButton.textContent = 'Creating...';
  setMessage(el.categoryMessage, '');

  try {
    const slug = `${slugify(name) || 'category'}-${crypto.randomUUID().slice(0, 6)}`;

    const { data, error } = await supabase
      .from('categories')
      .insert({ name, slug, active: true })
      .select('id')
      .single();

    if (error) throw error;

    await loadCategories();
    el.categoryId.value = data.id;
    closeCategoryDialog();
  } catch (error) {
    console.error('Unable to create category:', error);
    setMessage(el.categoryMessage, error.message || 'Unable to create category.', 'error');
  } finally {
    el.saveCategoryButton.disabled = false;
    el.saveCategoryButton.textContent = 'Create Category';
  }
}

el.logoutButton.addEventListener('click', async () => {
  el.logoutButton.disabled = true;

  try {
    await supabase.auth.signOut();
  } finally {
    window.location.replace('admin-login.html');
  }
});

el.addProductButton.addEventListener('click', () => openProductDialog());
el.addProductTile.addEventListener('click', () => openProductDialog());
el.closeProductDialog.addEventListener('click', closeProductDialog);
el.cancelProductButton.addEventListener('click', closeProductDialog);
el.deleteProductButton.addEventListener('click', deleteCurrentProduct);
el.productForm.addEventListener('submit', saveProduct);

el.newCategoryButton.addEventListener('click', openCategoryDialog);
el.closeCategoryDialog.addEventListener('click', closeCategoryDialog);
el.cancelCategoryButton.addEventListener('click', closeCategoryDialog);
el.categoryForm.addEventListener('submit', createCategory);

el.callForPrice.addEventListener('change', () => {
  el.price.disabled = el.callForPrice.checked;
  if (el.callForPrice.checked) el.price.value = '';
});

[el.productSearch, el.typeFilter, el.statusFilter, el.categoryFilter].forEach((control) => {
  control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', renderProducts);
});

el.productGrid.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const action = button.dataset.action;

  if (action === 'add-product') {
    openProductDialog();
    return;
  }

  const product = state.products.find((item) => item.id === button.dataset.id);
  if (!product) return;

  if (action === 'edit') {
    openProductDialog(product);
    return;
  }

  if (action === 'mark-sold') {
    await setProductStatus(product.id, 'sold');
    return;
  }

  if (action === 'mark-active') {
    await setProductStatus(product.id, 'active');
  }
});

el.existingImages.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="remove-image"]');
  if (!button) return;

  const imageId = button.dataset.imageId;
  state.removedImageIds.add(imageId);
  button.closest('.admin-photo-thumb')?.remove();

  if (!el.existingImages.querySelector('.admin-photo-thumb')) {
    el.existingImages.innerHTML = '<div class="admin-photo-empty">No photos will remain after saving.</div>';
  }
});

el.productDialog.addEventListener('click', (event) => {
  if (event.target === el.productDialog) closeProductDialog();
});

el.categoryDialog.addEventListener('click', (event) => {
  if (event.target === el.categoryDialog) closeCategoryDialog();
});

async function init() {
  try {
    const auth = await requireAuthorizedAdmin();
    if (!auth) return;

    state.profile = auth.profile;
    const displayName = auth.profile.display_name?.trim();
    el.adminIdentity.textContent = displayName
      ? `Authorized as ${displayName}`
      : 'Authorized as billsadmin';

    await loadCategories();
    await loadProducts();

    el.loading.hidden = true;
    el.app.hidden = false;
  } catch (error) {
    console.error('Admin initialization failed:', error);
    el.loading.innerHTML = `
      <h1>Unable to load product manager</h1>
      <p>${escapeHtml(error.message || 'Unknown error')}</p>
      <p><a href="admin-login.html">Return to login</a></p>
    `;
  }
}

init();