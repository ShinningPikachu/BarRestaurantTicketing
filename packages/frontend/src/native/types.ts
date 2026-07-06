export enum TableZone {
  OUTSIDE = "outside",
  FLOOR1 = "floor1",
  FLOOR2 = "floor2",
}

export const TABLE_ZONES: TableZone[] = [
  TableZone.OUTSIDE,
  TableZone.FLOOR1,
  TableZone.FLOOR2,
];

export function normalizeTableZone(zone: string | null | undefined): TableZone {
  const normalized = (zone ?? TableZone.OUTSIDE).trim().toLowerCase();
  if (normalized === TableZone.FLOOR1) {
    return TableZone.FLOOR1;
  }
  if (normalized === TableZone.FLOOR2) {
    return TableZone.FLOOR2;
  }
  return TableZone.OUTSIDE;
}

export function tableZoneLabel(zone: TableZone): string {
  if (zone === TableZone.FLOOR1) {
    return 'Planta 1';
  }
  if (zone === TableZone.FLOOR2) {
    return 'Planta 2';
  }
  return 'Terraza';
}

export interface TableDef {
  number: number;
  zone: TableZone;
}

export interface TableId {
  zone: TableZone;
  number: number;
}

export function tableKey(table: TableId): string {
  return `${table.zone}-${table.number}`;
}

export interface MenuItem {
  id: number;
  name: string;
  primaryName?: string | null;
  secondaryName?: string | null;
  priceCents: number;
  costCents?: number | null;
  sku?: string;
  category: string;
  description?: string;
  imageDataUrl?: string | null;
  available?: boolean;
}

export interface OrderItem {
  id?: number;
  menuItemId?: number | null;
  name: string;
  primaryName?: string | null;
  secondaryName?: string | null;
  qty: number;
  unitPriceCents?: number;
  totalPriceCents?: number;
}

export interface Order {
  id: string;
  tableId?: number;
  table?: {
    id?: number;
    number: number;
    zone?: TableZone;
    seats?: number;
    name?: string;
  };
  status?: string;
  totalCents?: number;
  createdAt?: string;
  updatedAt?: string;
  items: OrderItem[];
}

export interface PreOrderItem {
  id: number;
  menuItemId?: number | null;
  name: string;
  primaryName?: string | null;
  secondaryName?: string | null;
  qty: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface BackendTable {
  id: number;
  number: number;
  zone?: string | null;
  seats?: number | null;
  name?: string | null;
  ticketPrintedAt?: string | null;
  hasPrintedTicket?: boolean;
  totalCents?: number;
  pendingItemCount?: number;
  confirmedItemCount?: number;
}

export type TableKitchenStatus = 'empty' | 'pending' | 'sent' | 'printed';

export interface TableWorkflow {
  table: BackendTable;
  preOrderItems: PreOrderItem[];
  orders: Order[];
}

export type PaymentMethod = 'cash' | 'card';
export type TicketPeriodPreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'previousMonth' | 'custom';

export interface PaidTicketItem {
  id: number;
  ticketId: string;
  orderId?: string | null;
  orderItemId?: number | null;
  menuItemId?: number | null;
  name: string;
  primaryName?: string | null;
  secondaryName?: string | null;
  qty: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface PaidTicket {
  id: string;
  ticketNumber: string;
  mode: string;
  method: PaymentMethod;
  tableNumber: number;
  tableZone: string;
  totalCents: number;
  taxableBaseCents: number;
  vatCents: number;
  vatRatePercent: number;
  splitPeople?: number | null;
  businessName?: string;
  tradeName?: string;
  businessTaxId?: string;
  businessAddress?: string | null;
  businessCity?: string | null;
  businessPhone?: string | null;
  terminalId?: string | null;
  cashierName?: string | null;
  customerName?: string | null;
  customerTaxId?: string | null;
  status?: string;
  relatedTicketNumber?: string | null;
  pdfFileReference?: string | null;
  auditMetadata?: string | null;
  createdAt: string;
  items: PaidTicketItem[];
}

export interface TicketHistorySummary {
  ticketCount: number;
  itemQuantity: number;
  totalCents: number;
  taxableBaseCents: number;
  vatCents: number;
  paymentTotals: Record<PaymentMethod, number>;
}

export interface SessionTicketSummary {
  id: string;
  ticketNumber: string;
  method: PaymentMethod;
  tableNumber: number;
  tableZone: string;
  totalCents: number;
  createdAt: string;
}

export interface SessionItemSummary {
  name: string;
  qty: number;
  totalCents: number;
}

export interface SessionSummary {
  sessionDate: string;
  startAt: string;
  endAt: string;
  ticketCount: number;
  totalCents: number;
  taxableBaseCents: number;
  vatCents: number;
  paymentTotals: {
    cash: number;
    card: number;
  };
  items: SessionItemSummary[];
  tickets: SessionTicketSummary[];
}

export interface PaymentResult {
  paidTicket: PaidTicket;
  workflow: TableWorkflow;
}
