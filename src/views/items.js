import { esc, fmt, toast } from '../ui.js';

export function renderItems(root, ctx) {
  const { db } = ctx;
  let items = [];
  let editing = null; // item id, or 'new'

  root.innerHTML = `
    <div class="view-items">
      <div class="row-between"><h2>Items</h2><button id="add" class="btn-primary">+ Add item</button></div>
      <div id="form" class="card form hidden">
        <label class="field"><span>Name</span><input id="f-name" class="input" /></label>
        <label class="field"><span>Selling price (UGX)</span>
          <input id="f-price" type="number" min="0" class="input" /></label>
        <label class="field"><span>Stock quantity</span>
          <input id="f-qty" type="number" min="0" class="input" /></label>
        <label class="field"><span>Low-stock alert at</span>
          <input id="f-low" type="number" min="0" class="input" /></label>
        <div class="row-between">
          <button id="f-cancel" class="btn-plain">Cancel</button>
          <button id="f-save" class="btn-primary">Save</button>
        </div>
      </div>
      <div id="list"></div>
    </div>`;

  const form = root.querySelector('#form');
  const list = root.querySelector('#list');
  const f = (id) => root.querySelector('#f-' + id);

  function openForm(item) {
    editing = item ? item.id : 'new';
    f('name').value = item ? item.name : '';
    f('price').value = item ? item.price : '';
    f('qty').value = item ? item.stockQty : '';
    f('low').value = item ? (item.lowStock ?? 0) : '';
    form.classList.remove('hidden');
    f('name').focus();
  }

  function draw() {
    list.innerHTML =
      items
        .map(
          (i) => `
      <div class="stock-row" data-id="${i.id}">
        <div class="stock-main">
          <span>${esc(i.name)}<br/><small class="muted">${fmt(i.price)} · ${i.stockQty} in stock</small></span>
          <span class="row-actions">
            <button class="btn-plain edit-btn">Edit</button>
            <button class="btn-plain remove-btn">Remove</button>
          </span>
        </div>
      </div>`
        )
        .join('') || '<p class="muted">No items yet — add your first one.</p>';
  }

  root.querySelector('#add').addEventListener('click', () => openForm(null));
  root.querySelector('#f-cancel').addEventListener('click', () => form.classList.add('hidden'));

  root.querySelector('#f-save').addEventListener('click', async () => {
    const name = f('name').value.trim();
    const price = parseInt(f('price').value, 10);
    const stockQty = parseInt(f('qty').value, 10) || 0;
    const lowStock = parseInt(f('low').value, 10) || 0;
    if (!name || isNaN(price)) return toast('Name and price are required', false);
    if (editing === 'new') await db.addItem({ name, price, stockQty, lowStock });
    else await db.updateItem(editing, { name, price, stockQty, lowStock });
    form.classList.add('hidden');
    items = await db.getItems();
    draw();
    toast('Item saved');
  });

  list.addEventListener('click', async (e) => {
    const row = e.target.closest('.stock-row');
    if (!row) return;
    const item = items.find((i) => i.id === row.dataset.id);
    if (e.target.closest('.edit-btn')) return openForm(item);
    if (e.target.closest('.remove-btn')) {
      if (!confirm(`Remove "${item.name}" from the shop?`)) return;
      await db.updateItem(item.id, { active: false });
      items = await db.getItems();
      draw();
      toast('Item removed');
    }
  });

  db.getItems().then((l) => {
    items = l;
    draw();
  });
}
