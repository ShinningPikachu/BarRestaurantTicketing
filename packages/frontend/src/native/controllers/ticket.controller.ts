import { Alert } from 'react-native';
import { printKitchenTicket } from '../helpers';
import { SelectedTable } from '../app/app.types';
import { Order, PreOrderItem } from '../types';

export function useTicketController() {
  async function printTicket(params: {
    selectedTable: SelectedTable;
    confirmedOrders: Order[];
    preorderItems: PreOrderItem[];
  }): Promise<void> {
    try {
      if (params.confirmedOrders.length === 0) {
        Alert.alert('No ticket', 'Send items to the kitchen before printing the customer ticket.');
        return;
      }

      await printKitchenTicket({
        selectedTable: params.selectedTable,
        confirmedOrders: params.confirmedOrders,
      });
    } catch {
      Alert.alert('Error', 'Failed to generate the ticket PDF.');
    }
  }

  return {
    actions: {
      printTicket,
    }
  };
}
