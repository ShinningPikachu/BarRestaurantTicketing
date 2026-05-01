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
        Alert.alert('Sin ticket', 'Envía artículos a cocina antes de imprimir el ticket de cliente.');
        return;
      }

      await printKitchenTicket({
        selectedTable: params.selectedTable,
        confirmedOrders: params.confirmedOrders,
      });
    } catch {
      Alert.alert('Error', 'No se pudo generar el PDF del ticket.');
    }
  }

  return {
    actions: {
      printTicket,
    }
  };
}
