import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { TableId, TableZone } from '../types';
import { useMenuController } from './menu.controller';
import { useTableController } from './table.controller';
import { useTicketController } from './ticket.controller';
import { useWorkflowController } from './workflow.controller';

export function useTicketingController() {
  const [loading, setLoading] = useState(true);

  const menuController = useMenuController();
  const tableController = useTableController();
  const workflowController = useWorkflowController();
  const ticketController = useTicketController();

  const selectedTable = tableController.state.selectedTable;

  const tableConfirmedOrders = useMemo(
    () => workflowController.selectors.getTableConfirmedOrders(selectedTable),
    [workflowController.selectors, selectedTable, workflowController.state.orders]
  );

  useEffect(() => {
    let mounted = true;

    async function init(): Promise<void> {
      try {
        await menuController.actions.loadMenu();
        const initialTable = await tableController.actions.loadTables();
        await workflowController.actions.refreshWorkflow(initialTable);
      } catch {
        if (mounted) {
          Alert.alert('Initialization failed', 'Unable to load app data.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  async function selectTable(table: TableId): Promise<void> {
    await tableController.actions.selectTable(table, workflowController.actions.refreshWorkflow);
  }

  async function addTable(zone: TableZone): Promise<void> {
    await tableController.actions.addTable(zone, workflowController.actions.refreshWorkflow);
  }

  async function addMenuItem(menuId: number): Promise<void> {
    await workflowController.actions.addMenuItem(selectedTable, menuId);
  }

  async function incrementPendingItem(itemId: number): Promise<void> {
    await workflowController.actions.incrementPendingItem(selectedTable, itemId);
  }

  async function decrementPendingItem(itemId: number): Promise<void> {
    await workflowController.actions.decrementPendingItem(selectedTable, itemId);
  }

  async function commitPriceDraft(itemId: number): Promise<void> {
    await workflowController.actions.commitPriceDraft(selectedTable, itemId);
  }

  async function adjustItemPrice(itemId: number, deltaCents: number): Promise<void> {
    await workflowController.actions.adjustItemPrice(selectedTable, itemId, deltaCents);
  }

  async function sendToKitchen(): Promise<void> {
    await workflowController.actions.sendToKitchen(selectedTable);
  }

  async function clearPreOrder(): Promise<void> {
    await workflowController.actions.clearPreOrder(selectedTable);
  }

  async function removeOrder(orderId: string): Promise<void> {
    await workflowController.actions.removeOrder(selectedTable, orderId);
  }

  async function printTicket(): Promise<void> {
    await ticketController.actions.printTicket({
      selectedTable,
      confirmedOrders: tableConfirmedOrders,
      preorderItems: workflowController.state.preorderItems,
      menuByCategory: menuController.state.menuByCategory,
    });
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
