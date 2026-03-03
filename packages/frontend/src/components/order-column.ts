import { createTruncatedText } from '../utils/truncated-text';
import type { OrderItem, Order, MenuItem, PreOrderItem } from '@shared';
import { el } from '../utils/dom';

export function renderOrderColumn(
  selectedTable: number,
  orders: Order[],
  menuItems: MenuItem[],
  preorderItems: PreOrderItem[],
  onAddPendingItem: (menuId: number) => void,
  onRemovePendingItem: (menuId: number) => void,
  onSetItemPrice: (menuId: number, priceCents: number) => void,
  onConfirmOrder: () => Promise<void>,
  onClearItems: () => void,
  onRemoveOrder: (orderId: string) => Promise<void>,
  onPrintTicket: (order: Order) => void
): HTMLElement {
  const orderColumn = el('div', 'order-column');
  const orderHeading = el('h3');
  orderHeading.textContent = `Table ${selectedTable} - Orders`;
  orderColumn.appendChild(orderHeading);

  const orderScroll = el('div', 'order-scroll');

  const tableOrders = orders.filter((o) => (o.table?.number || o.tableId) === selectedTable || (o.tableId === selectedTable));

  // ===== PRE-ORDER SECTION =====
  if (preorderItems.length > 0) {
    const preorderSection = el('div', 'order-section');
    const preorderTitle = el('div', 'order-section-title');
    preorderTitle.textContent = 'Pre-Order';
    preorderSection.appendChild(preorderTitle);

    const preorderList = el('div', 'preorder-items-list');
    let preorderTotal = 0;

    for (const item of preorderItems) {
      const menuItem = menuItems.find(m => m.id === item.menuId);
      if (!menuItem) continue;

      const row = el('div', 'preorder-item-row');

      const nameCol = el('div', 'preorder-item-name');
      nameCol.appendChild(createTruncatedText(menuItem.name, 25));

      const qtyCol = el('div', 'preorder-item-qty-col');
      const qtyRemoveBtn = el('button', 'preorder-item-btn');
      qtyRemoveBtn.textContent = '−';
      qtyRemoveBtn.addEventListener('click', () => onRemovePendingItem(item.menuId));

      const qtySpan = el('span', 'preorder-item-qty');
      qtySpan.textContent = String(item.qty);

      const qtyAddBtn = el('button', 'preorder-item-btn');
      qtyAddBtn.textContent = '+';
      qtyAddBtn.addEventListener('click', () => onAddPendingItem(item.menuId));

      qtyCol.appendChild(qtyRemoveBtn);
      qtyCol.appendChild(qtySpan);
      qtyCol.appendChild(qtyAddBtn);

      const priceCol = el('div', 'preorder-item-price-col');
      const priceInput = el('input') as HTMLInputElement;
      priceInput.type = 'number';
      priceInput.min = '0';
      priceInput.step = '0.01';
      priceInput.value = (item.priceCents / 100).toFixed(2);
      priceInput.className = 'preorder-item-price-input';
      const updatePrice = (cents: number) => {
        if (cents >= 0) {
          onSetItemPrice(item.menuId, cents);
        }
      };
      priceInput.addEventListener('change', () => {
        const newPrice = Math.round(parseFloat(priceInput.value) * 100);
        updatePrice(newPrice);
      });
      priceCol.appendChild(priceInput);

      const priceAdjustCol = el('div', 'preorder-price-adjust-col');
      const minusBtn = el('button', 'price-adjust-quick-btn');
      minusBtn.textContent = '−1';
      minusBtn.addEventListener('click', () => {
        const newCents = Math.max(0, item.priceCents - 100);
        updatePrice(newCents);
      });
      const minusSmallBtn = el('button', 'price-adjust-quick-btn small');
      minusSmallBtn.textContent = '−0.5';
      minusSmallBtn.addEventListener('click', () => {
        const newCents = Math.max(0, item.priceCents - 50);
        updatePrice(newCents);
      });
      const plusSmallBtn = el('button', 'price-adjust-quick-btn small');
      plusSmallBtn.textContent = '+0.5';
      plusSmallBtn.addEventListener('click', () => {
        updatePrice(item.priceCents + 50);
      });
      const plusBtn = el('button', 'price-adjust-quick-btn');
      plusBtn.textContent = '+1';
      plusBtn.addEventListener('click', () => {
        updatePrice(item.priceCents + 100);
      });
      priceAdjustCol.appendChild(minusBtn);
      priceAdjustCol.appendChild(minusSmallBtn);
      priceAdjustCol.appendChild(plusSmallBtn);
      priceAdjustCol.appendChild(plusBtn);

      const totalCol = el('div', 'preorder-item-total');
      totalCol.textContent = `$${((item.priceCents * item.qty) / 100).toFixed(2)}`;

      row.appendChild(nameCol);
      row.appendChild(qtyCol);
      row.appendChild(priceCol);
      row.appendChild(priceAdjustCol);
      row.appendChild(totalCol);
      preorderList.appendChild(row);

      preorderTotal += item.priceCents * item.qty;
    }

    preorderSection.appendChild(preorderList);

    const preorderFooter = el('div', 'preorder-footer');
    const totalDiv = el('div', 'order-total');
    totalDiv.textContent = `Total: $${(preorderTotal / 100).toFixed(2)}`;
    preorderFooter.appendChild(totalDiv);

    const preorderActions = el('div', 'order-card-actions');
    const confirmBtn = el('button', 'confirm-order-btn');
    confirmBtn.textContent = 'Confirm Order';
    confirmBtn.addEventListener('click', async () => {
      await onConfirmOrder();
    });

    const clearBtn = el('button', 'clear-order-btn');
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
      onClearItems();
    });

    preorderActions.appendChild(confirmBtn);
    preorderActions.appendChild(clearBtn);
    preorderFooter.appendChild(preorderActions);
    preorderSection.appendChild(preorderFooter);

    orderScroll.appendChild(preorderSection);
  }

  // ===== CONFIRMED SECTION =====
  if (tableOrders.length > 0) {
    const confirmedSection = el('div', 'order-section confirmed-section');
    const confirmedTitle = el('div', 'order-section-title');
    confirmedTitle.textContent = 'Confirmed Orders';
    confirmedSection.appendChild(confirmedTitle);

    for (const order of tableOrders) {
      const orderCard = el('div', 'order-card-small');
      const orderIdDiv = el('div', 'order-id');
      orderIdDiv.appendChild(createTruncatedText(`Order ${order.id}`, 30));
      orderCard.appendChild(orderIdDiv);

      const itemsList = el('ul', 'order-items-list');
      for (const item of order.items) {
        const li = el('li', 'order-item');
        li.textContent = `${item.qty} × ${item.name}`;
        itemsList.appendChild(li);
      }
      orderCard.appendChild(itemsList);

      const actions = el('div', 'order-card-actions');
      const printBtn = el('button', 'print-btn-small');
      printBtn.textContent = 'Print';
      printBtn.addEventListener('click', () => onPrintTicket(order));
      actions.appendChild(printBtn);

      const removeBtn = el('button', 'remove-btn-small');
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', async () => {
        await onRemoveOrder(order.id);
      });
      actions.appendChild(removeBtn);

      orderCard.appendChild(actions);
      confirmedSection.appendChild(orderCard);
    }

    orderScroll.appendChild(confirmedSection);
  }

  if (preorderItems.length === 0 && tableOrders.length === 0) {
    const p = el('p');
    p.textContent = 'No orders yet.';
    orderScroll.appendChild(p);
  }

  orderColumn.appendChild(orderScroll);
  
  return orderColumn;
}
