import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { getConfirmedOrdersTotal, getCurrentTableTotal, getPreOrderTotal } from '../app/app.helpers';
import { Order, PaymentMethod, TableId, TableKitchenStatus, TableZone, tableKey } from '../types';
import { useMenuController } from './menu.controller';
import { useTableController } from './table.controller';
import { useTicketController } from './ticket.controller';
import { useWorkflowController } from './workflow.controller';
import { logger } from '../utils/logger';

export function useTicketingController(enabled = true) {
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const menuController = useMenuController();
  const tableController = useTableController();
  const workflowController = useWorkflowController();
  const ticketController = useTicketController();

  const selectedTable = tableController.state.selectedTable;
  const selectedWorkflowIsCurrent = workflowController.state.workflowTableKey === tableKey(selectedTable);
  const selectedPreorderItems = selectedWorkflowIsCurrent ? workflowController.state.preorderItems : [];

  const tableConfirmedOrders = useMemo(
    () => workflowController.selectors.getTableConfirmedOrders(selectedTable),
    [selectedTable, workflowController.state.orders, workflowController.state.workflowTableKey]
  );
  const preorderTotal = useMemo(() => getPreOrderTotal(selectedPreorderItems), [selectedPreorderItems]);
  const confirmedTotal = useMemo(() => getConfirmedOrdersTotal(tableConfirmedOrders), [tableConfirmedOrders]);
  const currentTableTotal = useMemo(
    () => getCurrentTableTotal(selectedPreorderItems, tableConfirmedOrders),
    [selectedPreorderItems, tableConfirmedOrders]
  );
  const selectedTableStatus = tableController.state.tableKitchenStatuses.get(tableKey(selectedTable));
  const currentTableKitchenStatus = useMemo<TableKitchenStatus>(() => {
    const hasPendingItems = selectedPreorderItems.some((item) => item.qty > 0);
    const hasConfirmedItems = tableConfirmedOrders.some((order) => order.items.some((item) => item.qty > 0));
    if (hasPendingItems) {
      return 'pending';
    }
    if (selectedTableStatus === 'printed' && hasConfirmedItems) {
      return 'printed';
    }
    if (hasConfirmedItems) {
      return 'sent';
    }
    return 'empty';
  }, [selectedPreorderItems, selectedTableStatus, tableConfirmedOrders]);

  useEffect(() => {
    tableController.actions.updateTableTotal(selectedTable, currentTableTotal);
  }, [currentTableTotal, selectedTable.number, selectedTable.zone]);

  useEffect(() => {
    tableController.actions.updateTableKitchenStatus(selectedTable, currentTableKitchenStatus);
  }, [currentTableKitchenStatus, selectedTable.number, selectedTable.zone]);

  // Initialization - separated for clarity
  useEffect(() => {
    if (!enabled) {
      menuController.actions.resetMenu();
      tableController.actions.resetTables();
      workflowController.actions.resetWorkflow();
      setLoading(false);
      return;
    }

    let active = true;
    const initializeApp = async () => {
      setLoading(true);
      try {
        logger.debug({}, 'Initializing application');
        
        // Load menu
        const menuLoaded = await menuController.actions.loadMenu();
        if (!active || !menuLoaded) return;
        logger.debug({}, 'Menu loaded');

        // Load tables
        const initialTable = await tableController.actions.loadTables();
        if (!active || !initialTable) return;
        logger.debug({ initialTable }, 'Tables loaded');

        // Load workflow for initial table
        const workflowLoaded = await workflowController.actions.refreshWorkflow(initialTable);
        if (!active || !workflowLoaded) return;
        logger.info({}, 'Application initialized successfully');
      } catch (error) {
        logger.error({ error }, 'Initialization failed');
        if (mountedRef.current && active) {
          Alert.alert('Error de inicialización', 'No se pudieron cargar los datos de la aplicación.');
        }
      } finally {
        if (mountedRef.current && active) {
          setLoading(false);
        }
      }
    };

    initializeApp();

    return () => {
      active = false;
    };
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Table selection - with workflow refresh
  async function selectTable(table: TableId): Promise<void> {
    try {
      logger.debug({ table }, 'Selecting table');
      await tableController.actions.selectTable(table, workflowController.actions.refreshWorkflow);
    } catch (error) {
      logger.error({ error, table }, 'Failed to select table');
      Alert.alert('Error', 'No se pudo seleccionar la mesa');
    }
  }

  // Add new table
  async function addTable(zone: TableZone): Promise<void> {
    try {
      logger.debug({ zone }, 'Adding new table');
      await tableController.actions.addTable(zone, workflowController.actions.refreshWorkflow);
    } catch (error) {
      logger.error({ error, zone }, 'Failed to add table');
      Alert.alert('Error', 'No se pudo añadir la mesa');
    }
  }

  async function removeTable(table: TableId): Promise<void> {
    try {
      logger.debug({ table }, 'Removing table');
      await tableController.actions.removeTable(table, workflowController.actions.refreshWorkflow);
    } catch (error) {
      logger.error({ error, table }, 'Failed to remove table');
      Alert.alert('Error', 'No se pudo eliminar la mesa');
    }
  }

  // Menu item management
  async function addMenuItem(menuId: number): Promise<boolean> {
    try {
      logger.debug({ menuId, selectedTable }, 'Adding menu item');
      return await workflowController.actions.addMenuItem(selectedTable, menuId);
    } catch (error) {
      logger.error({ error, menuId }, 'Failed to add menu item');
      Alert.alert('Error', 'No se pudo añadir el artículo del menú');
      return false;
    }
  }

  // Pre-order item quantity management
  async function incrementPendingItem(itemId: number): Promise<boolean> {
    try {
      return await workflowController.actions.incrementPendingItem(selectedTable, itemId);
    } catch (error) {
      logger.error({ error, itemId }, 'Failed to increment item');
      return false;
    }
  }

  async function decrementPendingItem(itemId: number): Promise<boolean> {
    try {
      return await workflowController.actions.decrementPendingItem(selectedTable, itemId);
    } catch (error) {
      logger.error({ error, itemId }, 'Failed to decrement item');
      return false;
    }
  }

  // Price management
  async function commitPriceDraft(itemId: number): Promise<boolean> {
    try {
      logger.debug({ itemId }, 'Committing price draft');
      return await workflowController.actions.commitPriceDraft(selectedTable, itemId);
    } catch (error) {
      logger.error({ error, itemId }, 'Failed to commit price');
      return false;
    }
  }

  async function adjustItemPrice(itemId: number, deltaCents: number): Promise<boolean> {
    try {
      return await workflowController.actions.adjustItemPrice(selectedTable, itemId, deltaCents);
    } catch (error) {
      logger.error({ error, itemId, deltaCents }, 'Failed to adjust price');
      return false;
    }
  }

  // Kitchen workflow
  async function sendToKitchen(): Promise<boolean> {
    try {
      logger.info({ selectedTable }, 'Sending order to kitchen');
      return await workflowController.actions.sendToKitchen(selectedTable);
    } catch (error) {
      logger.error({ error, selectedTable }, 'Failed to send to kitchen');
      Alert.alert('Error', 'No se pudo enviar el pedido a cocina');
      return false;
    }
  }

  async function clearPreOrder(): Promise<boolean> {
    try {
      logger.debug({ selectedTable }, 'Clearing pre-order');
      return await workflowController.actions.clearPreOrder(selectedTable);
    } catch (error) {
      logger.error({ error, selectedTable }, 'Failed to clear pre-order');
      return false;
    }
  }

  // Order management
  async function removeOrder(orderId: string): Promise<boolean> {
    try {
      logger.debug({ orderId }, 'Removing order');
      return await workflowController.actions.removeOrder(selectedTable, orderId);
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to remove order');
      Alert.alert('Error', 'No se pudo eliminar el pedido');
      return false;
    }
  }

  // Ticket printing
  async function printTicket(options?: { confirmedOrders?: Order[]; splitPeople?: number; ticketNote?: string }): Promise<void> {
    try {
      logger.info({ selectedTable }, 'Printing ticket');
      const didPrint = await ticketController.actions.printTicket({
        selectedTable,
        confirmedOrders: options?.confirmedOrders ?? tableConfirmedOrders,
        splitPeople: options?.splitPeople,
        ticketNote: options?.ticketNote,
      });
      if (didPrint && !options?.confirmedOrders) {
        await tableController.actions.markTableTicketPrinted(selectedTable);
      }
    } catch (error) {
      logger.error({ error, selectedTable }, 'Failed to update printed ticket table state');
      Alert.alert('Ticket impreso', 'El ticket se generó, pero no se pudo actualizar el color de la mesa.');
    }
  }

  async function payTable(method: PaymentMethod, splitPeople?: number): Promise<boolean> {
    try {
      return await workflowController.actions.payTable(selectedTable, method, splitPeople);
    } catch (error) {
      logger.error({ error, method, splitPeople }, 'Failed to pay table');
      Alert.alert('Error', 'No se pudo registrar el pago');
      return false;
    }
  }

  async function paySelectedItems(
    method: PaymentMethod,
    items: Array<{ orderId: string; itemId: number; qty: number }>
  ): Promise<boolean> {
    try {
      return await workflowController.actions.paySelectedItems(selectedTable, method, items);
    } catch (error) {
      logger.error({ error, method }, 'Failed to pay selected items');
      Alert.alert('Error', 'No se pudo registrar el pago AA');
      return false;
    }
  }

  async function removeSelectedItems(
    items: Array<{ orderId: string; itemId: number; qty: number }>
  ): Promise<boolean> {
    try {
      return await workflowController.actions.removeSelectedItems(selectedTable, items);
    } catch (error) {
      logger.error({ error }, 'Failed to remove selected items');
      Alert.alert('Error', 'No se pudieron eliminar los productos seleccionados');
      return false;
    }
  }

  async function refreshData(): Promise<void> {
    const refreshedTable = await tableController.actions.refreshTables();
    if (!refreshedTable) return;
    await Promise.all([
      menuController.actions.loadMenu({ showError: false }),
      workflowController.actions.refreshWorkflow(refreshedTable),
    ]);
  }

  function resetData(prepareForLogin = false): void {
    menuController.actions.resetMenu();
    tableController.actions.resetTables();
    workflowController.actions.resetWorkflow();
    setLoading(prepareForLogin);
  }

  async function moveConfirmedItemToPreOrder(
    orderId: Parameters<typeof workflowController.actions.moveConfirmedItemToPreOrder>[1],
    item: Parameters<typeof workflowController.actions.moveConfirmedItemToPreOrder>[2]
  ): Promise<boolean> {
    return workflowController.actions.moveConfirmedItemToPreOrder(selectedTable, orderId, item);
  }

  return {
    controllers: {
      menu: menuController,
      table: tableController,
      workflow: workflowController,
      ticket: ticketController,
    },
    state: {
      loading,
      tables: tableController.state.tables,
      tableTotals: tableController.state.tableTotals,
      tableKitchenStatuses: tableController.state.tableKitchenStatuses,
      selectedTable,
      menuByCategory: menuController.state.menuByCategory,
      preorderItems: selectedPreorderItems,
      tableConfirmedOrders,
      preorderTotal,
      confirmedTotal,
      currentTableTotal,
      priceDraftByItemId: workflowController.state.priceDraftByItemId,
      isMutating: workflowController.state.isMutating,
      paymentPending: workflowController.state.paymentPending,
    },
    actions: {
      selectTable,
      addTable,
      removeTable,
      addMenuItem,
      incrementPendingItem,
      decrementPendingItem,
      updatePriceDraft: workflowController.actions.updatePriceDraft,
      commitPriceDraft,
      adjustItemPrice,
      sendToKitchen,
      clearPreOrder,
      printTicket,
      payTable,
      paySelectedItems,
      removeSelectedItems,
      refreshData,
      resetData,
      reloadMenu: menuController.actions.loadMenu,
      removeOrder,
      moveConfirmedItemToPreOrder,
    }
  };
}
