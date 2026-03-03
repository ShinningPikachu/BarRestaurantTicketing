import './styles/main.css';
import { renderOrdersView, printTicket } from './pages/orders-view';
import { apiService } from './services/api.service';
import { storageService } from './services';
import type { Order, MenuItem, PreOrderItem, TableZone } from '@shared';
import type { TableDef } from './components';
import { el } from './utils/dom';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

let tables: TableDef[] = storageService.loadTables();
let selectedTable = tables[0]?.number || 1;
let preorderItems: PreOrderItem[] = storageService.loadPreOrderItems(selectedTable);
let tempMenuItems: { [key: number]: number } = {}; // for tracking from menu clicks
let orders: Order[] = [];
let menuItems: MenuItem[] = [];

async function loadOrders() {
  try {
    orders = await apiService.fetchOrders();
  } catch (e) {
    orders = [];
  }
}

async function loadMenu() {
  try {
    menuItems = await apiService.fetchMenu();
  } catch (e) {
    menuItems = [];
  }
}

function render() {
  root.innerHTML = '';

  const header = el('header', 'header');
  header.innerHTML = '<h1>Bar Ticketing — Desktop</h1>';

  const container = el('div', 'container');
  renderOrdersView(
    container,
    selectedTable,
    tables,
    preorderItems,
    tempMenuItems,
    orders,
    menuItems,
    {
      onTableSelect: (tableNum: number) => {
        storageService.savePreOrderItems(selectedTable, preorderItems);
        selectedTable = tableNum;
        preorderItems = storageService.loadPreOrderItems(tableNum);
        tempMenuItems = {};
        render();
      },
      onAddTable: (zone: TableZone) => {
        const maxNumber = tables.reduce((max, table) => Math.max(max, table.number), 0);
        const newTable: TableDef = { number: maxNumber + 1, zone };
        tables = [...tables, newTable];
        storageService.saveTables(tables);
        storageService.savePreOrderItems(selectedTable, preorderItems);
        selectedTable = newTable.number;
        preorderItems = [];
        tempMenuItems = {};
        render();
      },
      onAddMenuItem: (menuId: number) => {
        if (!tempMenuItems[menuId]) {
          tempMenuItems[menuId] = 0;
        }
        tempMenuItems[menuId]++;

        // Add to preorder with deduplication
        const menuItem = menuItems.find(m => m.id === menuId);
        if (menuItem) {
          const existingItem = preorderItems.find(i => i.menuId === menuId);
          if (existingItem) {
            existingItem.qty++;
          } else {
            preorderItems.push({ menuId, qty: 1, priceCents: menuItem.priceCents });
          }
        }
        render();
      },
      onAddPendingItem: (menuId: number) => {
        const existingItem = preorderItems.find(i => i.menuId === menuId);
        if (existingItem) {
          existingItem.qty++;
        }
        render();
      },
      onRemovePendingItem: (menuId: number) => {
        const idx = preorderItems.findIndex(i => i.menuId === menuId);
        if (idx >= 0) {
          preorderItems[idx].qty--;
          if (preorderItems[idx].qty <= 0) {
            preorderItems.splice(idx, 1);
          }
        }
        render();
      },
      onSetItemPrice: (menuId: number, priceCents: number) => {
        const item = preorderItems.find(i => i.menuId === menuId);
        if (item) {
          item.priceCents = priceCents;
        }
        render();
      },
      onConfirmOrder: async () => {
        const items = [];
        for (const item of preorderItems) {
          const menuItem = menuItems.find(m => m.id === item.menuId);
          if (menuItem) {
            items.push({ name: menuItem.name, qty: item.qty, unitPriceCents: item.priceCents });
          }
        }
        const payload = { tableId: selectedTable, items };
        try {
          await apiService.createOrder(selectedTable, items);
          preorderItems = [];
          tempMenuItems = {};
          storageService.savePreOrderItems(selectedTable, []);
          await loadOrders();
          render();
        } catch (e) {
          alert('Failed to create order');
        }
      },
      onClearItems: () => {
        preorderItems = [];
        tempMenuItems = {};
        render();
      },
      onRemoveOrder: async (orderId: string) => {
        try {
          await apiService.deleteOrder(orderId);
          await loadOrders();
          render();
        } catch (e) {
          alert('Failed to remove order');
        }
      },
      onPrintTicket: (order: Order) => {
        printTicket(order);
      }
    }
  );

  root.appendChild(header);
  root.appendChild(container);
}

// Initialize
(async () => {
  await loadOrders();
  await loadMenu();
  render();
})();
