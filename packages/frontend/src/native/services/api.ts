import { Platform } from 'react-native';
import type { BackendTable, MenuItem, Order, PaidTicket, PaymentMethod, PaymentResult, SessionSummary, TableWorkflow } from '../types';
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
  private authToken: string | null = null;

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  async login(accessCode: string): Promise<{ token: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode })
    });
    const result = await parseOrThrow<{ token: string }>(response, 'Failed to login');
    this.setAuthToken(result.token);
    return result;
  }

  private request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.authToken) {
      headers.set('Authorization', `Bearer ${this.authToken}`);
    }

    return fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  }

  async fetchTables(): Promise<BackendTable[]> {
    const response = await this.request('/tables');
    return parseOrThrow<BackendTable[]>(response, 'Failed to fetch tables');
  }

  async addTable(zone: string): Promise<BackendTable> {
    const response = await this.request('/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone })
    });
    return parseOrThrow<BackendTable>(response, 'Failed to add table');
  }

  async deleteTable(zone: string, number: number): Promise<{ ok: boolean }> {
    const response = await this.request(`/tables/${encodeURIComponent(zone)}/${number}`, {
      method: 'DELETE'
    });
    return parseOrThrow<{ ok: boolean }>(response, 'Failed to delete table');
  }

  async fetchTableWorkflow(tableNumber: number, tableZone: string): Promise<TableWorkflow> {
    const response = await this.request(`/tables/${encodeURIComponent(tableZone)}/${tableNumber}/workflow`);
    return parseOrThrow<TableWorkflow>(response, 'Failed to fetch table workflow');
  }

  async addPreOrderMenuItem(tableNumber: number, tableZone: string, menuItemId: number): Promise<TableWorkflow> {
    const response = await this.request(`/tables/${encodeURIComponent(tableZone)}/${tableNumber}/preorder/items`, {
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
    const response = await this.request(`/tables/${encodeURIComponent(tableZone)}/${tableNumber}/preorder/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to update pre-order item');
  }

  async clearPreOrder(tableNumber: number, tableZone: string): Promise<TableWorkflow> {
    const response = await this.request(`/tables/${encodeURIComponent(tableZone)}/${tableNumber}/preorder/clear`, {
      method: 'POST'
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to clear pre-order');
  }

  async sendTablePreOrderToKitchen(tableNumber: number, tableZone: string): Promise<TableWorkflow> {
    const response = await this.request(`/tables/${encodeURIComponent(tableZone)}/${tableNumber}/send-to-kitchen`, {
      method: 'POST'
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to send pre-order to kitchen');
  }

  async fetchOrders(): Promise<Order[]> {
    const response = await this.request('/orders');
    return parseOrThrow<Order[]>(response, 'Failed to fetch orders');
  }

  async createOrder(tableNumber: number, tableZone: string): Promise<TableWorkflow> {
    const response = await this.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, tableZone })
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to create order');
  }

  async moveConfirmedItemToPreOrder(orderId: string, itemId: number): Promise<TableWorkflow> {
    const response = await this.request(`/orders/${orderId}/items/${itemId}/move-to-preorder`, {
      method: 'POST'
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to move confirmed item to pre-order');
  }

  async deleteOrder(orderId: string): Promise<{ ok: boolean }> {
    const response = await this.request(`/orders/${orderId}`, { method: 'DELETE' });
    return parseOrThrow<{ ok: boolean }>(response, 'Failed to delete order');
  }

  async payTable(
    tableNumber: number,
    tableZone: string,
    method: PaymentMethod,
    splitPeople?: number
  ): Promise<PaymentResult> {
    const response = await this.request('/orders/pay-table', {
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
    const response = await this.request('/orders/pay-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, tableZone, method, items })
    });
    return parseOrThrow<PaymentResult>(response, 'Failed to pay selected items');
  }

  async fetchMenu(): Promise<MenuItem[]> {
    const response = await this.request('/menu');
    return parseOrThrow<MenuItem[]>(response, 'Failed to fetch menu');
  }

  async fetchManageMenu(): Promise<MenuItem[]> {
    const response = await this.request('/menu/manage/all');
    return parseOrThrow<MenuItem[]>(response, 'Failed to fetch menu for management');
  }

  async createMenuItem(payload: {
    name: string;
    priceCents: number;
    costCents?: number | null;
    category: string;
    sku?: string | null;
    description?: string | null;
    imageDataUrl?: string | null;
    available?: boolean;
  }): Promise<MenuItem> {
    const response = await this.request('/menu', {
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
      costCents?: number | null;
      category?: string;
      sku?: string | null;
      description?: string | null;
      imageDataUrl?: string | null;
      available?: boolean;
    }
  ): Promise<MenuItem> {
    const response = await this.request(`/menu/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return parseOrThrow<MenuItem>(response, 'Failed to update menu item');
  }

  async importMenuCsv(csv: string): Promise<{ created: number; updated: number; total: number }> {
    const response = await this.request('/menu/import/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv })
    });
    return parseOrThrow<{ created: number; updated: number; total: number }>(response, 'Failed to import menu CSV');
  }

  async fetchPaidTickets(): Promise<PaidTicket[]> {
    const response = await this.request('/tickets');
    return parseOrThrow<PaidTicket[]>(response, 'Failed to fetch paid tickets');
  }

  async fetchSessionSummary(): Promise<SessionSummary> {
    const response = await this.request('/tickets/summary/session');
    return parseOrThrow<SessionSummary>(response, 'Failed to fetch session summary');
  }

  async printXprinterTicket(payload: {
    businessName: string;
    tradeName: string;
    nif: string;
    address: string;
    city?: string | null;
    phone?: string | null;
    invoiceNumber: string;
    issuedAt: string;
    tableLabel: string;
    lines: Array<{ name: string; qty: number; unitPriceCents: number; totalPriceCents: number }>;
    taxableBaseCents: number;
    vatCents: number;
    vatRatePercent: number;
    totalCents: number;
    ticketNote?: string | null;
    splitPeople?: number | null;
    openCashDrawer?: boolean | null;
    printerHost?: string;
    printerPort?: number;
    printerName?: string;
    usbDevice?: string;
  }): Promise<{ printed: boolean }> {
    const response = await this.request('/printers/xprinter/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return parseOrThrow<{ printed: boolean }>(response, 'Failed to print Xprinter ticket');
  }

  async openXprinterCashDrawer(payload: {
    printerHost?: string;
    printerPort?: number;
    printerName?: string;
    usbDevice?: string;
  } = {}): Promise<{ opened: boolean }> {
    const response = await this.request('/printers/xprinter/drawer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return parseOrThrow<{ opened: boolean }>(response, 'Failed to open cash drawer');
  }
}

export const apiService = new ApiService();
