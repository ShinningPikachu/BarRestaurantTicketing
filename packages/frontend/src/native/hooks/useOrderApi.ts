import { apiService } from '../services';
import { logger } from '../utils/logger';

export function useOrderApi() {
  async function fetchTableOrders(tableNumber: number, tableZone: string) {
    try {
      logger.debug({ tableNumber, tableZone }, 'Fetching table orders');
      return await apiService.fetchTableWorkflow(tableNumber, tableZone);
    } catch (error) {
      logger.error({ error, tableNumber, tableZone }, 'Failed to fetch table orders');
      throw error;
    }
  }

  async function createOrder(tableNumber: number, tableZone: string) {
    try {
      logger.debug({ tableNumber, tableZone }, 'Creating order');
      return await apiService.createOrder(tableNumber, tableZone);
    } catch (error) {
      logger.error({ error, tableNumber, tableZone }, 'Failed to create order');
      throw error;
    }
  }

  async function deleteOrder(orderId: string) {
    try {
      logger.debug({ orderId }, 'Deleting order');
      return await apiService.deleteOrder(orderId);
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to delete order');
      throw error;
    }
  }

  return {
    fetchTableOrders,
    createOrder,
    deleteOrder,
  };
}
