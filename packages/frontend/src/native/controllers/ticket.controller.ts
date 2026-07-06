import { Alert } from 'react-native';
import { printKitchenTicket } from '../helpers';
import { SelectedTable } from '../app/app.types';
import { Order, PreOrderItem } from '../types';

export function useTicketController() {
  async function printTicket(params: {
    selectedTable: SelectedTable;
    confirmedOrders: Order[];
    preorderItems: PreOrderItem[];
    splitPeople?: number;
    ticketNote?: string;
  }): Promise<boolean> {
    try {
      const hasItems = params.confirmedOrders.some((order) => order.items.length > 0);
      if (!hasItems) {
        Alert.alert('Sin ticket', 'Envía artículos a cocina antes de imprimir el ticket de cliente.');
        return false;
      }

      await printKitchenTicket({
        selectedTable: params.selectedTable,
        confirmedOrders: params.confirmedOrders,
        splitPeople: params.splitPeople,
        ticketNote: params.ticketNote,
      });
      return true;
    } catch {
      Alert.alert('Error', 'No se pudo imprimir el ticket.');
      return false;
    }
  }

  return {
    actions: {
      printTicket,
    }
  };
}
