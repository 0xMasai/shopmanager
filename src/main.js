import './style.css';
import { initAuth, logout, makeAdapter, setupShopFirebase } from './auth.js';
import { renderLogin } from './views/login.js';
import { renderSell } from './views/sell.js';
import { renderStock } from './views/stock.js';
import { renderDayClose } from './views/dayclose.js';
import { renderReports } from './views/reports.js';
import { renderItems } from './views/items.js';
import { esc, toast } from './ui.js';

const app = document.getElementById('app');

const ROUTES = {
  '#/sell': { render: renderSell, label: 'Sell', icon: '🛒' },
  '#/stock': { render: renderStock, label: 'Stock', icon: '📦' },
  '#/close': { render: renderDayClose, label: 'Close', icon: '✅' },
  '#/reports': { render: renderReports, label: 'Reports', icon: '📊', ownerOnly: true },
  '#/items': { render: renderItems, label: 'Items', icon: '🏷️', ownerOnly: true },
};

let ctx = null;
let cleanup = null;

initAuth(async (user) => {
  if (!user) {
    renderLogin(app);
    return;
  }
  if (user.error === 'no-profile' || user.error === 'no-shop') {
    renderShopSetup(user);
    return;
  }
  if (user.error === 'denied' || user.error === 'load-failed') {
    const denied = user.error === 'denied';
    app.innerHTML = `
      <div class="center-msg">
        <h2>Can't load your profile</h2>
        <p class="muted">${
          denied
            ? `Firestore denied access to <code>users/${esc(user.uid)}</code>
               (permission denied). This usually means the security rules haven't
               been deployed, or test-mode rules have expired. Deploy them with
               <code>npm run deploy:rules</code>.`
            : `Something went wrong reading your profile: ${esc(user.detail || '')}.`
        }</p>
        <button id="signout" class="btn-primary">Log out</button>
      </div>`;
    app.querySelector('#signout').addEventListener('click', logout);
    return;
  }
  const db = await makeAdapter(user);
  ctx = { user, db };
  mountShell();
  route();
});

// Shown when a signed-in account isn't linked to a shop yet (no profile, or a
// profile with no shopId). Creates the shop and links the profile in one step —
// the shopId is generated automatically, so there is nothing to type or look up.
function renderShopSetup(user) {
  app.innerHTML = `
    <div class="login">
      <h1>🛍️ Set up your shop</h1>
      <p class="muted">Your login works — create your shop to finish.
      A shop ID is generated automatically.</p>
      <label class="field"><span>Shop name</span>
        <input id="s-shop" class="input" placeholder="e.g. Kampala Phone Point" /></label>
      <label class="field"><span>Your name</span>
        <input id="s-name" class="input" value="${esc(user.name || '')}" /></label>
      <button id="s-go" class="btn-primary btn-big">Create shop</button>
      <p class="auth-switch"><button id="signout">Log out</button></p>
    </div>`;
  const go = async () => {
    const shopName = app.querySelector('#s-shop').value.trim();
    const ownerName = app.querySelector('#s-name').value.trim();
    if (!shopName || !ownerName) return toast('Enter a shop name and your name', false);
    const btn = app.querySelector('#s-go');
    btn.disabled = true;
    try {
      await setupShopFirebase({ shopName, ownerName });
    } catch (err) {
      btn.disabled = false;
      toast(
        err?.code?.includes('permission-denied')
          ? 'Blocked by security rules — deploy them with npm run deploy:rules'
          : 'Could not create the shop — please try again',
        false
      );
    }
  };
  app.querySelector('#s-go').addEventListener('click', go);
  app.querySelector('#signout').addEventListener('click', logout);
}

function allowedRoutes() {
  return Object.entries(ROUTES).filter(([, r]) => !r.ownerOnly || ctx.user.role === 'owner');
}

function mountShell() {
  const initial = (ctx.user.name || '?').trim().charAt(0).toUpperCase() || '?';
  app.innerHTML = `
    <header class="topbar">
      <span class="brand"><span class="brand-mark">🛍️</span> Shop Manager</span>
      <span class="who">
        <span class="avatar">${esc(initial)}</span>
        <span class="who-name">${esc(ctx.user.name)}</span>
        <button id="logout" class="link-btn">Log out</button>
      </span>
    </header>
    <main id="view"></main>
    <nav class="bottom-nav">
      ${allowedRoutes()
        .map(
          ([hash, r]) =>
            `<a href="${hash}" data-hash="${hash}"><span class="nav-icon">${r.icon}</span>${r.label}</a>`
        )
        .join('')}
    </nav>`;
  app.querySelector('#logout').addEventListener('click', logout);
}

function route() {
  const fallback = ctx.user.role === 'owner' ? '#/reports' : '#/sell';
  let r = ROUTES[location.hash];
  if (!r || (r.ownerOnly && ctx.user.role !== 'owner')) {
    history.replaceState(null, '', fallback);
    r = ROUTES[fallback];
  }
  if (typeof cleanup === 'function') cleanup();
  cleanup = r.render(app.querySelector('#view'), ctx) || null;
  app
    .querySelectorAll('.bottom-nav a')
    .forEach((a) => a.classList.toggle('active', a.dataset.hash === location.hash));
}

window.addEventListener('hashchange', () => ctx && route());

// Register the PWA service worker only in a real browser served over http(s).
// In the Electron desktop app the shell is already bundled locally and file://
// has no service-worker support, so we skip it. Offline data works regardless,
// via Firestore's on-device cache (persistentLocalCache).
if (
  !window.desktop?.isElectron &&
  'serviceWorker' in navigator &&
  location.protocol.startsWith('http')
) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {});
}
