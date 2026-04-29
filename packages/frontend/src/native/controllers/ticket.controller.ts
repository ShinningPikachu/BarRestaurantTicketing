import { Alert } from 'react-native';
import { printSpainSimplifiedTicket } from '../helpers';
import { SelectedTable } from '../app/app.types';
import { Order, PreOrderItem } from '../types';

export function useTicketController() {
  async function printTicket(params: {
    selectedTable: SelectedTable;
    confirmedOrders: Order[];
    preorderItems: PreOrderItem[];
  }): Promise<void> {
    try {
      await printSpainSimplifiedTicket(params);
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
