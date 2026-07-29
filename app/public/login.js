const page = location.pathname;
const endpoint = page.startsWith('/setup') ? '/api/auth/setup' : page.startsWith('/forgot-password') ? '/api/auth/request-password-reset' : page.startsWith('/change-password') ? '/api/auth/change-password' : '/api/auth/login';
const form = document.querySelector('form');
const error = document.querySelector('.auth-error');
const intro = document.querySelector('#loginIntro');
const screen = document.querySelector('#loginScreen');
if (intro && screen) {
  window.setTimeout(() => { intro.classList.add('leave'); screen.removeAttribute('aria-hidden'); document.querySelector('#email')?.focus(); }, 3200);
  document.querySelector('#loginYear').textContent = new Date().getFullYear();
  document.querySelector('#togglePassword')?.addEventListener('click', () => {
    const field = document.querySelector('#password'); const visible = field.type === 'text'; field.type = visible ? 'password' : 'text'; document.querySelector('#togglePassword').classList.toggle('is-visible', !visible); document.querySelector('#togglePassword').setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
  });
}
form.addEventListener('submit', async event => {
  event.preventDefault(); error.hidden = true;
  const password = document.querySelector('#password')?.value;
  const payload = endpoint.endsWith('setup') ? { setup_token: document.querySelector('#setupToken').value, password } : endpoint.endsWith('request-password-reset') ? { email: document.querySelector('#email').value.trim() } : endpoint.endsWith('change-password') ? { password } : { email: document.querySelector('#email').value.trim(), password };
  if ((endpoint.endsWith('setup') || endpoint.endsWith('change-password')) && password !== document.querySelector('#confirmation').value) { error.textContent = 'As senhas não coincidem.'; error.hidden = false; return; }
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.');
    if (endpoint.endsWith('setup')) { location.href = '/login'; return; }
    if (endpoint.endsWith('request-password-reset')) { error.textContent = data.message; error.style.color = '#2f7351'; error.hidden = false; form.reset(); return; }
    if (endpoint.endsWith('change-password')) { location.href = '/'; return; }
    if (data.two_factor_required) { sessionStorage.setItem('iea_2fa_challenge', data.challenge); location.href = '/two-factor'; return; }
    if (data.two_factor_setup_required) { location.href = '/two-factor-setup'; return; }
    location.href = data.user.role === 'crc' ? '/central-crc' : (data.user.role === 'admin' && data.user.can_admin_portal ? data.user.admin_path : '/');
  } catch (reason) { error.textContent = reason.message; error.hidden = false; }
});
