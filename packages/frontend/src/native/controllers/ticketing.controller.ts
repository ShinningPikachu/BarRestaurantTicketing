import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Order, PaymentMethod, TableId, TableZone } from '../types';
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

  const tableConfirmedOrders = useMemo(
    () => workflowController.selectors.getTableConfirmedOrders(selectedTable),
    [workflowController.selectors, selectedTable, workflowController.state.orders]
  );

  // Initialization - separated for clarity
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;
    const initializeApp = async () => {
      setLoading(true);
      try {
        logger.debug({}, 'Initializing application');
        
        // Load menu
        await menuController.actions.loadMenu();
        logger.debug({}, 'Menu loaded');

        // Load tables
        const initialTable = await tableController.actions.loadTables();
        logger.debug({ initialTable }, 'Tables loaded');

        // Load workflow for initial table
        await workflowController.actions.refreshWorkflow(initialTable);
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
  async function addMenuItem(menuId: number): Promise<void> {
    try {
      logger.debug({ menuId, selectedTable }, 'Adding menu item');
      await workflowController.actions.addMenuItem(selectedTable, menuId);
    } catch (error) {
      logger.error({ error, menuId }, 'Failed to add menu item');
      Alert.alert('Error', 'No se pudo añadir el artículo del menú');
    }
  }

  // Pre-order item quantity management
  async function incrementPendingItem(itemId: number): Promise<void> {
    try {
      await workflowController.actions.incrementPendingItem(selectedTable, itemId);
    } catch (error) {
      logger.error({ error, itemId }, 'Failed to increment item');
    }
  }

  async function decrementPendingItem(itemId: number): Promise<void> {
    try {
      await workflowController.actions.decrementPendingItem(selectedTable, itemId);
    } catch (error) {
      logger.error({ error, itemId }, 'Failed to decrement item');
    }
  }

  // Price management
  async function commitPriceDraft(itemId: number): Promise<void> {
    try {
      logger.debug({ itemId }, 'Committing price draft');
      await workflowController.actions.commitPriceDraft(selectedTable, itemId);
    } catch (error) {
      logger.error({ error, itemId }, 'Failed to commit price');
    }
  }

  async function adjustItemPrice(itemId: number, deltaCents: number): Promise<void> {
    try {
      await workflowController.actions.adjustItemPrice(selectedTable, itemId, deltaCents);
    } catch (error) {
      logger.error({ error, itemId, deltaCents }, 'Failed to adjust price');
    }
  }

  // Kitchen workflow
  async function sendToKitchen(): Promise<void> {
    try {
      logger.info({ selectedTable }, 'Sending order to kitchen');
      await workflowController.actions.sendToKitchen(selectedTable);
    } catch (error) {
      logger.error({ error, selectedTable }, 'Failed to send to kitchen');
      Alert.alert('Error', 'No se pudo enviar el pedido a cocina');
    }
  }

  async function clearPreOrder(): Promise<void> {
    try {
      logger.debug({ selectedTable }, 'Clearing pre-order');
      await workflowController.actions.clearPreOrder(selectedTable);
    } catch (error) {
      logger.error({ error, selectedTable }, 'Failed to clear pre-order');
    }
  }

  // Order management
  async function removeOrder(orderId: string): Promise<void> {
    try {
      logger.debug({ orderId }, 'Removing order');
      await workflowController.actions.removeOrder(selectedTable, orderId);
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to remove order');
      Alert.alert('Error', 'No se pudo eliminar el pedido');
    }
  }

  // Ticket printing
  async function printTicket(options?: { confirmedOrders?: Order[]; splitPeople?: number; ticketNote?: string }): Promise<void> {
    try {
      logger.info({ selectedTable }, 'Printing ticket');
      await ticketController.actions.printTicket({
        selectedTable,
        confirmedOrders: options?.confirmedOrders ?? tableConfirmedOrders,
        preorderItems: workflowController.state.preorderItems,
        splitPeople: options?.splitPeople,
        ticketNote: options?.ticketNote,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to print ticket');
      Alert.alert('Error', 'No se pudo generar el ticket');
    }
  }

  async function payTable(method: PaymentMethod, splitPeople?: number): Promise<void> {
    try {
      await workflowController.actions.payTable(selectedTable, method, splitPeople);
    } catch (error) {
      logger.error({ error, method, splitPeople }, 'Failed to pay table');
      Alert.alert('Error', 'No se pudo registrar el pago');
    }
  }

  async function paySelectedItems(
    method: PaymentMethod,
    items: Array<{ orderId: string; itemId: number; qty: number }>
  ): Promise<void> {
    try {
      await workflowController.actions.paySelectedItems(selectedTable, method, items);
    } catch (error) {
      logger.error({ error, method }, 'Failed to pay selected items');
      Alert.alert('Error', 'No se pudo registrar el pago AA');
    }
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
      selectedTable,
      menuByCategory: menuController.state.menuByCategory,
      preorderItems: workflowController.state.preorderItems,
      tableConfirmedOrders,
      preorderTotal: workflowController.state.preorderTotal,
      priceDraftByItemId: workflowController.state.priceDraftByItemId,
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
      reloadMenu: menuController.actions.loadMenu,
      removeOrder,
      moveConfirmedItemToPreOrder: workflowController.actions.moveConfirmedItemToPreOrder,
    }
  };
}
