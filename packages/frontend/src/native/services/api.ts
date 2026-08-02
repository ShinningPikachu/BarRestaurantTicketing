import { Platform } from 'react-native';
import type { BackendTable, MenuItem, PaidTicket, PaymentMethod, PaymentResult, SessionSummary, TableWorkflow } from '../types';
import { logger } from '../utils/logger';

export interface SyncRevision {
  instanceId: string;
  revision: number;
  changedAt: string;
  scope: 'menu' | 'orders' | 'tables' | null;
}

export type PrinterConnectionState = 'connected' | 'disconnected' | 'unavailable' | 'busy' | 'out_of_paper' | 'error' | 'unknown';
export type PrinterJobKind = 'ticket' | 'financial-summary' | 'test-print' | 'cash-drawer';

export interface PrinterStatus {
  state: PrinterConnectionState;
  printerName: string;
  connectionType: string;
  address: string | null;
  dataFormat: 'escpos' | 'text';
  lastSuccessfulConnectionAt: string | null;
  lastSuccessfulPrintAt: string | null;
  lastStateChangeAt: string;
  error: string | null;
  queue: {
    pending: number;
    external: number | null;
    active: boolean;
    activeJobId: string | null;
    activeJobKind: PrinterJobKind | null;
  };
}

export interface PrinterJobResponse {
  printed: boolean;
  jobId: string;
  deduplicated: boolean;
  acceptedAt: string;
  completedAt: string;
}

export interface PrinterDiagnostics {
  status: PrinterStatus;
  paperColumns: number;
  cutMode: string;
  safeRetryLimit: number;
  queueLimit: number;
  note: string;
  recentJobs: Array<{
    jobId: string;
    kind: PrinterJobKind;
    state: 'completed' | 'failed' | 'cancelled';
    createdAt: string;
    completedAt: string;
    attempts: number;
    error: string | null;
  }>;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const CONNECTION_TEST_TIMEOUT_MS = 7_500;
const PRINTER_REQUEST_TIMEOUT_MS = 45_000;

let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export function setApiUnauthorizedHandler(handler: (() => void | Promise<void>) | null): void {
  unauthorizedHandler = handler;
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });
  }

  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      const wasExternallyAborted = externalSignal?.aborted ?? false;
      throw new ApiRequestError(
        wasExternallyAborted ? 'Request cancelled' : 'Request timed out',
        0,
        wasExternallyAborted ? 'REQUEST_ABORTED' : 'REQUEST_TIMEOUT'
      );
    }
    throw new ApiRequestError('Network request failed', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

function defaultApiBaseUrl(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return 'http://localhost:3000/api';
}

const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
let apiBaseUrl = (envBaseUrl || defaultApiBaseUrl()).replace(/\/$/, '');

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function normalizeApiBaseUrl(value: string): string {
  const input = value.trim();
  const candidate = /^https?:\/\//i.test(input) ? input : `http://${input}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Dirección del ordenador no válida.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('Dirección del ordenador no válida.');
  }

  const trimmedPath = parsed.pathname.replace(/\/+$/, '');
  const apiPath = trimmedPath.endsWith('/api') ? trimmedPath : `${trimmedPath}/api`;
  return `${parsed.protocol}//${parsed.host}${apiPath}`.replace(/\/$/, '');
}

export function setApiBaseUrl(value: string): string {
  apiBaseUrl = normalizeApiBaseUrl(value);
  return apiBaseUrl;
}

export async function testApiConnection(value: string): Promise<string> {
  const normalized = normalizeApiBaseUrl(value);
  const backendBase = normalized.replace(/\/api$/, '');
  const response = await fetchWithTimeout(`${backendBase}/health`, {}, CONNECTION_TEST_TIMEOUT_MS);
  const result = await parseOrThrow<{ status: string }>(response, 'No se pudo validar el servidor');
  if (result?.status !== 'ok') {
    throw new ApiRequestError('El servidor no devolvió una respuesta de salud válida.', response.status, 'INVALID_HEALTH_RESPONSE');
  }
  return normalized;
}

async function parseOrThrow<T>(response: Response, message: string): Promise<T> {
  const responseText = await response.text();
  let json: unknown;
  if (responseText.trim()) {
    try {
      json = JSON.parse(responseText) as unknown;
    } catch {
      const errorMessage = `${message}: invalid JSON response (${response.status})`;
      logger.error({ status: response.status }, errorMessage);
      throw new ApiRequestError(errorMessage, response.status, 'INVALID_RESPONSE');
    }
  }

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

    const error = `${message}: malformed API response`;
    logger.error({ response: apiResponse }, error);
    throw new ApiRequestError(error, response.status, 'INVALID_RESPONSE');
  }

  // Fallback for direct data response (backward compatibility)
  if (json === undefined) {
    const error = `${message}: empty response`;
    logger.error({ status: response.status }, error);
    throw new ApiRequestError(error, response.status, 'INVALID_RESPONSE');
  }
  return json as T;
}

export class ApiService {
  private authToken: string | null = null;
  private authGeneration = 0;

  setAuthToken(token: string | null): void {
    this.authToken = token;
    this.authGeneration += 1;
  }

  async login(accessCode: string): Promise<{ token: string }> {
    const response = await fetchWithTimeout(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode })
    });
    const result = await parseOrThrow<{ token: string }>(response, 'Failed to login');
    this.setAuthToken(result.token);
    return result;
  }

  private async request(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<Response> {
    const headers = new Headers(init.headers);
    const authGeneration = this.authGeneration;
    if (this.authToken) {
      headers.set('Authorization', `Bearer ${this.authToken}`);
    }

    const response = await fetchWithTimeout(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    }, timeoutMs);
    // Ignore an unauthorized response belonging to an older login or server.
    if (response.status === 401 && authGeneration === this.authGeneration) {
      void unauthorizedHandler?.();
    }
    return response;
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

  async ensureTableZone(zone: string): Promise<BackendTable> {
    const response = await this.request('/tables/ensure-zone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone })
    });
    return parseOrThrow<BackendTable>(response, 'Failed to ensure table zone');
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

  async markTableTicketPrinted(tableNumber: number, tableZone: string): Promise<BackendTable> {
    const response = await this.request(`/tables/${encodeURIComponent(tableZone)}/${tableNumber}/ticket-printed`, {
      method: 'POST'
    });
    return parseOrThrow<BackendTable>(response, 'Failed to mark table ticket as printed');
  }

  async sendTablePreOrderToKitchen(tableNumber: number, tableZone: string): Promise<TableWorkflow> {
    const response = await this.request(`/tables/${encodeURIComponent(tableZone)}/${tableNumber}/send-to-kitchen`, {
      method: 'POST'
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to send pre-order to kitchen');
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
    splitPeople: number | undefined,
    idempotencyKey: string
  ): Promise<PaymentResult> {
    const response = await this.request('/orders/pay-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, tableZone, method, splitPeople, idempotencyKey })
    });
    return parseOrThrow<PaymentResult>(response, 'Failed to pay table');
  }

  async paySelectedItems(
    tableNumber: number,
    tableZone: string,
    method: PaymentMethod,
    items: Array<{ orderId: string; itemId: number; qty: number }>,
    idempotencyKey: string
  ): Promise<PaymentResult> {
    const response = await this.request('/orders/pay-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, tableZone, method, items, idempotencyKey })
    });
    return parseOrThrow<PaymentResult>(response, 'Failed to pay selected items');
  }

  async removeSelectedItems(
    tableNumber: number,
    tableZone: string,
    items: Array<{ orderId: string; itemId: number; qty: number }>,
    idempotencyKey: string
  ): Promise<TableWorkflow> {
    const response = await this.request('/orders/remove-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, tableZone, items, idempotencyKey })
    });
    return parseOrThrow<TableWorkflow>(response, 'Failed to remove selected items');
  }

  async fetchMenu(): Promise<MenuItem[]> {
    const response = await this.request('/menu');
    return parseOrThrow<MenuItem[]>(response, 'Failed to fetch menu');
  }

  async fetchManageMenu(): Promise<MenuItem[]> {
    const response = await this.request('/menu/manage/all');
    return parseOrThrow<MenuItem[]>(response, 'Failed to fetch menu for management');
  }

  async fetchPairingApiBaseUrl(): Promise<string> {
    const response = await this.request('/pairing');
    const result = await parseOrThrow<{ apiBaseUrl: string }>(response, 'Failed to fetch pairing address');
    return result.apiBaseUrl;
  }

  async createMenuItem(payload: {
    name: string;
    primaryName?: string | null;
    secondaryName?: string | null;
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
      primaryName?: string | null;
      secondaryName?: string | null;
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

  async deleteMenuItem(id: number): Promise<{ ok: boolean }> {
    const response = await this.request(`/menu/${id}`, {
      method: 'DELETE'
    });
    return parseOrThrow<{ ok: boolean }>(response, 'Failed to delete menu item');
  }

  async importMenuCsv(csv: string): Promise<{ created: number; updated: number; total: number }> {
    const response = await this.request('/menu/import/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv })
    });
    return parseOrThrow<{ created: number; updated: number; total: number }>(response, 'Failed to import menu CSV');
  }

  async fetchPaidTickets(params: { startAt?: string; endAt?: string } = {}): Promise<PaidTicket[]> {
    const query = new URLSearchParams();
    if (params.startAt) {
      query.set('startAt', params.startAt);
    }
    if (params.endAt) {
      query.set('endAt', params.endAt);
    }

    const queryString = query.toString();
    const response = await this.request(`/tickets${queryString ? `?${queryString}` : ''}`);
    return parseOrThrow<PaidTicket[]>(response, 'Failed to fetch paid tickets');
  }

  async fetchSessionSummary(): Promise<SessionSummary> {
    const response = await this.request('/tickets/summary/session');
    return parseOrThrow<SessionSummary>(response, 'Failed to fetch session summary');
  }

  async fetchSyncRevision(): Promise<SyncRevision> {
    const response = await this.request('/sync/revision');
    return parseOrThrow<SyncRevision>(response, 'Failed to fetch sync revision');
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
    lines: Array<{ name: string; primaryName?: string | null; secondaryName?: string | null; qty: number; unitPriceCents: number; totalPriceCents: number }>;
    taxableBaseCents: number;
    vatCents: number;
    vatRatePercent: number;
    totalCents: number;
    ticketNote?: string | null;
    splitPeople?: number | null;
  }): Promise<PrinterJobResponse> {
    const response = await this.request('/printers/xprinter/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, PRINTER_REQUEST_TIMEOUT_MS);
    return parseOrThrow<PrinterJobResponse>(response, 'Failed to print Xprinter ticket');
  }

  async printPaidTicket(ticketId: string): Promise<PrinterJobResponse & { ticketId: string }> {
    const response = await this.request(`/printers/xprinter/paid-ticket/${encodeURIComponent(ticketId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }, PRINTER_REQUEST_TIMEOUT_MS);
    return parseOrThrow<PrinterJobResponse & { ticketId: string }>(response, 'Failed to reprint paid ticket');
  }

  async printXprinterFinancialSummary(payload: {
    businessName: string;
    tradeName: string;
    nif: string;
    periodLabel: string;
    issuedAt: string;
    ticketCount: number;
    itemQuantity: number;
    taxableBaseCents: number;
    vatCents: number;
    vatRateLabel?: string | null;
    totalCents: number;
    cashCents: number;
    cardCents: number;
    firstTicketNumber?: string | null;
    lastTicketNumber?: string | null;
    dailyTotals: Array<{
      dayLabel: string;
      ticketCount: number;
      itemQuantity: number;
      taxableBaseCents: number;
      vatCents: number;
      totalCents: number;
      cashCents: number;
      cardCents: number;
    }>;
  }): Promise<PrinterJobResponse> {
    const response = await this.request('/printers/xprinter/financial-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, PRINTER_REQUEST_TIMEOUT_MS);
    return parseOrThrow<PrinterJobResponse>(response, 'Failed to print Xprinter financial summary');
  }

  async openXprinterCashDrawer(): Promise<PrinterJobResponse & { opened: boolean }> {
    const response = await this.request('/printers/xprinter/drawer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }, PRINTER_REQUEST_TIMEOUT_MS);
    return parseOrThrow<PrinterJobResponse & { opened: boolean }>(response, 'Failed to open cash drawer');
  }

  async fetchPrinterStatus(): Promise<PrinterStatus> {
    const response = await this.request('/printers/status');
    return parseOrThrow<PrinterStatus>(response, 'Failed to read printer status');
  }

  async reconnectPrinter(): Promise<PrinterStatus> {
    const response = await this.request('/printers/reconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }, PRINTER_REQUEST_TIMEOUT_MS);
    return parseOrThrow<PrinterStatus>(response, 'Failed to reconnect printer');
  }

  async runSafePrinterTest(): Promise<PrinterJobResponse> {
    const response = await this.request('/printers/test-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }, PRINTER_REQUEST_TIMEOUT_MS);
    return parseOrThrow<PrinterJobResponse>(response, 'Failed to run printer test');
  }

  async cancelPendingPrinterJobs(): Promise<{ cancelled: number; status: PrinterStatus }> {
    const response = await this.request('/printers/queue/pending', { method: 'DELETE' });
    return parseOrThrow<{ cancelled: number; status: PrinterStatus }>(response, 'Failed to cancel pending printer jobs');
  }

  async fetchPrinterDiagnostics(): Promise<PrinterDiagnostics> {
    const response = await this.request('/printers/diagnostics');
    return parseOrThrow<PrinterDiagnostics>(response, 'Failed to load printer diagnostics');
  }
}

export const apiService = new ApiService();
