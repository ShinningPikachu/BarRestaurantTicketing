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

function el(tag: string, cls?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

export function renderOrderColumn(
  selectedTable: number,
  orders: Order[],
  menuItems: MenuItem[],
  selectedMenuItems: { [key: number]: number },
  onSubmitOrder: () => Promise<void>,
  onClearItems: () => void,
  onRemoveOrder: (orderId: string) => Promise<void>,
  onPrintTicket: (order: Order) => void
): HTMLElement {
  const orderColumn = el('div', 'order-column');
  const orderHeading = el('h3');
  orderHeading.textContent = `Table ${selectedTable} - Ordered Dishes`;
  orderColumn.appendChild(orderHeading);

  const orderScroll = el('div', 'order-scroll');

  const tableOrders = orders.filter((o) => (o.table?.number || o.tableId) === selectedTable || (o.tableId === selectedTable));
  const orderedDishes = new Map<string, number>();
  for (const order of tableOrders) {
    for (const item of order.items) {
      const currentQty = orderedDishes.get(item.name) || 0;
      orderedDishes.set(item.name, currentQty + item.qty);
    }
  }

  if (orderedDishes.size === 0 && Object.keys(selectedMenuItems).length === 0) {
    const p = el('p');
    p.textContent = 'No ordered dishes yet.';
    orderScroll.appendChild(p);
  } else {
    if (orderedDishes.size > 0) {
      const dishesCard = el('div', 'order-card-small');
      const dishesTitle = el('div', 'order-id');
      dishesTitle.textContent = 'Current Ordered Dishes';
      dishesCard.appendChild(dishesTitle);

      const dishesList = el('ul', 'order-items-list');
      for (const [dishName, dishQty] of orderedDishes.entries()) {
        const li = el('li', 'order-item');
        li.textContent = `${dishQty} × ${dishName}`;
        dishesList.appendChild(li);
      }
      dishesCard.appendChild(dishesList);

      const actions = el('div', 'order-card-actions');
      if (tableOrders.length > 0) {
        const printBtn = el('button', 'print-btn-small');
        printBtn.textContent = 'Print Latest';
        printBtn.addEventListener('click', () => onPrintTicket(tableOrders[tableOrders.length - 1]));
        actions.appendChild(printBtn);

        const removeBtn = el('button', 'remove-btn-small');
        removeBtn.textContent = 'Remove Latest';
        removeBtn.addEventListener('click', async () => {
          await onRemoveOrder(tableOrders[tableOrders.length - 1].id);
        });
        actions.appendChild(removeBtn);
      }
      dishesCard.appendChild(actions);
      orderScroll.appendChild(dishesCard);
    }

    // Show pending items being added
    if (Object.keys(selectedMenuItems).length > 0) {
      const pendingCard = el('div', 'order-card-small pending');
      const pendingTitle = el('div', 'order-id');
      pendingTitle.textContent = 'Adding to Order';
      pendingCard.appendChild(pendingTitle);

      const pendingItems = el('ul', 'order-items-list');
      let totalCents = 0;
      for (const menuId in selectedMenuItems) {
        const qty = selectedMenuItems[menuId as any];
        const menuItem = menuItems.find(m => m.id === parseInt(menuId));
        if (menuItem && qty > 0) {
          const li = el('li', 'order-item');
          const name = `${qty} × ${menuItem.name}`;
          const price = `$${((menuItem.priceCents * qty) / 100).toFixed(2)}`;
          li.innerHTML = `<span>${name}</span><span style="float:right">${price}</span>`;
          pendingItems.appendChild(li);
          totalCents += menuItem.priceCents * qty;
        }
      }
      pendingCard.appendChild(pendingItems);

      const totalDiv = el('div', 'order-total');
      totalDiv.textContent = `Total: $${(totalCents / 100).toFixed(2)}`;
      pendingCard.appendChild(totalDiv);

      const pendingActions = el('div', 'order-card-actions');
      const submitBtn = el('button', 'submit-order-btn');
      submitBtn.textContent = 'Submit Order';
      submitBtn.addEventListener('click', async () => {
        await onSubmitOrder();
      });

      const clearBtn = el('button', 'clear-order-btn');
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', () => {
        onClearItems();
      });

      pendingActions.appendChild(submitBtn);
      pendingActions.appendChild(clearBtn);
      pendingCard.appendChild(pendingActions);
      orderScroll.appendChild(pendingCard);
    }
  }

  orderColumn.appendChild(orderScroll);
  
  return orderColumn;
}
