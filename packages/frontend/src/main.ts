import { renderTablesColumn } from './tables-column';
import { renderMenuColumn } from './menu-column';
import { renderOrderColumn } from './order-column';

type OrderItem = { name: string; qty: number };
type Order = { id: string; tableId?: number; table?: { number: number }; items: OrderItem[] };
type MenuItem = { 
  id: number; 
  name: string; 
  priceCents: number; 
  sku?: string; 
  category?: string; 
  description?: string; 
  available?: boolean 
};

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

let selectedTable = 1;
let selectedMenuItems: { [key: number]: number } = {}; // menuItemId -> qty
let orders: Order[] = [];
let menuItems: MenuItem[] = [];

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

async function loadMenu() {
  try {
    const res = await fetch('/api/menu');
    if (!res.ok) throw new Error('Failed to fetch menu');
    const data = await res.json();
    menuItems = data;
  } catch (e) {
    menuItems = [];
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
  renderOrdersView(container);

  root.appendChild(header);
  root.appendChild(container);
}

function renderOrdersView(container: HTMLElement) {
  const wrapper = el('div', 'orders-wrapper');

  // LEFT COLUMN: Tables
  const tablesColumn = renderTablesColumn(selectedTable, (tableNum: number) => {
    selectedTable = tableNum;
    selectedMenuItems = {};
    render();
  });
  wrapper.appendChild(tablesColumn);

  // MIDDLE COLUMN: Menu Items
  const menuColumn = renderMenuColumn(menuItems, selectedMenuItems, (menuId: number) => {
    if (!selectedMenuItems[menuId]) {
      selectedMenuItems[menuId] = 0;
    }
    selectedMenuItems[menuId]++;
    render();
  });
  wrapper.appendChild(menuColumn);

  // RIGHT COLUMN: Order Details
  const orderColumn = renderOrderColumn(
    selectedTable,
    orders,
    menuItems,
    selectedMenuItems,
    async () => {
      // Submit Order
      const items = [];
      for (const menuId in selectedMenuItems) {
        const qty = selectedMenuItems[menuId as any];
        const menuItem = menuItems.find(m => m.id === parseInt(menuId));
        if (menuItem && qty > 0) {
          items.push({ name: menuItem.name, qty, unitPriceCents: menuItem.priceCents });
        }
      }
      const payload = { tableId: selectedTable, items };
      try {
        const res = await fetch('/api/orders', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
        });
        if (res.ok) {
          selectedMenuItems = {};
          await loadOrders();
          render();
        } else {
          alert('Failed to create order');
        }
      } catch (e) {
        alert('Failed to reach backend');
      }
    },
    () => {
      // Clear Items
      selectedMenuItems = {};
      render();
    },
    async (orderId: string) => {
      // Remove Order
      try {
        const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
        if (res.ok) {
          await loadOrders();
          render();
        } else alert('Failed to remove');
      } catch (e) {
        alert('Failed to reach backend');
      }
    },
    (order: Order) => {
      // Print Ticket
      printTicket(order);
    }
  );
  wrapper.appendChild(orderColumn);

  container.appendChild(wrapper);
}

function printTicket(order: Order) {
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return alert('Popup blocked — allow popups to print tickets');
  const tableNumber = order.table?.number || order.tableId;
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
      <h2>Ticket — Table ${tableNumber}</h2>
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

// Initialize
(async () => {
  await loadOrders();
  await loadMenu();
  render();
})();
