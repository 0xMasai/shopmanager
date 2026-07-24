import { esc, fmt, toast, todayStr } from '../ui.js';

export function renderSell(root, ctx) {
  const { db, user } = ctx;
  let items = [];
  const cart = new Map(); // itemId -> qty
  let payment = 'cash';
  let search = '';

  root.innerHTML = `
    <div class="view-sell">
      <input id="search" class="input" placeholder="Search items…" />
      <div id="grid" class="item-grid"></div>
      <div id="cart" class="cart"></div>
    </div>`;

  const grid = root.querySelector('#grid');
  const cartEl = root.querySelector('#cart');

  root.querySelector('#search').addEventListener('input', (e) => {
    search = e.target.value.toLowerCase();
    drawGrid();
  });

  function drawGrid() {
    const list = items.filter((i) => i.name.toLowerCase().includes(search));
    grid.innerHTML =
      list
        .map(
          (i) => `
      <button class="item-card" data-id="${i.id}">
        ${i.photo ? `<img class="item-photo" src="${i.photo}" alt="" />` : ''}
        <span class="item-name">${esc(i.name)}</span>
        <span class="item-price">${fmt(i.price)}</span>
        <span class="item-stock ${i.stockQty <= (i.lowStock ?? 0) ? 'low' : ''}">${i.stockQty} left</span>
      </button>`
        )
        .join('') || '<p class="muted">No items found.</p>';
  }

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.item-card');
    if (!btn) return;
    cart.set(btn.dataset.id, (cart.get(btn.dataset.id) || 0) + 1);
    drawCart();
  });

  function drawCart() {
    if (!cart.size) {
      cartEl.innerHTML = '<p class="muted center">Tap items above to add them to the sale.</p>';
      return;
    }
    let total = 0;
    const rows = [...cart.entries()]
      .map(([id, qty]) => {
        const it = items.find((i) => i.id === id);
        const line = it.price * qty;
        total += line;
        return `
        <div class="cart-row" data-id="${id}">
          <span class="cart-name">${esc(it.name)}</span>
          <span class="qty-controls">
            <button class="qty-btn" data-act="dec">−</button><b>${qty}</b><button class="qty-btn" data-act="inc">+</button>
          </span>
          <span class="cart-line">${fmt(line)}</span>
        </div>`;
      })
      .join('');
    cartEl.innerHTML = `
      ${rows}
      <div class="pay-row">
        <button class="pay-btn ${payment === 'cash' ? 'active' : ''}" data-pay="cash">💵 Cash</button>
        <button class="pay-btn ${payment === 'momo' ? 'active' : ''}" data-pay="momo">📱 Mobile Money</button>
      </div>
      <button id="complete" class="btn-primary btn-big">Complete Sale — ${fmt(total)}</button>`;
  }

  cartEl.addEventListener('click', async (e) => {
    const qtyBtn = e.target.closest('.qty-btn');
    if (qtyBtn) {
      const id = qtyBtn.closest('.cart-row').dataset.id;
      const next = (cart.get(id) || 0) + (qtyBtn.dataset.act === 'inc' ? 1 : -1);
      if (next <= 0) cart.delete(id);
      else cart.set(id, next);
      drawCart();
      return;
    }
    const payBtn = e.target.closest('.pay-btn');
    if (payBtn) {
      payment = payBtn.dataset.pay;
      drawCart();
      return;
    }
    if (e.target.closest('#complete')) await completeSale();
  });

  async function completeSale() {
    const lines = [...cart.entries()].map(([id, qty]) => {
      const it = items.find((i) => i.id === id);
      return { itemId: id, name: it.name, price: it.price, qty };
    });
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    await db.addSale({
      lines,
      total,
      payment,
      byName: user.name,
      byUid: user.uid,
      ts: Date.now(),
      date: todayStr(),
    });
    cart.clear();
    payment = 'cash';
    items = await db.getItems();
    drawGrid();
    drawCart();
    toast(`Sale recorded — ${fmt(total)}`);
  }

  db.getItems().then((list) => {
    items = list;
    drawGrid();
    drawCart();
  });
}
