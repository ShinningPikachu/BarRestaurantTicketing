import { useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { getPreOrderTotal } from '../app/app.helpers';
import { ApiRequestError, apiService } from '../services';
import { Order, OrderItem, PaymentMethod, PreOrderItem, TableId, TableWorkflow, tableKey } from '../types';
import {
  isWorkflowContextCurrent,
  OperationFingerprintLock,
  PaymentIdempotencyKeyStore,
  paymentItemsFingerprint,
  paymentOrdersFingerprint,
  shouldApplyWorkflowResponse,
} from './workflow.guards';

export function useWorkflowController() {
  const [preorderItems, setPreorderItems] = useState<PreOrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [priceDraftByItemId, setPriceDraftByItemId] = useState<Record<number, string>>({});
  const [workflowTableKey, setWorkflowTableKey] = useState<string | null>(null);
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [paymentPending, setPaymentPending] = useState(false);

  const preorderItemsRef = useRef<PreOrderItem[]>([]);
  const ordersRef = useRef<Order[]>([]);
  const priceDraftRef = useRef<Record<number, string>>({});
  const desiredTableKeyRef = useRef<string | null>(null);
  const activeTableKeyRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const lastAppliedRequestIdRef = useRef(0);
  const activationGenerationRef = useRef(0);
  const sessionGenerationRef = useRef(0);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const priceCommitInFlightRef = useRef(new Set<number>());
  const paymentIdempotencyKeysRef = useRef(new PaymentIdempotencyKeyStore());
  const removalIdempotencyKeysRef = useRef(new PaymentIdempotencyKeyStore());
  const removalLocksRef = useRef(new OperationFingerprintLock());
  const paymentLockRef = useRef<{ session: number; fingerprint: string } | null>(null);

  const preorderTotal = useMemo(() => getPreOrderTotal(preorderItems), [preorderItems]);

  function applyWorkflow(table: TableId, workflow: TableWorkflow, requestId: number, session: number): boolean {
    const key = tableKey(table);
    if (!shouldApplyWorkflowResponse({
      session,
      currentSession: sessionGenerationRef.current,
      tableKey: key,
      desiredTableKey: desiredTableKeyRef.current,
      requestId,
      lastAppliedRequestId: lastAppliedRequestIdRef.current,
    })) {
      return false;
    }

    lastAppliedRequestIdRef.current = requestId;
    activeTableKeyRef.current = key;
    preorderItemsRef.current = workflow.preOrderItems;
    ordersRef.current = workflow.orders;
    priceDraftRef.current = {};
    setPreorderItems(workflow.preOrderItems);
    setOrders(workflow.orders);
    setPriceDraftByItemId({});
    setWorkflowTableKey(key);
    return true;
  }

  async function refreshWorkflow(table: TableId): Promise<boolean> {
    const key = tableKey(table);
    const activationGeneration = ++activationGenerationRef.current;
    const session = sessionGenerationRef.current;
    desiredTableKeyRef.current = key;

    // Let an already-running mutation finish. Its response is context-guarded and
    // cannot attach to this table when the desired key changed.
    await mutationQueueRef.current.catch(() => undefined);
    if (!isWorkflowContextCurrent({
      session,
      currentSession: sessionGenerationRef.current,
      tableKey: key,
      desiredTableKey: desiredTableKeyRef.current,
    })) {
      return false;
    }

    const requestId = ++requestIdRef.current;
    try {
      const workflow = await apiService.fetchTableWorkflow(table.number, table.zone);
      if (!isWorkflowContextCurrent({
        session,
        currentSession: sessionGenerationRef.current,
        tableKey: key,
        desiredTableKey: desiredTableKeyRef.current,
      })) {
        return false;
      }
      const applied = applyWorkflow(table, workflow, requestId, session);
      // A newer request for the same table may already have installed a more
      // recent snapshot. That still satisfies a selection waiting on this key.
      return applied || activeTableKeyRef.current === key;
    } catch (error) {
      if (
        session === sessionGenerationRef.current
        && activationGeneration === activationGenerationRef.current
        && desiredTableKeyRef.current === key
      ) {
        // Restore the workflow that is actually displayed. A previous desired
        // key may itself belong to an older, uncommitted selection request.
        desiredTableKeyRef.current = activeTableKeyRef.current;
      }
      throw error;
    }
  }

  function getTableConfirmedOrders(table: TableId): Order[] {
    if (workflowTableKey !== tableKey(table)) {
      return [];
    }
    return orders.filter((order) =>
      order.table?.number === table.number
      && order.table?.zone === table.zone
      && (order.status || '').toLowerCase() === 'confirmed'
    );
  }

  async function enqueueWorkflowMutation<T>(
    table: TableId,
    operation: () => Promise<T>,
    getWorkflow: (result: T) => TableWorkflow
  ): Promise<T | null> {
    const key = tableKey(table);
    const session = sessionGenerationRef.current;
    setPendingMutationCount((count) => count + 1);

    const task = mutationQueueRef.current
      .catch(() => undefined)
      .then(async (): Promise<T | null> => {
        if (
          session !== sessionGenerationRef.current
          || desiredTableKeyRef.current !== key
          || activeTableKeyRef.current !== key
        ) {
          return null;
        }

        const requestId = ++requestIdRef.current;
        const result = await operation();
        applyWorkflow(table, getWorkflow(result), requestId, session);
        return result;
      });

    mutationQueueRef.current = task.then(() => undefined, () => undefined);
    try {
      return await task;
    } finally {
      if (session === sessionGenerationRef.current) {
        setPendingMutationCount((count) => Math.max(0, count - 1));
      }
    }
  }

  async function addMenuItem(table: TableId, menuId: number): Promise<boolean> {
    try {
      return Boolean(await enqueueWorkflowMutation(
        table,
        () => apiService.addPreOrderMenuItem(table.number, table.zone, menuId),
        (workflow) => workflow
      ));
    } catch {
      Alert.alert('Error', 'No se pudo añadir el artículo al prepedido.');
      return false;
    }
  }

  async function incrementPendingItem(table: TableId, itemId: number): Promise<boolean> {
    try {
      return Boolean(await enqueueWorkflowMutation(
        table,
        async () => {
          const item = preorderItemsRef.current.find((current) => current.id === itemId);
          if (!item) {
            throw new Error('Pre-order item no longer exists');
          }
          return apiService.updatePreOrderItem(table.number, table.zone, itemId, { qty: item.qty + 1 });
        },
        (workflow) => workflow
      ));
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el artículo del prepedido.');
      return false;
    }
  }

  async function decrementPendingItem(table: TableId, itemId: number): Promise<boolean> {
    try {
      return Boolean(await enqueueWorkflowMutation(
        table,
        async () => {
          const item = preorderItemsRef.current.find((current) => current.id === itemId);
          if (!item) {
            throw new Error('Pre-order item no longer exists');
          }
          return apiService.updatePreOrderItem(table.number, table.zone, itemId, { qty: Math.max(0, item.qty - 1) });
        },
        (workflow) => workflow
      ));
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el artículo del prepedido.');
      return false;
    }
  }

  async function setItemPrice(table: TableId, itemId: number, priceCents: number): Promise<boolean> {
    try {
      const workflow = await enqueueWorkflowMutation(
        table,
        () => apiService.updatePreOrderItem(table.number, table.zone, itemId, { unitPriceCents: priceCents }),
        (result) => result
      );
      if (!workflow) {
        return false;
      }

      setPriceDraftByItemId((current) => {
        const next = { ...current };
        delete next[itemId];
        priceDraftRef.current = next;
        return next;
      });
      return true;
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el precio del prepedido.');
      return false;
    }
  }

  async function adjustItemPrice(table: TableId, itemId: number, deltaCents: number): Promise<boolean> {
    try {
      return Boolean(await enqueueWorkflowMutation(
        table,
        async () => {
          const item = preorderItemsRef.current.find((current) => current.id === itemId);
          if (!item) {
            throw new Error('Pre-order item no longer exists');
          }
          return apiService.updatePreOrderItem(table.number, table.zone, itemId, {
            unitPriceCents: Math.max(0, item.unitPriceCents + deltaCents),
          });
        },
        (workflow) => workflow
      ));
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el precio del prepedido.');
      return false;
    }
  }

  function updatePriceDraft(itemId: number, value: string): void {
    setPriceDraftByItemId((current) => {
      const next = { ...current, [itemId]: value };
      priceDraftRef.current = next;
      return next;
    });
  }

  async function commitPriceDraft(table: TableId, itemId: number): Promise<boolean> {
    if (priceCommitInFlightRef.current.has(itemId)) {
      return false;
    }
    const rawValue = priceDraftRef.current[itemId];
    if (rawValue === undefined) {
      return false;
    }

    const normalized = rawValue.replace(',', '.').trim();
    const parsed = normalized ? Number(normalized) : Number.NaN;
    const priceCents = Math.round(parsed * 100);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isSafeInteger(priceCents)) {
      Alert.alert('Precio no válido', 'Introduce un precio válido.');
      return false;
    }

    priceCommitInFlightRef.current.add(itemId);
    try {
      return await setItemPrice(table, itemId, priceCents);
    } finally {
      priceCommitInFlightRef.current.delete(itemId);
    }
  }

  async function sendToKitchen(table: TableId): Promise<boolean> {
    if (preorderItemsRef.current.length === 0) {
      Alert.alert('Sin artículos', 'Añade al menos un artículo antes de enviar a cocina.');
      return false;
    }

    try {
      const result = await enqueueWorkflowMutation(
        table,
        () => apiService.sendTablePreOrderToKitchen(table.number, table.zone),
        (workflow) => workflow
      );
      if (!result) return false;
      Alert.alert('Enviado a cocina', 'Los artículos del prepedido están confirmados y listos para preparar.');
      return true;
    } catch {
      Alert.alert('Error', 'No se pudo enviar el pedido a cocina.');
      return false;
    }
  }

  async function clearPreOrder(table: TableId): Promise<boolean> {
    try {
      return Boolean(await enqueueWorkflowMutation(
        table,
        () => apiService.clearPreOrder(table.number, table.zone),
        (workflow) => workflow
      ));
    } catch {
      Alert.alert('Error', 'No se pudo limpiar el prepedido.');
      return false;
    }
  }

  async function removeOrder(table: TableId, orderId: string): Promise<boolean> {
    try {
      const result = await enqueueWorkflowMutation(
        table,
        async () => {
          await apiService.deleteOrder(orderId);
          return apiService.fetchTableWorkflow(table.number, table.zone);
        },
        (workflow) => workflow
      );
      return Boolean(result);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'ORDER_HAS_PAYMENT_HISTORY') {
        Alert.alert('Pedido protegido', 'No se puede eliminar un pedido que ya tiene historial de pagos.');
      } else {
        Alert.alert('Error', 'No se pudo eliminar el pedido.');
      }
      return false;
    }
  }

  async function moveConfirmedItemToPreOrder(table: TableId, orderId: string, orderItem: OrderItem): Promise<boolean> {
    if (orderItem.id === undefined) {
      Alert.alert('No se puede editar', 'Este artículo de cocina no se puede actualizar porque no tiene identificador.');
      return false;
    }

    try {
      return Boolean(await enqueueWorkflowMutation(
        table,
        () => apiService.moveConfirmedItemToPreOrder(orderId, orderItem.id!),
        (workflow) => workflow
      ));
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'ORDER_HAS_PAYMENT_HISTORY') {
        Alert.alert('Pedido protegido', 'No se puede editar un pedido que ya tiene historial de pagos.');
      } else {
        Alert.alert('Error', 'No se pudo actualizar el pedido de cocina al editar el artículo.');
      }
      return false;
    }
  }

  async function payTable(table: TableId, method: PaymentMethod, splitPeople?: number): Promise<boolean> {
    const orderFingerprint = paymentOrdersFingerprint(ordersRef.current);
    const fingerprint = `table:${tableKey(table)}:${method}:${splitPeople ?? 0}:${orderFingerprint}`;
    if (paymentLockRef.current) {
      Alert.alert('Pago en curso', 'Espera a que termine el pago actual.');
      return false;
    }

    const session = sessionGenerationRef.current;
    paymentLockRef.current = { session, fingerprint };
    setPaymentPending(true);
    try {
      const idempotencyKey = paymentIdempotencyKeysRef.current.getOrCreate(fingerprint);
      const result = await enqueueWorkflowMutation(
        table,
        () => apiService.payTable(table.number, table.zone, method, splitPeople, idempotencyKey),
        (paymentResult) => paymentResult.workflow
      );
      if (!result) return false;
      paymentIdempotencyKeysRef.current.clear(fingerprint);
      Alert.alert('Ticket pagado', `Pago registrado: ${result.paidTicket.ticketNumber}`);
      return true;
    } catch {
      Alert.alert('Error', 'No se pudo registrar el pago del ticket. Puedes reintentarlo con seguridad.');
      return false;
    } finally {
      if (paymentLockRef.current?.session === session && paymentLockRef.current.fingerprint === fingerprint) {
        paymentLockRef.current = null;
        setPaymentPending(false);
      }
    }
  }

  async function paySelectedItems(
    table: TableId,
    method: PaymentMethod,
    items: Array<{ orderId: string; itemId: number; qty: number }>
  ): Promise<boolean> {
    const fingerprint = `items:${tableKey(table)}:${method}:${paymentItemsFingerprint(items)}`;
    if (paymentLockRef.current) {
      Alert.alert('Pago en curso', 'Espera a que termine el pago actual.');
      return false;
    }

    const session = sessionGenerationRef.current;
    paymentLockRef.current = { session, fingerprint };
    setPaymentPending(true);
    try {
      const idempotencyKey = paymentIdempotencyKeysRef.current.getOrCreate(fingerprint);
      const result = await enqueueWorkflowMutation(
        table,
        () => apiService.paySelectedItems(table.number, table.zone, method, items, idempotencyKey),
        (paymentResult) => paymentResult.workflow
      );
      if (!result) return false;
      paymentIdempotencyKeysRef.current.clear(fingerprint);
      Alert.alert('Ticket AA pagado', `Pago registrado: ${result.paidTicket.ticketNumber}`);
      return true;
    } catch {
      Alert.alert('Error', 'No se pudo registrar el pago AA. Puedes reintentarlo con seguridad.');
      return false;
    } finally {
      if (paymentLockRef.current?.session === session && paymentLockRef.current.fingerprint === fingerprint) {
        paymentLockRef.current = null;
        setPaymentPending(false);
      }
    }
  }

  async function removeSelectedItems(
    table: TableId,
    items: Array<{ orderId: string; itemId: number; qty: number }>
  ): Promise<boolean> {
    const fingerprint = `remove:${tableKey(table)}:${paymentItemsFingerprint(items)}`;
    if (!removalLocksRef.current.tryAcquire(fingerprint)) {
      Alert.alert('Retirada en curso', 'Espera a que termine esta retirada de productos.');
      return false;
    }

    try {
      const idempotencyKey = removalIdempotencyKeysRef.current.getOrCreate(fingerprint);
      const workflow = await enqueueWorkflowMutation(
        table,
        () => apiService.removeSelectedItems(table.number, table.zone, items, idempotencyKey),
        (result) => result
      );
      if (!workflow) {
        removalIdempotencyKeysRef.current.clear(fingerprint);
        return false;
      }
      removalIdempotencyKeysRef.current.clear(fingerprint);
      Alert.alert('Productos retirados', 'Se han eliminado los productos seleccionados.');
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'ORDER_HAS_PAYMENT_HISTORY') {
        Alert.alert('Pedido protegido', 'No se pueden retirar productos de un pedido con historial de pagos.');
      } else {
        Alert.alert('Error', 'No se pudieron eliminar los productos seleccionados.');
      }
      return false;
    } finally {
      removalLocksRef.current.release(fingerprint);
    }
  }

  function resetWorkflow(): void {
    sessionGenerationRef.current += 1;
    activationGenerationRef.current += 1;
    desiredTableKeyRef.current = null;
    activeTableKeyRef.current = null;
    lastAppliedRequestIdRef.current = requestIdRef.current;
    preorderItemsRef.current = [];
    ordersRef.current = [];
    priceDraftRef.current = {};
    // Preserve the tail of an already-issued request so a fresh session cannot
    // race it against a new write. Its session guard prevents stale UI writes.
    mutationQueueRef.current = mutationQueueRef.current.catch(() => undefined);
    priceCommitInFlightRef.current.clear();
    paymentIdempotencyKeysRef.current.reset();
    removalIdempotencyKeysRef.current.reset();
    removalLocksRef.current.reset();
    paymentLockRef.current = null;
    setPreorderItems([]);
    setOrders([]);
    setPriceDraftByItemId({});
    setWorkflowTableKey(null);
    setPendingMutationCount(0);
    setPaymentPending(false);
  }

  return {
    state: {
      preorderItems,
      orders,
      priceDraftByItemId,
      preorderTotal,
      workflowTableKey,
      isMutating: pendingMutationCount > 0,
      paymentPending,
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
      removeSelectedItems,
      resetWorkflow,
    },
  };
}
