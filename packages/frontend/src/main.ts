type OrderItem = { name: string; qty: number };
type Order = { id: string; tableId?: number; table?: { number: number }; items: OrderItem[] };

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

let selectedTable = 1;
let orders: Order[] = [];

async function loadOrders() {
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    orders = data;
  } catch (e) {
    // fallback to empty
    orders = [];
  }
}

function el(tag: string, cls?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function render() {
  root.innerHTML = '';

  const header = el('header', 'header');
  header.innerHTML = '<h1>Bar Ticketing — Desktop</h1>';

  const container = el('div', 'container');

  const sidebar = el('aside', 'sidebar');
  const tablesList = el('div', 'tables');
  tablesList.innerHTML = '<h3>Tables</h3>';
  for (let t = 1; t <= 8; t++) {
    const btn = el('button', 'table-btn');
    btn.textContent = `Table ${t}`;
    if (t === selectedTable) btn.classList.add('active');
    btn.addEventListener('click', () => {
      selectedTable = t;
      render();
    });
    tablesList.appendChild(btn);
  }

  const addSample = el('button', 'add-order');
  addSample.textContent = 'Add Sample Order';
  addSample.addEventListener('click', async () => {
    const payload = { table: selectedTable, items: [{ name: 'Beer', qty: 2, unitPriceCents: 0 }] };
    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        await loadOrders();
        render();
      } else {
        alert('Failed to create order');
      }
    } catch (e) {
      alert('Failed to reach backend');
    }
  });

  sidebar.appendChild(tablesList);
  sidebar.appendChild(addSample);

  const main = el('main', 'main');
  const heading = el('h2');
  heading.textContent = `Orders for Table ${selectedTable}`;
  main.appendChild(heading);

  const tableOrders = orders.filter((o) => (o.table?.number || o.tableId) === selectedTable || (o.tableId === selectedTable));
  if (tableOrders.length === 0) {
    const p = el('p');
    p.textContent = 'No orders yet — add one.';
    main.appendChild(p);
  } else {
    for (const o of tableOrders) {
      const card = el('div', 'order-card');
      const title = el('div', 'order-title');
      title.textContent = `Order ${o.id}`;
      const items = el('ul', 'order-items');
      for (const it of o.items) {
        const li = el('li');
        li.textContent = `${it.qty} × ${it.name}`;
        items.appendChild(li);
      }
      const actions = el('div', 'order-actions');
      const printBtn = el('button', 'print-btn');
      printBtn.textContent = 'Print Ticket';
      printBtn.addEventListener('click', () => printTicket(o));
      const removeBtn = el('button', 'remove-btn');
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', async () => {
        try {
          const res = await fetch(`/api/orders/${o.id}`, { method: 'DELETE' });
          if (res.ok) {
            await loadOrders();
            render();
          } else alert('Failed to remove');
        } catch (e) {
          alert('Failed to reach backend');
        }
      });
      actions.appendChild(printBtn);
      actions.appendChild(removeBtn);

      card.appendChild(title);
      card.appendChild(items);
      card.appendChild(actions);
      main.appendChild(card);
    }
  }

  container.appendChild(sidebar);
  container.appendChild(main);

  root.appendChild(header);
  root.appendChild(container);
}

function printTicket(order: Order) {
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return alert('Popup blocked — allow popups to print tickets');
  const html = `
    <html>
    <head>
      <title>Ticket ${order.id}</title>
      <style>
        body{font-family:sans-serif;padding:20px}
        h2{margin-bottom:0}
        ul{list-style:none;padding:0}
      </style>
    </head>
    <body>
      <h2>Ticket — Table ${order.table}</h2>
      <p>Order ${order.id}</p>
      <ul>
        ${order.items.map((i) => `<li>${i.qty} × ${i.name}</li>`).join('')}
      </ul>
      <p>Thank you!</p>
    </body>
    </html>
  `;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

render();
