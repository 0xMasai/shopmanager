import { esc, fmt, toast, compressImage } from '../ui.js';

export function renderItems(root, ctx) {
  const { db } = ctx;
  let items = [];
  let editing = null; // item id, or 'new'
  let photo = null; // data URL of the item photo being edited, or null

  root.innerHTML = `
    <div class="view-items">
      <div class="row-between"><h2>Items</h2><button id="add" class="btn-primary">+ Add item</button></div>
      <div id="form" class="card form hidden">
        <div class="field"><span>Photo</span>
          <div class="photo-edit">
            <img id="f-photo-preview" class="thumb hidden" alt="" />
            <span id="f-photo-empty" class="thumb thumb-empty">📷</span>
            <button id="f-photo-btn" class="btn-plain">Add photo</button>
            <button id="f-photo-clear" class="btn-plain hidden">Remove</button>
            <input id="f-photo" type="file" accept="image/*" class="hidden" />
          </div>
        </div>
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

  function updatePhotoUI() {
    f('photo-preview').classList.toggle('hidden', !photo);
    f('photo-empty').classList.toggle('hidden', !!photo);
    f('photo-clear').classList.toggle('hidden', !photo);
    f('photo-btn').textContent = photo ? 'Change' : 'Add photo';
    if (photo) f('photo-preview').src = photo;
  }

  function openForm(item) {
    editing = item ? item.id : 'new';
    photo = item ? item.photo || null : null;
    f('photo').value = '';
    updatePhotoUI();
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
          <span class="item-row-left">
            ${i.photo ? `<img class="thumb" src="${i.photo}" alt="" />` : '<span class="thumb thumb-empty">🛒</span>'}
            <span>${esc(i.name)}<br/><small class="muted">${fmt(i.price)} · ${i.stockQty} in stock</small></span>
          </span>
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

  f('photo-btn').addEventListener('click', () => f('photo').click());
  f('photo-clear').addEventListener('click', () => {
    photo = null;
    f('photo').value = '';
    updatePhotoUI();
  });
  f('photo').addEventListener('change', async () => {
    const file = f('photo').files[0];
    if (!file) return;
    try {
      photo = await compressImage(file);
      updatePhotoUI();
    } catch {
      toast("Couldn't read that photo", false);
    }
  });

  root.querySelector('#f-save').addEventListener('click', async () => {
    const name = f('name').value.trim();
    const price = parseInt(f('price').value, 10);
    const stockQty = parseInt(f('qty').value, 10) || 0;
    const lowStock = parseInt(f('low').value, 10) || 0;
    if (!name || isNaN(price)) return toast('Name and price are required', false);
    if (editing === 'new') await db.addItem({ name, price, stockQty, lowStock, photo });
    else await db.updateItem(editing, { name, price, stockQty, lowStock, photo });
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
