import { supabase, getPublicImageUrl } from './supabase-client.js';

const productId = new URLSearchParams(window.location.search).get('id');

const el = {
  loading: document.getElementById('productDetailLoading'),
  detail: document.getElementById('productDetail'),
  notFound: document.getElementById('productNotFound'),
  mainImage: document.getElementById('productMainImage'),
  thumbnails: document.getElementById('productThumbnails'),
  badges: document.getElementById('productDetailBadges'),
  name: document.getElementById('productDetailName'),
  price: document.getElementById('productDetailPrice'),
  meta: document.getElementById('productMeta'),
  description: document.getElementById('productDetailDescription'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatPrice(product) {
  if (product.call_for_price || product.price === null || product.price === undefined) {
    return 'Call for Price';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number(product.price) % 1 === 0 ? 0 : 2,
  }).format(Number(product.price));
}

function statusLabel(status) {
  return {
    active: 'Available',
    out_of_stock: 'Out of Stock',
    sold: 'Sold',
  }[status] || status;
}

function conditionLabel(condition) {
  return {
    unspecified: 'Not specified',
    new: 'New',
    used: 'Used',
    refurbished: 'Refurbished',
  }[condition] || condition;
}

function showNotFound() {
  el.loading.hidden = true;
  el.detail.hidden = true;
  el.notFound.hidden = false;
}

function setMainImage(image, productName) {
  if (!image) {
    el.mainImage.innerHTML = '<div class="product-detail-placeholder">No Photo Available</div>';
    return;
  }

  el.mainImage.innerHTML = `
    <img src="${escapeHtml(getPublicImageUrl(image.storage_path))}" alt="${escapeHtml(image.alt_text || productName)}" />
  `;
}

function renderProduct(product) {
  const images = [...(product.product_images || [])]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  const primaryImage = images.find((image) => image.is_primary) || images[0];
  setMainImage(primaryImage, product.name);

  el.thumbnails.innerHTML = images.length > 1
    ? images.map((image, index) => `
        <button type="button" class="product-thumb ${image.id === primaryImage?.id ? 'active' : ''}" data-index="${index}">
          <img src="${escapeHtml(getPublicImageUrl(image.storage_path))}" alt="${escapeHtml(image.alt_text || product.name)}" />
        </button>
      `).join('')
    : '';

  el.badges.innerHTML = `
    ${product.featured ? '<span class="product-detail-badge featured">Featured</span>' : ''}
    <span class="product-detail-badge status-${escapeHtml(product.status)}">${escapeHtml(statusLabel(product.status))}</span>
  `;

  el.name.textContent = product.name;
  document.title = `${product.name} | Bill's Equipment`;
  el.price.textContent = formatPrice(product);

  const metaRows = [
    ['Brand', product.brand],
    ['Model', product.model],
    ['Category', product.categories?.name],
    ['Condition', conditionLabel(product.condition)],
    ['SKU', product.sku],
    ['Quantity', product.quantity !== null && product.quantity !== undefined ? String(product.quantity) : null],
  ].filter(([, value]) => value);

  el.meta.innerHTML = metaRows.map(([label, value]) => `
    <div class="product-meta-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `).join('');

  el.description.textContent = product.description?.trim() || 'Contact Billâ€™s Equipment for additional information about this product.';

  el.thumbnails.addEventListener('click', (event) => {
    const button = event.target.closest('[data-index]');
    if (!button) return;

    const image = images[Number(button.dataset.index)];
    if (!image) return;

    setMainImage(image, product.name);

    el.thumbnails.querySelectorAll('.product-thumb').forEach((thumb) => {
      thumb.classList.toggle('active', thumb === button);
    });
  });

  el.loading.hidden = true;
  el.detail.hidden = false;
  el.notFound.hidden = true;
}

async function loadProduct() {
  if (!productId) {
    showNotFound();
    return;
  }

  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      description,
      brand,
      model,
      sku,
      listing_type,
      condition,
      price,
      call_for_price,
      quantity,
      status,
      featured,
      is_published,
      categories ( id, name ),
      product_images (
        id,
        storage_path,
        alt_text,
        sort_order,
        is_primary
      )
    `)
    .eq('id', productId)
    .eq('is_published', true)
    .neq('status', 'hidden')
    .in('listing_type', ['product', 'both'])
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    showNotFound();
    return;
  }

  renderProduct(data);
}

loadProduct().catch((error) => {
  console.error('Unable to load product:', error);
  showNotFound();
});