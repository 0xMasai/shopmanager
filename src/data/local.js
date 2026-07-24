// Demo-mode adapter: everything lives in localStorage on this device.
// Same interface as the Firebase adapter so views don't care which is active.
import { todayStr } from '../ui.js';

const KEY = 'shopms-demo-db-v2'; // v2: electronics seed (bump to reseed demo devices)
const EVT = 'shopms-data-changed';

const SEED_ITEMS = [
  { name: 'Smartphone (Itel A70)', price: 350000, stockQty: 5, lowStock: 2 },
  { name: 'Feature phone (kabiriti)', price: 65000, stockQty: 10, lowStock: 3 },
  { name: 'Charger (fast)', price: 15000, stockQty: 20, lowStock: 5 },
  { name: 'Earphones', price: 10000, stockQty: 25, lowStock: 5 },
  { name: 'Phone cover', price: 12000, stockQty: 30, lowStock: 8 },
  { name: 'Screen protector', price: 8000, stockQty: 30, lowStock: 8 },
  { name: 'Power bank 10,000mAh', price: 60000, stockQty: 8, lowStock: 2 },
  { name: 'Memory card 32GB', price: 25000, stockQty: 12, lowStock: 4 },
];

function fresh() {
  return {
    items: SEED_ITEMS.map((it, i) => ({ id: 'i' + (i + 1), active: true, ...it })),
    sales: [],
    movements: [],
    dayCloses: {},
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupted store — fall through and reseed
  }
  const db = fresh();
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

function save(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
  window.dispatchEvent(new CustomEvent(EVT));
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function createLocalAdapter() {
  return {
    mode: 'local',

    async getItems() {
      return load().items.filter((i) => i.active !== false);
    },

    async addItem(item) {
      const db = load();
      const id = newId();
      db.items.push({ id, active: true, ...item });
      save(db);
      return id;
    },

    async updateItem(id, patch) {
      const db = load();
      const it = db.items.find((i) => i.id === id);
      if (it) Object.assign(it, patch);
      save(db);
    },

    async addSale(sale) {
      const db = load();
      const id = newId();
      db.sales.push({ id, ...sale });
      for (const line of sale.lines) {
        const it = db.items.find((i) => i.id === line.itemId);
        if (it) it.stockQty -= line.qty;
      }
      save(db);
      return id;
    },

    async getSales(date) {
      return load()
        .sales.filter((s) => s.date === date)
        .sort((a, b) => b.ts - a.ts);
    },

    subscribeSales(date, cb) {
      const fire = () => this.getSales(date).then(cb);
      fire();
      window.addEventListener(EVT, fire);
      return () => window.removeEventListener(EVT, fire);
    },

    async receiveStock(itemId, qty, byName, note = '') {
      const db = load();
      const it = db.items.find((i) => i.id === itemId);
      if (!it) return;
      it.stockQty += qty;
      db.movements.push({
        id: newId(),
        itemId,
        itemName: it.name,
        type: 'received',
        qty,
        byName,
        note,
        ts: Date.now(),
        date: todayStr(),
      });
      save(db);
    },

    async getDayClose(date) {
      return load().dayCloses[date] || null;
    },

    async saveDayClose(date, data) {
      const db = load();
      db.dayCloses[date] = data;
      save(db);
    },

    async getDayCloses(n = 14) {
      return Object.values(load().dayCloses)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, n);
    },
  };
}
