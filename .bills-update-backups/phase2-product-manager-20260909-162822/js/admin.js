import { supabase } from './supabase-client.js';

const loading = document.getElementById('adminLoading');
const app = document.getElementById('adminApp');
const logoutButton = document.getElementById('logoutButton');
const productCount = document.getElementById('productCount');
const categoryCount = document.getElementById('categoryCount');
const imageCount = document.getElementById('imageCount');
const adminIdentity = document.getElementById('adminIdentity');

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

  if (
    profileError ||
    !profile ||
    !['admin', 'editor'].includes(profile.role)
  ) {
    await supabase.auth.signOut();
    redirectToLogin('unauthorized');
    return null;
  }

  return { session, profile };
}

async function getCount(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count ?? 0;
}

async function loadDashboard() {
  try {
    const auth = await requireAuthorizedAdmin();
    if (!auth) return;

    const [products, categories, images] = await Promise.all([
      getCount('products'),
      getCount('categories'),
      getCount('product_images'),
    ]);

    productCount.textContent = String(products);
    categoryCount.textContent = String(categories);
    imageCount.textContent = String(images);

    const displayName = auth.profile.display_name?.trim();
    adminIdentity.textContent = displayName
      ? `Authorized as ${displayName}`
      : 'Authorized as billsadmin';

    loading.hidden = true;
    app.hidden = false;
  } catch (error) {
    console.error('Admin dashboard failed to load:', error);
    loading.innerHTML = `
      <h1>Unable to load admin dashboard</h1>
      <p>${String(error.message || 'Unknown error')}</p>
      <p><a href="admin-login.html">Return to login</a></p>
    `;
  }
}

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;

  try {
    await supabase.auth.signOut();
  } finally {
    window.location.replace('admin-login.html');
  }
});

loadDashboard();