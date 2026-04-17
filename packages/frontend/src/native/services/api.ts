import { Platform } from 'react-native';
import type { BackendTable, MenuItem, Order, TableWorkflow } from '../types';
import { logger } from '../utils/logger';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface ExpoLikeGlobal {
  process?: {
    env?: {
      EXPO_PUBLIC_API_BASE_URL?: string;
    };
  };
}

function defaultApiBaseUrl(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return 'http://localhost:3000/api';
}

const envBaseUrl = (globalThis as ExpoLikeGlobal).process?.env?.EXPO_PUBLIC_API_BASE_URL;
const API_BASE_URL = (envBaseUrl || defaultApiBaseUrl()).replace(/\/$/, '');

async function parseOrThrow<T>(response: Response, message: string): Promise<T> {
  if (!response.ok) {
    const error = `${message} (${response.status})`;
    logger.error({ status: response.status }, error);
    throw new Error(error);
  }

  const json = await response.json();

  // Handle new ApiResponse format from backend
  if (json && typeof json === 'object' && 'success' in json) {
    const apiResponse = json as ApiResponse<T>;
    if (apiResponse.success && apiResponse.data) {
      return apiResponse.data;
    }
    if (!apiResponse.success && apiResponse.error) {
      const error = `${message}: ${apiResponse.error.message}`;
      logger.error({ error: apiResponse.error }, error);
      throw new Error(error);
    }
  }

  // Fallback for direct data response (backward compatibility)
  return json as T;
}

export class ApiService {
  async fetchTables(): Promise<BackendTable[]> {
    const response = await fetch(`${API_BASE_URL}/tables`);
    return parseOrThrow<BackendTable[]>(response, 'Failed to fetch tables');
  }

  async addTable(zone: string): Promise<BackendTable> {
    const response = await fetch(`${API_BASE_URL}/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone })
    });
    return parseOrThrow<BackendTable>(response, 'Failed to add table');
  }

  async fetchTableWorkflow(tableNumber: number, tableZone: string): Promise<TableWorkflow> {
    const response = await fetch(`${API_BASE_URL}/tables/${encodeURIComponent(tableZone)}/${tableNumber}/workflow`);
    return parseOrThrow<TableWorkflow>(response, 'Failed to fetch table workflow');
  }

  async addPreOrderMenuItem(tableNumber: number, tableZone: string, menuItemId: number): Promise<TableWorkflow> {
    const response = await fetch(`${API_BASE_URL}/tables/${encodeURIComponent(tableZone)}/${tableNumber}/preorder/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuItemId })
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to add pre-order item');
  }

  async updatePreOrderItem(
    tableNumber: number,
    tableZone: string,
    itemId: number,
    payload: { qty?: number; unitPriceCents?: number }
  ): Promise<TableWorkflow> {
    const response = await fetch(`${API_BASE_URL}/tables/${encodeURIComponent(tableZone)}/${tableNumber}/preorder/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to update pre-order item');
  }

  async clearPreOrder(tableNumber: number, tableZone: string): Promise<TableWorkflow> {
    const response = await fetch(`${API_BASE_URL}/tables/${encodeURIComponent(tableZone)}/${tableNumber}/preorder/clear`, {
      method: 'POST'
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to clear pre-order');
  }

  async sendTablePreOrderToKitchen(tableNumber: number, tableZone: string): Promise<TableWorkflow> {
    const response = await fetch(`${API_BASE_URL}/tables/${encodeURIComponent(tableZone)}/${tableNumber}/send-to-kitchen`, {
      method: 'POST'
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to send pre-order to kitchen');
  }

  async fetchOrders(): Promise<Order[]> {
    const response = await fetch(`${API_BASE_URL}/orders`);
    return parseOrThrow<Order[]>(response, 'Failed to fetch orders');
  }

  async createOrder(tableNumber: number, tableZone: string): Promise<TableWorkflow> {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, tableZone })
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to create order');
  }

  async moveConfirmedItemToPreOrder(orderId: string, itemId: number): Promise<TableWorkflow> {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/items/${itemId}/move-to-preorder`, {
      method: 'POST'
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to move confirmed item to pre-order');
  }

  async deleteOrder(orderId: string): Promise<{ ok: boolean }> {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' });
    return parseOrThrow<{ ok: boolean }>(response, 'Failed to delete order');
  }

  async fetchMenu(): Promise<MenuItem[]> {
    const response = await fetch(`${API_BASE_URL}/menu`);
    return parseOrThrow<MenuItem[]>(response, 'Failed to fetch menu');
  }
}

export const apiService = new ApiService();
