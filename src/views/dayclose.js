// The anti-theft core: staff count cash and shelves WITHOUT seeing what the
// system expects (a blind count). The owner sees the comparison in Reports.
import { esc, toast, todayStr } from '../ui.js';
import { dayCloseSummary } from './reports.js';

export function renderDayClose(root, ctx) {
  const { db, user } = ctx;
  const date = todayStr();

  (async () => {
    const existing = await db.getDayClose(date);
    if (existing) return drawDone(existing);
    const [items, sales] = await Promise.all([db.getItems(), db.getSales(date)]);
    drawForm(items, sales);
  })();

  function totals(sales) {
    const cash = sales.filter((s) => s.payment === 'cash').reduce((a, s) => a + s.total, 0);
    const momo = sales.filter((s) => s.payment !== 'cash').reduce((a, s) => a + s.total, 0);
    return { cash, momo, total: cash + momo, count: sales.length };
  }

  function drawForm(items, sales) {
    const t = totals(sales);
    root.innerHTML = `
      <div class="view-close">
        <h2>Close the day · ${date}</h2>
        <p class="muted">Count the cash box and the stock on the shelf, then submit.
        The owner sees the comparison against recorded sales.</p>
        <label class="field"><span>Cash counted in the box (UGX)</span>
          <input id="cash" type="number" min="0" class="input" placeholder="e.g. 250000" /></label>
        <h3>Stock count</h3>
        <p class="muted">Enter what you physically count. Leave blank to skip an item.</p>
        <div id="counts">
          ${items
            .map(
              (i) => `
          <label class="count-row"><span>${esc(i.name)}</span>
            <input type="number" min="0" class="input count-in" data-id="${i.id}" placeholder="count" /></label>`
            )
            .join('')}
        </div>
        <label class="field"><span>Notes (anything unusual today)</span>
          <input id="note" class="input" placeholder="optional" /></label>
        <button id="submit" class="btn-primary btn-big">Submit day report</button>
      </div>`;

    root.querySelector('#submit').addEventListener('click', async () => {
      const countedCash = parseInt(root.querySelector('#cash').value, 10);
      if (isNaN(countedCash)) return toast('Enter the cash you counted', false);
      const stock = [];
      root.querySelectorAll('.count-in').forEach((inp) => {
        if (inp.value === '') return;
        const it = items.find((i) => i.id === inp.dataset.id);
        const counted = parseInt(inp.value, 10);
        stock.push({
          itemId: it.id,
          name: it.name,
          expected: it.stockQty,
          counted,
          variance: counted - it.stockQty,
        });
      });
      const report = {
        date,
        ts: Date.now(),
        closedBy: user.name,
        salesTotal: t.total,
        cashSales: t.cash,
        momoSales: t.momo,
        txCount: t.count,
        countedCash,
        cashVariance: countedCash - t.cash,
        stock,
        note: root.querySelector('#note').value.trim(),
      };
      await db.saveDayClose(date, report);
      drawDone(report);
    });
  }

  function drawDone(r) {
    if (user.role !== 'owner') {
      root.innerHTML = `
        <div class="center-msg">
          <h2>✅ Day report submitted</h2>
          <p class="muted">Today's report is locked. The owner reviews it under Reports.</p>
        </div>`;
      return;
    }
    root.innerHTML = `<div class="view-close"><h2>Day report · ${r.date}</h2>${dayCloseSummary(r)}</div>`;
  }
}
