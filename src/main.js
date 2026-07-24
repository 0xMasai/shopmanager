import './style.css';
import { initAuth, logout, makeAdapter } from './auth.js';
import { renderLogin } from './views/login.js';
import { renderSell } from './views/sell.js';
import { renderStock } from './views/stock.js';
import { renderDayClose } from './views/dayclose.js';
import { renderReports } from './views/reports.js';
import { renderItems } from './views/items.js';
import { esc } from './ui.js';

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
  if (user.error === 'no-profile') {
    app.innerHTML = `
      <div class="center-msg">
        <h2>Almost there</h2>
        <p class="muted">Your login works, but this account has no profile yet.
        Ask the administrator to create a <code>users/${esc(user.uid)}</code> document
        with your name, role and shopId.</p>
      </div>`;
    return;
  }
  const db = await makeAdapter(user);
  ctx = { user, db };
  mountShell();
  route();
});

function allowedRoutes() {
  return Object.entries(ROUTES).filter(([, r]) => !r.ownerOnly || ctx.user.role === 'owner');
}

function mountShell() {
  app.innerHTML = `
    <header class="topbar">
      <span class="brand">📱 Shop Manager</span>
      <span class="who">${esc(ctx.user.name)}
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
