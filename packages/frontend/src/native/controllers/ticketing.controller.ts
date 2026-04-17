import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { TableId, TableZone } from '../types';
import { useMenuController } from './menu.controller';
import { useTableController } from './table.controller';
import { useTicketController } from './ticket.controller';
import { useWorkflowController } from './workflow.controller';
import { logger } from '../utils/logger';

export function useTicketingController() {
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
    const initializeApp = async () => {
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
        if (mountedRef.current) {
          Alert.alert('Initialization failed', 'Unable to load app data.');
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    initializeApp();

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
      Alert.alert('Error', 'Failed to select table');
    }
  }

  // Add new table
  async function addTable(zone: TableZone): Promise<void> {
    try {
      logger.debug({ zone }, 'Adding new table');
      await tableController.actions.addTable(zone, workflowController.actions.refreshWorkflow);
    } catch (error) {
      logger.error({ error, zone }, 'Failed to add table');
      Alert.alert('Error', 'Failed to add table');
    }
  }

  // Menu item management
  async function addMenuItem(menuId: number): Promise<void> {
    try {
      logger.debug({ menuId, selectedTable }, 'Adding menu item');
      await workflowController.actions.addMenuItem(selectedTable, menuId);
    } catch (error) {
      logger.error({ error, menuId }, 'Failed to add menu item');
      Alert.alert('Error', 'Failed to add menu item');
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
      Alert.alert('Error', 'Failed to send order to kitchen');
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
      Alert.alert('Error', 'Failed to remove order');
    }
  }

  // Ticket printing
  async function printTicket(): Promise<void> {
    try {
      logger.info({ selectedTable }, 'Printing ticket');
      await ticketController.actions.printTicket({
        selectedTable,
        confirmedOrders: tableConfirmedOrders,
        preorderItems: workflowController.state.preorderItems,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to print ticket');
      Alert.alert('Error', 'Failed to generate ticket');
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
      addMenuItem,
      incrementPendingItem,
      decrementPendingItem,
      updatePriceDraft: workflowController.actions.updatePriceDraft,
      commitPriceDraft,
      adjustItemPrice,
      sendToKitchen,
      clearPreOrder,
      printTicket,
      removeOrder,
      moveConfirmedItemToPreOrder: workflowController.actions.moveConfirmedItemToPreOrder,
    }
  };
}
