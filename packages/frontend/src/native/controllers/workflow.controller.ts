import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { getPreOrderTotal } from '../app/app.helpers';
import { apiService } from '../services';
import { Order, OrderItem, PreOrderItem, TableId } from '../types';

export function useWorkflowController() {
  const [preorderItems, setPreorderItems] = useState<PreOrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [priceDraftByItemId, setPriceDraftByItemId] = useState<Record<number, string>>({});

  const preorderTotal = useMemo(() => getPreOrderTotal(preorderItems), [preorderItems]);

  function applyWorkflow(loadedPreorderItems: PreOrderItem[], loadedOrders: Order[]): void {
    setPreorderItems(loadedPreorderItems);
    setOrders(loadedOrders);
    setPriceDraftByItemId({});
  }

  async function refreshWorkflow(table: TableId): Promise<void> {
    const workflow = await apiService.fetchTableWorkflow(table.number, table.zone);
    applyWorkflow(workflow.preOrderItems, workflow.orders);
  }

  function getTableConfirmedOrders(table: TableId): Order[] {
    return orders.filter((order) =>
      order.table?.number === table.number &&
      order.table?.zone === table.zone &&
      (order.status || '').toLowerCase() === 'confirmed'
    );
  }

  async function addMenuItem(table: TableId, menuId: number): Promise<void> {
    try {
      const workflow = await apiService.addPreOrderMenuItem(table.number, table.zone, menuId);
      applyWorkflow(workflow.preOrderItems, workflow.orders);
    } catch {
      Alert.alert('Error', 'Failed to add pre-order item.');
    }
  }

  async function incrementPendingItem(table: TableId, itemId: number): Promise<void> {
    const item = preorderItems.find((current) => current.id === itemId);
    if (!item) return;

    try {
      const workflow = await apiService.updatePreOrderItem(table.number, table.zone, itemId, { qty: item.qty + 1 });
      applyWorkflow(workflow.preOrderItems, workflow.orders);
    } catch {
      Alert.alert('Error', 'Failed to update pre-order item.');
    }
  }

  async function decrementPendingItem(table: TableId, itemId: number): Promise<void> {
    const item = preorderItems.find((current) => current.id === itemId);
    if (!item) return;

    try {
      const workflow = await apiService.updatePreOrderItem(table.number, table.zone, itemId, { qty: Math.max(0, item.qty - 1) });
      applyWorkflow(workflow.preOrderItems, workflow.orders);
    } catch {
      Alert.alert('Error', 'Failed to update pre-order item.');
    }
  }

  async function setItemPrice(table: TableId, itemId: number, priceCents: number): Promise<void> {
    try {
      const workflow = await apiService.updatePreOrderItem(table.number, table.zone, itemId, {
        unitPriceCents: Math.max(0, priceCents)
      });
      applyWorkflow(workflow.preOrderItems, workflow.orders);
    } catch {
      Alert.alert('Error', 'Failed to update pre-order price.');
    }

    setPriceDraftByItemId((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  async function adjustItemPrice(table: TableId, itemId: number, deltaCents: number): Promise<void> {
    const item = preorderItems.find((current) => current.id === itemId);
    if (!item) return;

    await setItemPrice(table, itemId, item.unitPriceCents + deltaCents);
  }

  function updatePriceDraft(itemId: number, value: string): void {
    setPriceDraftByItemId((current) => ({ ...current, [itemId]: value }));
  }

  async function commitPriceDraft(table: TableId, itemId: number): Promise<void> {
    const rawValue = priceDraftByItemId[itemId];
    if (rawValue === undefined) {
      return;
    }

    const parsed = Number(rawValue.replace(',', '.').trim());
    if (!Number.isNaN(parsed)) {
      await setItemPrice(table, itemId, Math.round(parsed * 100));
      return;
    }

    setPriceDraftByItemId((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  async function sendToKitchen(table: TableId): Promise<void> {
    if (preorderItems.length === 0) {
      Alert.alert('No items', 'Add at least one item before sending to kitchen.');
      return;
    }

    try {
      const workflow = await apiService.sendTablePreOrderToKitchen(table.number, table.zone);
      applyWorkflow(workflow.preOrderItems, workflow.orders);
      Alert.alert('Sent to kitchen', 'Pre-order items are now confirmed and ready to cook.');
    } catch {
      Alert.alert('Error', 'Failed to send order to kitchen.');
    }
  }

  async function clearPreOrder(table: TableId): Promise<void> {
    try {
      const workflow = await apiService.clearPreOrder(table.number, table.zone);
      applyWorkflow(workflow.preOrderItems, workflow.orders);
    } catch {
      Alert.alert('Error', 'Failed to clear pre-order.');
    }
  }

  async function removeOrder(table: TableId, orderId: string): Promise<void> {
    try {
      await apiService.deleteOrder(orderId);
      await refreshWorkflow(table);
    } catch {
      Alert.alert('Error', 'Failed to remove order.');
    }
  }

  async function moveConfirmedItemToPreOrder(orderId: string, orderItem: OrderItem): Promise<void> {
    if (orderItem.id === undefined) {
      Alert.alert('Unable to edit', 'This kitchen item cannot be updated because it has no item id.');
      return;
    }

    try {
      const workflow = await apiService.moveConfirmedItemToPreOrder(orderId, orderItem.id);
      applyWorkflow(workflow.preOrderItems, workflow.orders);
    } catch {
      Alert.alert('Error', 'Failed to update kitchen order while editing item.');
    }
  }

  return {
    state: {
      preorderItems,
      orders,
      priceDraftByItemId,
      preorderTotal,
    },
    selectors: {
      getTableConfirmedOrders,
    },
    actions: {
      refreshWorkflow,
      addMenuItem,
      incrementPendingItem,
      decrementPendingItem,
      updatePriceDraft,
      commitPriceDraft,
      adjustItemPrice,
      sendToKitchen,
      clearPreOrder,
      removeOrder,
      moveConfirmedItemToPreOrder,
    }
  };
}
