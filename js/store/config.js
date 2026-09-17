/** Public defaults only. No secrets belong in this file. Employee settings override these after migration. */
export const RELEASE = 'bills-catalog-20260917-r1';
export const DEFAULT_SETTINGS = Object.freeze({
  phone_main: '305-591-3933',
  phone_sales: '954-789-9459', // Existing product/rental number; retained until the owner confirms it.
  email: 'earenas@billsequipment.net',
  address: '3500 NW 115th Ave, Doral, FL 33178',
  tagline: 'If you need it, Bill’s has it!',
  hero_title: 'Built for the Jobsite',
  hero_subtitle: 'Sales  |  Rentals  |  Parts  |  Expert Support',
  hero_image_path: '',
  enquiries_enabled: false,
  turnstile_site_key: '',
});
export const DEFAULT_CATALOGS = [
  {id:'construction', slug:'construction', name:'Construction', sort_order:10},
  {id:'concrete', slug:'concrete', name:'Concrete', sort_order:20},
  {id:'equipment', slug:'equipment', name:'Equipment', sort_order:30},
  {id:'small-engine', slug:'small-engine', name:'Small Engine', sort_order:40},
  {id:'pressure-washing', slug:'pressure-washing', name:'Pressure Washing', sort_order:50},
  {id:'shop-supplies', slug:'shop-supplies', name:'Shop Supplies', sort_order:60},
].map(c => ({...c, active:true, description:''}));
export const PRODUCT_BUCKET = 'bills-product-images';
export const MEDIA_BUCKET = 'bills-site-media';
export const MAX_CART_LINES = 50;
export const MAX_QUANTITY = 99;
export const PAGE_SIZE = 24;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES = 12;

// Local preview is read-only even when it points at the real public catalog.
export const LOCAL_PREVIEW = ['localhost','127.0.0.1','[::1]'].includes(globalThis.location?.hostname);
