import { supabase, getPublicImageUrl } from './supabase-client.js';

const state = {
  products: [],
  categories: [],
  selectedCategory: null,
  selectedBrand: null,
};

const el = {
  productSearch: document.getElementById('productSearch'),
  productSort: document.getElementById('productSort'),
  availableOnly: document.getElementById('availableOnly'),
  categoryFilterList: document.getElementById('categoryFilterList'),
  brandFilterList: document.getElementById('brandFilterList'),
  clearCategoryFilter: document.getElementById('clearCategoryFilter'),
  clearBrandFilter: document.getElementById('clearBrandFilter'),
  clearAllFilters: document.getElementById('clearAllFilters'),
  resultCount: document.getElementById('resultCount'),
  catalogMessage: document.getElementById('catalogMessage'),
  productsGrid: document.getElementById('productsGrid'),
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

function formatPrice(product) {
  if (product.call_for_price) return 'Call for Price';
  if (product.price === null || product.price === undefined) return 'Call for Price';

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

async function loadCatalog() {
  el.catalogMessage.textContent = 'Loading products...';

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
    .in('listing_type', ['product', 'both'])
    .order('display_order', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) throw error;

  state.products = (data || []).map((product) => ({
    ...product,
    product_images: [...(product.product_images || [])]
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
  }));

  state.categories = [...new Map(
    state.products
      .filter((product) => product.categories?.id && product.categories?.name)
      .map((product) => [product.categories.id, product.categories])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  el.catalogMessage.textContent = '';
  renderFilters();
  renderProducts();
}

function renderFilters() {
  el.categoryFilterList.innerHTML = state.categories.length
    ? state.categories.map((category) => `
        <button
          type="button"
          class="catalog-filter-button ${state.selectedCategory === category.id ? 'active' : ''}"
          data-filter-type="category"
          data-value="${category.id}">
          ${escapeHtml(category.name)}
        </button>
      `).join('')
    : '<span class="catalog-filter-empty">No categories yet</span>';

  const brands = [...new Set(
    state.products
      .map((product) => product.brand?.trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  el.brandFilterList.innerHTML = brands.length
    ? brands.map((brand) => `
        <button
          type="button"
          class="catalog-filter-button ${state.selectedBrand === brand ? 'active' : ''}"
          data-filter-type="brand"
          data-value="${escapeHtml(brand)}">
          ${escapeHtml(brand)}
        </button>
      `).join('')
    : '<span class="catalog-filter-empty">No brands yet</span>';
}

function filteredProducts() {
  const term = el.productSearch.value.trim().toLowerCase();

  let products = state.products.filter((product) => {
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

    const matchesSearch = !term || haystack.includes(term);
    const matchesCategory = !state.selectedCategory || product.category_id === state.selectedCategory;
    const matchesBrand = !state.selectedBrand || product.brand === state.selectedBrand;
    const matchesAvailability = !el.availableOnly.checked || product.status === 'active';

    return matchesSearch && matchesCategory && matchesBrand && matchesAvailability;
  });

  switch (el.productSort.value) {
    case 'name-asc':
      products.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'price-asc':
      products.sort((a, b) => normalizedPrice(a) - normalizedPrice(b));
      break;
    case 'price-desc':
      products.sort((a, b) => normalizedPrice(b) - normalizedPrice(a));
      break;
    case 'newest':
      products.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      break;
    default:
      products.sort((a, b) =>
        Number(a.display_order || 0) - Number(b.display_order || 0) ||
        Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
        new Date(b.updated_at) - new Date(a.updated_at)
      );
  }

  return products;
}

function normalizedPrice(product) {
  if (product.call_for_price || product.price === null || product.price === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return Number(product.price);
}

function renderProducts() {
  const products = filteredProducts();

  el.resultCount.textContent = `${products.length} product${products.length === 1 ? '' : 's'}`;
  el.catalogEmpty.hidden = products.length > 0;

  el.productsGrid.innerHTML = products.map((product) => {
    const primaryImage =
      product.product_images.find((image) => image.is_primary) ||
      product.product_images[0];

    const imageHtml = primaryImage
      ? `<img src="${escapeHtml(getPublicImageUrl(primaryImage.storage_path))}" alt="${escapeHtml(primaryImage.alt_text || product.name)}" loading="lazy" />`
      : `<div class="public-product-placeholder">
           <span>No Photo</span>
         </div>`;

    const soldClass = product.status === 'sold' ? ' is-sold' : '';

    return `
      <a class="public-product-card${soldClass}" href="productDesc.html?id=${encodeURIComponent(product.id)}">
        <div class="public-product-image">
          ${imageHtml}
          ${product.featured ? '<span class="public-featured-badge">Featured</span>' : ''}
          ${product.status !== 'active' ? `<span class="public-status-badge">${escapeHtml(statusLabel(product.status))}</span>` : ''}
        </div>

        <div class="public-product-body">
          <div class="public-product-category">${escapeHtml(product.categories?.name || 'Equipment')}</div>
          <h3>${escapeHtml(product.name)}</h3>

          <div class="public-product-meta">
            ${product.brand ? `<span>${escapeHtml(product.brand)}</span>` : ''}
            ${product.model ? `<span>${escapeHtml(product.model)}</span>` : ''}
          </div>

          <div class="public-product-bottom">
            <strong>${escapeHtml(formatPrice(product))}</strong>
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
  el.productSearch.value = '';
  el.productSort.value = 'display';
  el.availableOnly.checked = false;
  renderFilters();
  renderProducts();
}

el.productSearch.addEventListener('input', renderProducts);
el.productSort.addEventListener('change', renderProducts);
el.availableOnly.addEventListener('change', renderProducts);

el.categoryFilterList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter-type="category"]');
  if (!button) return;

  state.selectedCategory = state.selectedCategory === button.dataset.value
    ? null
    : button.dataset.value;

  renderFilters();
  renderProducts();
});

el.brandFilterList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter-type="brand"]');
  if (!button) return;

  state.selectedBrand = state.selectedBrand === button.dataset.value
    ? null
    : button.dataset.value;

  renderFilters();
  renderProducts();
});

el.clearCategoryFilter.addEventListener('click', () => {
  state.selectedCategory = null;
  renderFilters();
  renderProducts();
});

el.clearBrandFilter.addEventListener('click', () => {
  state.selectedBrand = null;
  renderFilters();
  renderProducts();
});

el.clearAllFilters.addEventListener('click', clearFilters);

loadCatalog().catch((error) => {
  console.error('Unable to load public products:', error);
  el.catalogMessage.textContent = 'Unable to load products right now. Please try again shortly.';
  el.resultCount.textContent = '';
});