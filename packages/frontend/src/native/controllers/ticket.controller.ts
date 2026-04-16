import { Alert } from 'react-native';
import { generateAndShareTicketPdf } from '../helpers';
import { SelectedTable } from '../app/app.types';
import { MenuItem, Order, PreOrderItem } from '../types';

export function useTicketController() {
  async function printTicket(params: {
    selectedTable: SelectedTable;
    confirmedOrders: Order[];
    preorderItems: PreOrderItem[];
    menuByCategory: Map<string, MenuItem[]>;
  }): Promise<void> {
    try {
      await generateAndShareTicketPdf(params);
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
