import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { getPreOrderTotal } from '../app/app.helpers';
import { apiService } from '../services';
import { Order, OrderItem, PaymentMethod, PreOrderItem, TableId } from '../types';

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
      Alert.alert('Error', 'No se pudo añadir el artículo al prepedido.');
    }
  }

  async function incrementPendingItem(table: TableId, itemId: number): Promise<void> {
    const item = preorderItems.find((current) => current.id === itemId);
    if (!item) return;

    try {
      const workflow = await apiService.updatePreOrderItem(table.number, table.zone, itemId, { qty: item.qty + 1 });
      applyWorkflow(workflow.preOrderItems, workflow.orders);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el artículo del prepedido.');
    }
  }

  async function decrementPendingItem(table: TableId, itemId: number): Promise<void> {
    const item = preorderItems.find((current) => current.id === itemId);
    if (!item) return;

    try {
      const workflow = await apiService.updatePreOrderItem(table.number, table.zone, itemId, { qty: Math.max(0, item.qty - 1) });
      applyWorkflow(workflow.preOrderItems, workflow.orders);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el artículo del prepedido.');
    }
  }

  async function setItemPrice(table: TableId, itemId: number, priceCents: number): Promise<void> {
    try {
      const workflow = await apiService.updatePreOrderItem(table.number, table.zone, itemId, {
        unitPriceCents: Math.max(0, priceCents)
      });
      applyWorkflow(workflow.preOrderItems, workflow.orders);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el precio del prepedido.');
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
      Alert.alert('Sin artículos', 'Añade al menos un artículo antes de enviar a cocina.');
      return;
    }

    try {
      const workflow = await apiService.sendTablePreOrderToKitchen(table.number, table.zone);
      applyWorkflow(workflow.preOrderItems, workflow.orders);
      Alert.alert('Enviado a cocina', 'Los artículos del prepedido están confirmados y listos para preparar.');
    } catch {
      Alert.alert('Error', 'No se pudo enviar el pedido a cocina.');
    }
  }

  async function clearPreOrder(table: TableId): Promise<void> {
    try {
      const workflow = await apiService.clearPreOrder(table.number, table.zone);
      applyWorkflow(workflow.preOrderItems, workflow.orders);
    } catch {
      Alert.alert('Error', 'No se pudo limpiar el prepedido.');
    }
  }

  async function removeOrder(table: TableId, orderId: string): Promise<void> {
    try {
      await apiService.deleteOrder(orderId);
      await refreshWorkflow(table);
    } catch {
      Alert.alert('Error', 'No se pudo eliminar el pedido.');
    }
  }

  async function moveConfirmedItemToPreOrder(orderId: string, orderItem: OrderItem): Promise<void> {
    if (orderItem.id === undefined) {
      Alert.alert('No se puede editar', 'Este artículo de cocina no se puede actualizar porque no tiene identificador.');
      return;
    }

    try {
      const workflow = await apiService.moveConfirmedItemToPreOrder(orderId, orderItem.id);
      applyWorkflow(workflow.preOrderItems, workflow.orders);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el pedido de cocina al editar el artículo.');
    }
  }

  async function payTable(table: TableId, method: PaymentMethod, splitPeople?: number): Promise<void> {
    try {
      const result = await apiService.payTable(table.number, table.zone, method, splitPeople);
      applyWorkflow(result.workflow.preOrderItems, result.workflow.orders);
      Alert.alert('Ticket pagado', `Pago registrado: ${result.paidTicket.ticketNumber}`);
    } catch {
      Alert.alert('Error', 'No se pudo registrar el pago del ticket.');
    }
  }

  async function paySelectedItems(
    table: TableId,
    method: PaymentMethod,
    items: Array<{ orderId: string; itemId: number; qty: number }>
  ): Promise<void> {
    try {
      const result = await apiService.paySelectedItems(table.number, table.zone, method, items);
      applyWorkflow(result.workflow.preOrderItems, result.workflow.orders);
      Alert.alert('Ticket AA pagado', `Pago registrado: ${result.paidTicket.ticketNumber}`);
    } catch {
      Alert.alert('Error', 'No se pudo registrar el pago AA.');
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
      payTable,
      paySelectedItems,
    }
  };
}
