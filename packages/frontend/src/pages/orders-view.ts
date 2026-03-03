import {
  renderTablesColumn,
  renderMenuColumn,
  renderOrderColumn,
  type TableDef
} from '../components';
import type { Order, MenuItem, PreOrderItem, TableZone } from '@shared';
import { el } from '../utils/dom';

export function renderOrdersView(
  container: HTMLElement,
  selectedTable: number,
  tables: TableDef[],
  preorderItems: PreOrderItem[],
  tempMenuItems: { [key: number]: number },
  orders: Order[],
  menuItems: MenuItem[],
  callbacks: {
    onTableSelect: (tableNum: number) => void;
    onAddTable: (zone: TableZone) => void;
    onAddMenuItem: (menuId: number) => void;
    onAddPendingItem: (menuId: number) => void;
    onRemovePendingItem: (menuId: number) => void;
    onSetItemPrice: (menuId: number, priceCents: number) => void;
    onConfirmOrder: () => Promise<void>;
    onClearItems: () => void;
    onRemoveOrder: (orderId: string) => Promise<void>;
    onPrintTicket: (order: Order) => void;
  }
): void {
  const wrapper = el('div', 'orders-wrapper');

  // LEFT COLUMN: Tables
  const tablesColumn = renderTablesColumn(
    selectedTable,
    tables,
    callbacks.onTableSelect,
    callbacks.onAddTable
  );
  wrapper.appendChild(tablesColumn);

  // MIDDLE COLUMN: Menu Items
  const menuColumn = renderMenuColumn(menuItems, tempMenuItems, callbacks.onAddMenuItem);
  wrapper.appendChild(menuColumn);

  // RIGHT COLUMN: Order Details
  const orderColumn = renderOrderColumn(
    selectedTable,
    orders,
    menuItems,
    preorderItems,
    callbacks.onAddPendingItem,
    callbacks.onRemovePendingItem,
    callbacks.onSetItemPrice,
    callbacks.onConfirmOrder,
    callbacks.onClearItems,
    callbacks.onRemoveOrder,
    callbacks.onPrintTicket
  );
  wrapper.appendChild(orderColumn);

  container.appendChild(wrapper);
}

export function printTicket(order: Order): void {
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
