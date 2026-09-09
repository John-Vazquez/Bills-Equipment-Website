import { supabase } from './supabase-client.js';

// Staff use only this username. Supabase still uses an internal email-shaped
// identifier behind the scenes so its secure Auth + RLS system can protect writes.
const MASTER_USERNAME = 'billsadmin';
const INTERNAL_AUTH_EMAIL = 'billsadmin@auth.billsequipmentandrentals.com';

const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const loginMessage = document.getElementById('loginMessage');

function setMessage(message, type = '') {
  loginMessage.textContent = message || '';
  loginMessage.className = `form-message ${type}`.trim();
}

async function userIsAdmin(userId) {
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('id, active')
    .eq('id', userId)
    .eq('active', true)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function redirectExistingAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  try {
    if (await userIsAdmin(session.user.id)) {
      window.location.replace('admin.html');
    } else {
      await supabase.auth.signOut();
    }
  } catch (error) {
    console.error(error);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');
  loginButton.disabled = true;
  loginButton.textContent = 'Signing inâ€¦';

  try {
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (username !== MASTER_USERNAME) {
      throw new Error('Invalid username or password.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: INTERNAL_AUTH_EMAIL,
      password,
    });

    if (error) throw new Error('Invalid username or password.');

    if (!data.user || !(await userIsAdmin(data.user.id))) {
      await supabase.auth.signOut();
      throw new Error('This account is not authorized for the inventory dashboard.');
    }

    window.location.replace('admin.html');
  } catch (error) {
    setMessage(error.message || 'Unable to sign in.', 'error');
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Sign In';
  }
});

const reason = new URLSearchParams(window.location.search).get('reason');
if (reason === 'unauthorized') {
  setMessage('This session is not authorized for the inventory dashboard.', 'error');
}

redirectExistingAdmin();
