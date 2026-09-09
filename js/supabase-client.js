import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SITE_URL } from './supabase-config.js';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Supabase is not configured. Update js/supabase-config.js.');
}

if (!window.supabase?.createClient) {
  throw new Error('Supabase JavaScript library failed to load.');
}

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const siteUrl = SITE_URL.replace(/\/$/, '');
export const PRODUCT_IMAGE_BUCKET = 'bills-product-images';

export function getPublicImageUrl(path) {
  if (!path) return '';
  return supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
