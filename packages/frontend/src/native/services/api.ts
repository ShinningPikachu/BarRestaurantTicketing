import { Platform } from 'react-native';
import type { BackendTable, MenuItem, Order, PaidTicket, PaymentMethod, PaymentResult, TableWorkflow } from '../types';
import { logger } from '../utils/logger';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
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
  const json = await response.json().catch(() => undefined);

  if (!response.ok) {
    const apiResponse = json as ApiResponse<T> | undefined;
    const apiError = apiResponse?.error;
    const errorMessage = apiError?.message ? `${message}: ${apiError.message}` : `${message} (${response.status})`;

    logger.error({ status: response.status, error: apiError }, errorMessage);
    throw new ApiRequestError(errorMessage, response.status, apiError?.code);
  }

  // Handle new ApiResponse format from backend
  if (json && typeof json === 'object' && 'success' in json) {
    const apiResponse = json as ApiResponse<T>;
    if (apiResponse.success && 'data' in apiResponse) {
      return apiResponse.data as T;
    }
    if (!apiResponse.success && apiResponse.error) {
      const error = `${message}: ${apiResponse.error.message}`;
      logger.error({ error: apiResponse.error }, error);
      throw new ApiRequestError(error, response.status, apiResponse.error.code);
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

  async deleteTable(zone: string, number: number): Promise<{ ok: boolean }> {
    const response = await fetch(`${API_BASE_URL}/tables/${encodeURIComponent(zone)}/${number}`, {
      method: 'DELETE'
    });
    return parseOrThrow<{ ok: boolean }>(response, 'Failed to delete table');
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

  async payTable(
    tableNumber: number,
    tableZone: string,
    method: PaymentMethod,
    splitPeople?: number
  ): Promise<PaymentResult> {
    const response = await fetch(`${API_BASE_URL}/orders/pay-table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, tableZone, method, splitPeople })
    });
    return parseOrThrow<PaymentResult>(response, 'Failed to pay table');
  }

  async paySelectedItems(
    tableNumber: number,
    tableZone: string,
    method: PaymentMethod,
    items: Array<{ orderId: string; itemId: number; qty: number }>
  ): Promise<PaymentResult> {
    const response = await fetch(`${API_BASE_URL}/orders/pay-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, tableZone, method, items })
    });
    return parseOrThrow<PaymentResult>(response, 'Failed to pay selected items');
  }

  async fetchMenu(): Promise<MenuItem[]> {
    const response = await fetch(`${API_BASE_URL}/menu`);
    return parseOrThrow<MenuItem[]>(response, 'Failed to fetch menu');
  }

  async fetchManageMenu(): Promise<MenuItem[]> {
    const response = await fetch(`${API_BASE_URL}/menu/manage/all`);
    return parseOrThrow<MenuItem[]>(response, 'Failed to fetch menu for management');
  }

  async createMenuItem(payload: {
    name: string;
    priceCents: number;
    category: string;
    sku?: string | null;
    description?: string | null;
    imageDataUrl?: string | null;
    available?: boolean;
  }): Promise<MenuItem> {
    const response = await fetch(`${API_BASE_URL}/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return parseOrThrow<MenuItem>(response, 'Failed to create menu item');
  }

  async updateMenuItem(
    id: number,
    payload: {
      name?: string;
      priceCents?: number;
      category?: string;
      sku?: string | null;
      description?: string | null;
      imageDataUrl?: string | null;
      available?: boolean;
    }
  ): Promise<MenuItem> {
    const response = await fetch(`${API_BASE_URL}/menu/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return parseOrThrow<MenuItem>(response, 'Failed to update menu item');
  }

  async fetchPaidTickets(): Promise<PaidTicket[]> {
    const response = await fetch(`${API_BASE_URL}/tickets`);
    return parseOrThrow<PaidTicket[]>(response, 'Failed to fetch paid tickets');
  }
}

export const apiService = new ApiService();
