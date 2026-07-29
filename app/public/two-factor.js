const isSetup = location.pathname.startsWith('/two-factor-setup');
const error = document.querySelector('.auth-error');
const showError = message => { error.textContent = message; error.hidden = false; };

async function api(url, options = {}) {
  const response = await fetch(url, { headers: {'Content-Type': 'application/json'}, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a verificação.');
  return data;
}

if (isSetup) {
  (async () => {
    const auth = await api('/api/auth/status');
    if (!auth.authenticated) return location.replace('/login');
    if (auth.user.two_factor_enabled || auth.user.two_factor_exempt) return location.replace('/');
    const data = await api('/api/auth/2fa/setup', {method: 'POST', body: '{}'});
    document.querySelector('#twoFactorSecret').textContent = data.secret;
    document.querySelector('#twoFactorQr').src = `/api/auth/2fa/qr?cache=${Date.now()}`;
  })().catch(reason => showError(reason.message));
  document.querySelector('#twoFactorSetupForm').addEventListener('submit', async event => {
    event.preventDefault(); error.hidden = true;
    try { await api('/api/auth/2fa/confirm', {method: 'POST', body: JSON.stringify({code: document.querySelector('#twoFactorSetupCode').value})}); location.replace('/'); }
    catch (reason) { showError(reason.message); }
  });
} else {
  const challenge = sessionStorage.getItem('iea_2fa_challenge');
  if (!challenge) location.replace('/login');
  document.querySelector('#twoFactorForm').addEventListener('submit', async event => {
    event.preventDefault(); error.hidden = true;
    try {
      const data = await api('/api/auth/2fa/verify', {method: 'POST', body: JSON.stringify({challenge, code: document.querySelector('#twoFactorCode').value})});
      sessionStorage.removeItem('iea_2fa_challenge');
      location.replace(data.user.role === 'admin' && data.user.can_admin_portal ? data.user.admin_path : '/');
    } catch (reason) { showError(reason.message); }
  });
}
