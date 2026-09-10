import { supabase, getPublicImageUrl } from './supabase-client.js';

const rentalId = new URLSearchParams(window.location.search).get('id');

const el = {
  loading: document.getElementById('rentalDetailLoading'),
  detail: document.getElementById('rentalDetail'),
  notFound: document.getElementById('rentalNotFound'),
  mainImage: document.getElementById('rentalMainImage'),
  thumbnails: document.getElementById('rentalThumbnails'),
  badges: document.getElementById('rentalDetailBadges'),
  name: document.getElementById('rentalDetailName'),
  price: document.getElementById('rentalDetailPrice'),
  meta: document.getElementById('rentalMeta'),
  description: document.getElementById('rentalDetailDescription'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatRate(rental) {
  if (rental.call_for_price || rental.price === null || rental.price === undefined) {
    return 'Call for Rental Rate';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number(rental.price) % 1 === 0 ? 0 : 2,
  }).format(Number(rental.price));
}

function statusLabel(status) {
  return {
    active: 'Available',
    out_of_stock: 'Unavailable',
    sold: 'Unavailable',
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

function setMainImage(image, rentalName) {
  if (!image) {
    el.mainImage.innerHTML = '<div class="product-detail-placeholder">No Photo Available</div>';
    return;
  }

  el.mainImage.innerHTML = `
    <img src="${escapeHtml(getPublicImageUrl(image.storage_path))}" alt="${escapeHtml(image.alt_text || rentalName)}" />
  `;
}

function renderRental(rental) {
  const images = [...(rental.product_images || [])]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  const primaryImage = images.find((image) => image.is_primary) || images[0];
  setMainImage(primaryImage, rental.name);

  el.thumbnails.innerHTML = images.length > 1
    ? images.map((image, index) => `
        <button type="button" class="product-thumb ${image.id === primaryImage?.id ? 'active' : ''}" data-index="${index}">
          <img src="${escapeHtml(getPublicImageUrl(image.storage_path))}" alt="${escapeHtml(image.alt_text || rental.name)}" />
        </button>
      `).join('')
    : '';

  el.badges.innerHTML = `
    ${rental.featured ? '<span class="product-detail-badge featured">Featured</span>' : ''}
    <span class="product-detail-badge status-${escapeHtml(rental.status)}">${escapeHtml(statusLabel(rental.status))}</span>
  `;

  el.name.textContent = rental.name;
  document.title = `${rental.name} Rental | Bill's Equipment`;
  el.price.textContent = formatRate(rental);

  const metaRows = [
    ['Brand', rental.brand],
    ['Model', rental.model],
    ['Category', rental.categories?.name],
    ['Condition', conditionLabel(rental.condition)],
    ['SKU', rental.sku],
  ].filter(([, value]) => value);

  el.meta.innerHTML = metaRows.map(([label, value]) => `
    <div class="product-meta-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `).join('');

  el.description.textContent =
    rental.description?.trim() ||
    'Contact Billâ€™s Equipment for rental availability, rates, and additional information.';

  el.thumbnails.addEventListener('click', (event) => {
    const button = event.target.closest('[data-index]');
    if (!button) return;

    const image = images[Number(button.dataset.index)];
    if (!image) return;

    setMainImage(image, rental.name);
    el.thumbnails.querySelectorAll('.product-thumb').forEach((thumb) => {
      thumb.classList.toggle('active', thumb === button);
    });
  });

  el.loading.hidden = true;
  el.detail.hidden = false;
  el.notFound.hidden = true;
}

async function loadRental() {
  if (!rentalId) {
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
    .eq('id', rentalId)
    .eq('is_published', true)
    .neq('status', 'hidden')
    .in('listing_type', ['rental', 'both'])
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    showNotFound();
    return;
  }

  renderRental(data);
}

loadRental().catch((error) => {
  console.error('Unable to load rental:', error);
  showNotFound();
});