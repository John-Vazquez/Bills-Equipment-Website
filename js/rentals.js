import { supabase, getPublicImageUrl } from './supabase-client.js';

const state = {
  rentals: [],
  categories: [],
  selectedCategory: null,
  selectedBrand: null,
};

const el = {
  rentalSearch: document.getElementById('rentalSearch'),
  rentalSort: document.getElementById('rentalSort'),
  availableOnly: document.getElementById('availableOnly'),
  categoryFilterList: document.getElementById('categoryFilterList'),
  brandFilterList: document.getElementById('brandFilterList'),
  clearCategoryFilter: document.getElementById('clearCategoryFilter'),
  clearBrandFilter: document.getElementById('clearBrandFilter'),
  clearAllFilters: document.getElementById('clearAllFilters'),
  resultCount: document.getElementById('resultCount'),
  catalogMessage: document.getElementById('catalogMessage'),
  rentalsGrid: document.getElementById('rentalsGrid'),
  catalogEmpty: document.getElementById('catalogEmpty'),
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
    return 'Call for Rate';
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

async function loadCatalog() {
  el.catalogMessage.textContent = 'Loading rentals...';

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
    .eq('is_published', true)
    .neq('status', 'hidden')
    .in('listing_type', ['rental', 'both'])
    .order('display_order', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) throw error;

  state.rentals = (data || []).map((rental) => ({
    ...rental,
    product_images: [...(rental.product_images || [])]
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
  }));

  state.categories = [...new Map(
    state.rentals
      .filter((rental) => rental.categories?.id && rental.categories?.name)
      .map((rental) => [rental.categories.id, rental.categories])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  el.catalogMessage.textContent = '';
  renderFilters();
  renderRentals();
}

function renderFilters() {
  el.categoryFilterList.innerHTML = state.categories.length
    ? state.categories.map((category) => `
        <button type="button"
          class="catalog-filter-button ${state.selectedCategory === category.id ? 'active' : ''}"
          data-filter-type="category"
          data-value="${category.id}">
          ${escapeHtml(category.name)}
        </button>
      `).join('')
    : '<span class="catalog-filter-empty">No rental categories yet</span>';

  const brands = [...new Set(
    state.rentals.map((rental) => rental.brand?.trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  el.brandFilterList.innerHTML = brands.length
    ? brands.map((brand) => `
        <button type="button"
          class="catalog-filter-button ${state.selectedBrand === brand ? 'active' : ''}"
          data-filter-type="brand"
          data-value="${escapeHtml(brand)}">
          ${escapeHtml(brand)}
        </button>
      `).join('')
    : '<span class="catalog-filter-empty">No rental brands yet</span>';
}

function normalizedRate(rental) {
  if (rental.call_for_price || rental.price === null || rental.price === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return Number(rental.price);
}

function filteredRentals() {
  const term = el.rentalSearch.value.trim().toLowerCase();

  let rentals = state.rentals.filter((rental) => {
    const haystack = [
      rental.name,
      rental.brand,
      rental.model,
      rental.sku,
      rental.categories?.name,
      rental.description,
    ].filter(Boolean).join(' ').toLowerCase();

    return (
      (!term || haystack.includes(term)) &&
      (!state.selectedCategory || rental.category_id === state.selectedCategory) &&
      (!state.selectedBrand || rental.brand === state.selectedBrand) &&
      (!el.availableOnly.checked || rental.status === 'active')
    );
  });

  switch (el.rentalSort.value) {
    case 'name-asc':
      rentals.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'price-asc':
      rentals.sort((a, b) => normalizedRate(a) - normalizedRate(b));
      break;
    case 'price-desc':
      rentals.sort((a, b) => normalizedRate(b) - normalizedRate(a));
      break;
    case 'newest':
      rentals.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      break;
    default:
      rentals.sort((a, b) =>
        Number(a.display_order || 0) - Number(b.display_order || 0) ||
        Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
        new Date(b.updated_at) - new Date(a.updated_at)
      );
  }

  return rentals;
}

function renderRentals() {
  const rentals = filteredRentals();

  el.resultCount.textContent = `${rentals.length} rental${rentals.length === 1 ? '' : 's'}`;
  el.catalogEmpty.hidden = rentals.length > 0;

  el.rentalsGrid.innerHTML = rentals.map((rental) => {
    const primaryImage =
      rental.product_images.find((image) => image.is_primary) ||
      rental.product_images[0];

    const imageHtml = primaryImage
      ? `<img src="${escapeHtml(getPublicImageUrl(primaryImage.storage_path))}" alt="${escapeHtml(primaryImage.alt_text || rental.name)}" loading="lazy" />`
      : '<div class="public-product-placeholder"><span>No Photo</span></div>';

    const unavailableClass = rental.status === 'active' ? '' : ' is-sold';

    return `
      <a class="public-product-card${unavailableClass}" href="rentalDesc.html?id=${encodeURIComponent(rental.id)}">
        <div class="public-product-image">
          ${imageHtml}
          ${rental.featured ? '<span class="public-featured-badge">Featured</span>' : ''}
          ${rental.status !== 'active' ? `<span class="public-status-badge">${escapeHtml(statusLabel(rental.status))}</span>` : ''}
        </div>

        <div class="public-product-body">
          <div class="public-product-category">${escapeHtml(rental.categories?.name || 'Rental Equipment')}</div>
          <h3>${escapeHtml(rental.name)}</h3>

          <div class="public-product-meta">
            ${rental.brand ? `<span>${escapeHtml(rental.brand)}</span>` : ''}
            ${rental.model ? `<span>${escapeHtml(rental.model)}</span>` : ''}
          </div>

          <div class="public-product-bottom">
            <strong>${escapeHtml(formatRate(rental))}</strong>
            <span class="public-view-link">View Details â†’</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

function clearFilters() {
  state.selectedCategory = null;
  state.selectedBrand = null;
  el.rentalSearch.value = '';
  el.rentalSort.value = 'display';
  el.availableOnly.checked = false;
  renderFilters();
  renderRentals();
}

el.rentalSearch.addEventListener('input', renderRentals);
el.rentalSort.addEventListener('change', renderRentals);
el.availableOnly.addEventListener('change', renderRentals);

el.categoryFilterList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter-type="category"]');
  if (!button) return;

  state.selectedCategory = state.selectedCategory === button.dataset.value
    ? null
    : button.dataset.value;

  renderFilters();
  renderRentals();
});

el.brandFilterList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter-type="brand"]');
  if (!button) return;

  state.selectedBrand = state.selectedBrand === button.dataset.value
    ? null
    : button.dataset.value;

  renderFilters();
  renderRentals();
});

el.clearCategoryFilter.addEventListener('click', () => {
  state.selectedCategory = null;
  renderFilters();
  renderRentals();
});

el.clearBrandFilter.addEventListener('click', () => {
  state.selectedBrand = null;
  renderFilters();
  renderRentals();
});

el.clearAllFilters.addEventListener('click', clearFilters);

loadCatalog().catch((error) => {
  console.error('Unable to load public rentals:', error);
  el.catalogMessage.textContent = 'Unable to load rentals right now. Please try again shortly.';
  el.resultCount.textContent = '';
});