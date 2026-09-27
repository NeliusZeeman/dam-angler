// Log in, sign up, and your account (log out / delete) -- opened from the
// title screen. `cloud` is src/cloud.js; `save` the live save object.
import { replaceSave, DEFAULT_SAVE } from './save.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// POPIA: what's kept, why, who sees it, and that it can be deleted.
const PRIVACY = `
  <details class="acct-privacy">
    <summary>Privacy notice — what we keep</summary>
    <p>To save your game online we keep your <b>email</b>, <b>username</b> and a scrambled
    (hashed) copy of your <b>password</b> — never the password itself — plus your game:
    credits, tackle, settings and every fish you land.</p>
    <p><b>Why:</b> so you can log in on any phone, tablet or PC and carry on, and for the
    dam records. <b>Who sees it:</b> only your username and your catches appear on the
    public dam records; your email is never shown or shared.</p>
    <p>Stored on our server in South Africa. You can delete your account and everything
    in it at any time from this screen (POPIA).</p>
  </details>`;

export function showAccountPanel(container, { cloud, save, onChanged = () => {} }) {
  const wrap = document.createElement('div');
  wrap.className = 'acct-wrap';
  container.appendChild(wrap);
  let mode = cloud.user() ? 'account' : 'login';
  let busy = false;
  let message = '';

  const close = () => wrap.remove();
  const hasGuestProgress = () => save.credits > 0 || Object.keys(save.catchLog || {}).length > 0
    || ['ownedRodIds', 'ownedLineIds', 'ownedReelIds', 'ownedHookIds', 'ownedLureIds'].some((f) => (save[f] || []).length > 1);

  function formHtml() {
    if (mode === 'account') {
      const u = cloud.user();
      return `
        <h2>Your account</h2>
        <p class="acct-lead">Signed in as <b>${esc(u?.username)}</b>. Your game is saved online —
        log in on any device to carry on.</p>
        <button type="button" class="acct-btn acct-primary" data-act="logout">Log out</button>
        <details class="acct-danger">
          <summary>Delete my account</summary>
          <p>This removes your account, your saved game and all your catches for good.</p>
          <label>Password <input name="password" type="password" autocomplete="current-password"></label>
          <button type="button" class="acct-btn acct-delete" data-act="delete">Delete everything</button>
        </details>`;
    }
    const signup = mode === 'signup';
    return `
      <div class="acct-tabs" role="tablist">
        <button type="button" role="tab" class="${signup ? '' : 'on'}" data-mode="login">Log in</button>
        <button type="button" role="tab" class="${signup ? 'on' : ''}" data-mode="signup">Sign up</button>
      </div>
      <p class="acct-lead">${signup
    ? 'Save your game online and play on your phone, tablet and PC.'
    : 'Carry on where you left off, on any device.'}</p>
      <form class="acct-form" novalidate>
        ${signup ? `
          <label>Email <input name="email" type="email" autocomplete="email" required></label>
          <label>Username <small>shown on dam records · 3–20 letters, numbers or _</small>
            <input name="username" autocomplete="username" required minlength="3" maxlength="20"></label>
          <label>Password <small>at least 8 characters</small>
            <input name="password" type="password" autocomplete="new-password" required minlength="8"></label>
          ${PRIVACY}
          <label class="acct-agree"><input name="agree" type="checkbox"> I've read the privacy notice and agree</label>
          ${hasGuestProgress() ? '<p class="acct-note">Your progress on this device comes with you into the new account.</p>' : ''}
        ` : `
          <label>Email or username <input name="login" autocomplete="username" required></label>
          <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
          ${hasGuestProgress() ? '<p class="acct-note">Logging in loads your account\'s game — progress played as a guest on this device is replaced.</p>' : ''}
        `}
        <button type="submit" class="acct-btn acct-primary">${signup ? 'Create account' : 'Log in'}</button>
      </form>`;
  }

  function render() {
    wrap.innerHTML = `
      <div class="acct-card" role="dialog" aria-modal="true" aria-label="Account">
        <button type="button" class="acct-close" data-act="close" aria-label="Close">×</button>
        ${formHtml()}
        <p class="acct-msg" role="status">${esc(message)}</p>
      </div>`;
    wrap.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; message = ''; render(); }));
    wrap.querySelector('[data-act="close"]').addEventListener('click', close);
    wrap.querySelector('form')?.addEventListener('submit', (e) => { e.preventDefault(); submit(new FormData(e.target)); });
    wrap.querySelector('[data-act="logout"]')?.addEventListener('click', logout);
    wrap.querySelector('[data-act="delete"]')?.addEventListener('click', () => remove(wrap.querySelector('input[name="password"]').value));
    wrap.querySelector('input')?.focus();
  }

  // Shows a message without redrawing the form (what you typed stays).
  function say(text) {
    message = text;
    const el = wrap.querySelector('.acct-msg');
    if (el) el.textContent = text;
  }

  async function run(fn) {
    if (busy) return;
    busy = true;
    say('One moment…');
    try {
      await fn();
    } catch (err) {
      say(err.status ? err.message : 'Can\'t reach the server — check your connection and try again.');
    } finally {
      busy = false;
    }
  }

  function submit(form) {
    run(async () => {
      if (mode === 'signup') {
        if (!form.get('agree')) { say('Please read and accept the privacy notice.'); return; }
        const data = await cloud.signup({
          email: form.get('email'), username: form.get('username'), password: form.get('password'), agree: true,
        }, save);
        replaceSave(save, data.save);
      } else {
        const data = await cloud.login(form.get('login'), form.get('password'));
        replaceSave(save, data.save);
      }
      close();
      onChanged();
    });
  }

  function logout() {
    run(async () => {
      await cloud.logout();
      // This device goes back to a fresh guest game; the account's game is
      // safe on the server. Settings (sound, graphics) stay.
      replaceSave(save, { ...DEFAULT_SAVE, settings: save.settings });
      close();
      onChanged();
    });
  }

  function remove(password) {
    run(async () => {
      await cloud.deleteAccount(password);
      replaceSave(save, { ...DEFAULT_SAVE, settings: save.settings });
      close();
      onChanged();
    });
  }

  render();
  return { close };
}
