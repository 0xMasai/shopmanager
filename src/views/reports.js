import { esc, fmt, todayStr } from '../ui.js';

export function dayCloseSummary(r) {
  const varClass = (v) => (v < 0 ? 'neg' : v > 0 ? 'pos' : '');
  const stockRows = (r.stock || [])
    .map(
      (s) => `
    <tr class="${varClass(s.variance)}">
      <td>${esc(s.name)}</td><td>${s.expected}</td><td>${s.counted}</td>
      <td>${s.variance > 0 ? '+' : ''}${s.variance}</td>
    </tr>`
    )
    .join('');
  return `
    <div class="close-summary">
      <div class="cards">
        <div class="card"><span>Sales</span><b>${fmt(r.salesTotal)}</b></div>
        <div class="card"><span>Cash expected</span><b>${fmt(r.cashSales)}</b></div>
        <div class="card"><span>Cash counted</span><b>${fmt(r.countedCash)}</b></div>
        <div class="card ${varClass(r.cashVariance)}"><span>Cash difference</span>
          <b>${r.cashVariance < 0 ? '−' : '+'}${fmt(Math.abs(r.cashVariance))}</b></div>
      </div>
      ${
        stockRows
          ? `<table class="table">
              <thead><tr><th>Item</th><th>System</th><th>Counted</th><th>Diff</th></tr></thead>
              <tbody>${stockRows}</tbody></table>`
          : '<p class="muted">No stock counts were entered.</p>'
      }
      ${r.note ? `<p class="note">📝 ${esc(r.note)}</p>` : ''}
      <p class="muted">Closed by ${esc(r.closedBy)} · Mobile Money ${fmt(r.momoSales)} · ${r.txCount} transaction(s)</p>
    </div>`;
}

export function renderReports(root, ctx) {
  const { db } = ctx;
  const date = todayStr();

  root.innerHTML = `
    <div class="view-reports">
      <h2>Today · ${date}</h2>
      <div id="cards" class="cards"></div>
      <section><h3>Top items today</h3><div id="top"></div></section>
      <section><h3>Low stock</h3><div id="low"></div></section>
      <section><h3>Day reports</h3><div id="closes"></div></section>
    </div>`;

  const cards = root.querySelector('#cards');
  const top = root.querySelector('#top');

  const unsub = db.subscribeSales(date, (sales) => {
    const cash = sales.filter((s) => s.payment === 'cash').reduce((a, s) => a + s.total, 0);
    const momo = sales.filter((s) => s.payment !== 'cash').reduce((a, s) => a + s.total, 0);
    cards.innerHTML = `
      <div class="card"><span>Sales</span><b>${fmt(cash + momo)}</b></div>
      <div class="card"><span>Cash</span><b>${fmt(cash)}</b></div>
      <div class="card"><span>Mobile Money</span><b>${fmt(momo)}</b></div>
      <div class="card"><span>Transactions</span><b>${sales.length}</b></div>`;

    const byItem = {};
    sales.forEach((s) =>
      (s.lines || []).forEach((l) => {
        byItem[l.name] = byItem[l.name] || { qty: 0, amount: 0 };
        byItem[l.name].qty += l.qty;
        byItem[l.name].amount += l.qty * l.price;
      })
    );
    const rows = Object.entries(byItem)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 8);
    top.innerHTML = rows.length
      ? `<table class="table"><tbody>${rows
          .map(
            ([name, v]) =>
              `<tr><td>${esc(name)}</td><td>×${v.qty}</td><td>${fmt(v.amount)}</td></tr>`
          )
          .join('')}</tbody></table>`
      : '<p class="muted">No sales yet today.</p>';
  });

  db.getItems().then((items) => {
    const low = items.filter((i) => i.stockQty <= (i.lowStock ?? 0));
    root.querySelector('#low').innerHTML = low.length
      ? low
          .map(
            (i) =>
              `<div class="row"><span>${esc(i.name)}</span><b class="low">${i.stockQty} left</b></div>`
          )
          .join('')
      : '<p class="muted">Nothing running low.</p>';
  });

  db.getDayCloses(14).then((list) => {
    root.querySelector('#closes').innerHTML = list.length
      ? list
          .map((r) => {
            const missing = (r.stock || []).filter((s) => s.variance < 0).length;
            const flags = [
              r.cashVariance < 0
                ? `<span class="badge neg">cash short ${fmt(Math.abs(r.cashVariance))}</span>`
                : '<span class="badge ok">cash ok</span>',
              missing
                ? `<span class="badge neg">${missing} item(s) short</span>`
                : '<span class="badge ok">stock ok</span>',
            ].join(' ');
            return `<details class="close-item"><summary><b>${r.date}</b> ${flags}</summary>${dayCloseSummary(r)}</details>`;
          })
          .join('')
      : '<p class="muted">No day reports yet. Staff submit one from the Close tab each evening.</p>';
  });

  return unsub;
}
