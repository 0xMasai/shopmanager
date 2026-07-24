import { esc, toast } from '../ui.js';

export function renderStock(root, ctx) {
  const { db, user } = ctx;
  let items = [];

  root.innerHTML = `
    <div class="view-stock">
      <h2>Stock on hand</h2>
      <p class="muted">Tap an item to record stock you received from a supplier.</p>
      <div id="list"></div>
    </div>`;
  const list = root.querySelector('#list');

  function draw() {
    list.innerHTML =
      items
        .map(
          (i) => `
      <div class="stock-row" data-id="${i.id}">
        <div class="stock-main">
          <span>${esc(i.name)}</span>
          <b class="${i.stockQty <= (i.lowStock ?? 0) ? 'low' : ''}">${i.stockQty}</b>
        </div>
        <div class="stock-form hidden">
          <input type="number" min="1" placeholder="Qty received" class="input qty-in" />
          <button class="btn-primary save-btn">Add</button>
        </div>
      </div>`
        )
        .join('') || '<p class="muted">No items yet. The owner adds them under Items.</p>';
  }

  list.addEventListener('click', async (e) => {
    const row = e.target.closest('.stock-row');
    if (!row) return;
    if (e.target.closest('.save-btn')) {
      const qty = parseInt(row.querySelector('.qty-in').value, 10);
      if (!qty || qty < 1) return toast('Enter the quantity received', false);
      await db.receiveStock(row.dataset.id, qty, user.name);
      items = await db.getItems();
      draw();
      toast('Stock updated');
      return;
    }
    if (e.target.closest('.stock-main')) {
      row.querySelector('.stock-form').classList.toggle('hidden');
    }
  });

  db.getItems().then((l) => {
    items = l;
    draw();
  });
}
