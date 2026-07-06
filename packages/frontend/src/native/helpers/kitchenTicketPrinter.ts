import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import { Order, tableZoneLabel } from '../types';
import { SelectedTable } from '../app/app.types';
import { apiService } from '../services/api';
import { getItemDisplayName } from './itemDisplayName';

const SIMPLIFIED_INVOICE_SEQUENCE_STORAGE_KEY = 'bar-ticketing-simplified-invoice-sequence';

export interface SimplifiedInvoiceConfig {
  businessName: string;
  tradeName: string;
  nif: string;
  address: string;
  city: string;
  phone: string;
  series: string;
  vatRatePercent: number;
}

export function getSimplifiedInvoiceConfig(): SimplifiedInvoiceConfig {
  const vatRateRaw = Number(process.env.EXPO_PUBLIC_TICKET_VAT_RATE ?? '10');

  return {
    businessName: process.env.EXPO_PUBLIC_TICKET_BUSINESS_NAME ?? process.env.EXPO_PUBLIC_TICKET_ISSUER_NAME ?? 'YUYE CHEN',
    tradeName: process.env.EXPO_PUBLIC_TICKET_TRADE_NAME ?? 'Star Bar',
    nif: process.env.EXPO_PUBLIC_TICKET_BUSINESS_NIF ?? process.env.EXPO_PUBLIC_TICKET_ISSUER_NIF ?? 'X5126994-H',
    address: process.env.EXPO_PUBLIC_TICKET_BUSINESS_ADDRESS ?? process.env.EXPO_PUBLIC_TICKET_ISSUER_ADDRESS ?? 'Gran Via de les Corts Catalanes 669. Bis',
    city: process.env.EXPO_PUBLIC_TICKET_BUSINESS_CITY ?? '08013 Barcelona',
    phone: process.env.EXPO_PUBLIC_TICKET_BUSINESS_PHONE ?? '672295395',
    series: process.env.EXPO_PUBLIC_TICKET_SERIES ?? 'FS',
    vatRatePercent: Number.isFinite(vatRateRaw) && vatRateRaw > 0 ? vatRateRaw : 10,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function centsToEuro(cents: number): number {
  return cents / 100;
}

function formatEuroFromCents(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centsToEuro(cents));
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

async function nextInvoiceNumber(series: string): Promise<string> {
  const currentRaw = await AsyncStorage.getItem(SIMPLIFIED_INVOICE_SEQUENCE_STORAGE_KEY);
  const currentNumber = Number(currentRaw ?? '0');
  const nextNumber = Number.isFinite(currentNumber) && currentNumber >= 0 ? currentNumber + 1 : 1;
  await AsyncStorage.setItem(SIMPLIFIED_INVOICE_SEQUENCE_STORAGE_KEY, String(nextNumber));
  return `${series}-${String(nextNumber).padStart(6, '0')}`;
}

function getOrderLineTotalCents(item: { qty: number; unitPriceCents?: number; totalPriceCents?: number }): number {
  if (typeof item.totalPriceCents === 'number') {
    return item.totalPriceCents;
  }

  return (item.unitPriceCents ?? 0) * item.qty;
}

function shouldUseXprinterBridge(): boolean {
  const printMode = process.env.EXPO_PUBLIC_TICKET_PRINT_MODE?.trim().toLowerCase();

  return printMode === 'xprinter-lan' || printMode === 'xprinter-usb';
}

export function getOptionalXprinterTarget(): {
  printerHost?: string;
  printerPort?: number;
  printerName?: string;
  usbDevice?: string;
  openCashDrawer?: boolean;
} {
  const printerPort = Number(process.env.EXPO_PUBLIC_XPRINTER_PORT);
  return {
    printerHost: process.env.EXPO_PUBLIC_XPRINTER_HOST || undefined,
    printerPort: Number.isInteger(printerPort) && printerPort > 0 ? printerPort : undefined,
    printerName: process.env.EXPO_PUBLIC_XPRINTER_PRINTER_NAME || undefined,
    usbDevice: process.env.EXPO_PUBLIC_XPRINTER_USB_DEVICE || undefined,
    openCashDrawer: process.env.EXPO_PUBLIC_XPRINTER_OPEN_DRAWER === 'true' ? true : undefined,
  };
}

function getCombinedOrderLines(orders: Order[]): Array<{ name: string; primaryName?: string | null; secondaryName?: string | null; qty: number; unitPriceCents: number; totalPriceCents: number }> {
  const lineByKey = new Map<string, { name: string; primaryName?: string | null; secondaryName?: string | null; qty: number; unitPriceCents: number; totalPriceCents: number }>();

  for (const item of orders.flatMap((order) => order.items)) {
    const unitPriceCents = item.unitPriceCents ?? 0;
    const key = `${item.name.trim().toLowerCase()}|${unitPriceCents}`;
    const existing = lineByKey.get(key);

    if (existing) {
      existing.qty += item.qty;
      existing.totalPriceCents += getOrderLineTotalCents(item);
    } else {
      lineByKey.set(key, {
        name: item.name,
        primaryName: item.primaryName,
        secondaryName: item.secondaryName,
        qty: item.qty,
        unitPriceCents,
        totalPriceCents: getOrderLineTotalCents(item),
      });
    }
  }

  return Array.from(lineByKey.values());
}

function buildLineRows(orders: Order[]): string {
  return getCombinedOrderLines(orders)
    .map((item) => {
      const displayName = getItemDisplayName(item);
      return `
        <tr>
          <td class="qty">${item.qty}</td>
          <td class="name">
            <div class="item-primary">${escapeHtml(displayName.primary)}</div>
            ${displayName.secondary ? `<div class="item-secondary">${escapeHtml(displayName.secondary)}</div>` : ''}
          </td>
          <td class="money">${formatEuroFromCents(item.unitPriceCents)}</td>
          <td class="money">${formatEuroFromCents(item.totalPriceCents)}</td>
        </tr>`;
    })
    .join('');
}

function buildSimplifiedInvoiceHtml(params: {
  selectedTable: SelectedTable;
  confirmedOrders: Order[];
  invoiceNumber: string;
  issuedAt: Date;
  config: SimplifiedInvoiceConfig;
  splitPeople?: number;
  ticketNote?: string;
}): string {
  const { selectedTable, confirmedOrders, invoiceNumber, issuedAt, config, splitPeople, ticketNote } = params;
  const combinedLines = getCombinedOrderLines(confirmedOrders);
  const totalCents = combinedLines.reduce((sum, item) => sum + item.totalPriceCents, 0);
  const vatRate = config.vatRatePercent / 100;
  const taxableBaseCents = Math.round(totalCents / (1 + vatRate));
  const vatCents = totalCents - taxableBaseCents;
  const itemCount = combinedLines.reduce((sum, item) => sum + item.qty, 0);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Factura simplificada ${escapeHtml(invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    @page { margin: 8mm; }
    body {
      margin: 0;
      color: #111;
      background: #fff;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
    }
    .ticket {
      width: 100%;
      max-width: 360px;
      margin: 0 auto;
    }
    .center { text-align: center; }
    .business-name {
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      margin: 0 0 4px;
      overflow-wrap: anywhere;
    }
    .trade-name {
      font-size: 13px;
      font-weight: 700;
      margin: 0 0 4px;
      overflow-wrap: anywhere;
    }
    .small {
      font-size: 11px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .divider {
      border-top: 1px dashed #555;
      margin: 10px 0;
    }
    .title {
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      margin: 0 0 8px;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px 12px;
      font-size: 11px;
    }
    .meta strong {
      display: block;
      font-size: 10px;
      color: #444;
      text-transform: uppercase;
      margin-bottom: 1px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      padding: 5px 0;
      border-bottom: 1px solid #111;
      font-size: 10px;
      text-align: left;
      text-transform: uppercase;
    }
    td {
      padding: 6px 0;
      border-bottom: 1px solid #ddd;
      vertical-align: top;
    }
    .qty {
      width: 28px;
      text-align: center;
      font-weight: 800;
    }
    .name {
      width: auto;
      padding-right: 8px;
      overflow-wrap: anywhere;
    }
    .item-primary {
      font-weight: 700;
    }
    .item-secondary {
      color: #444;
      font-size: 10px;
      line-height: 1.25;
      margin-top: 1px;
    }
    .money {
      width: 66px;
      text-align: right;
      white-space: nowrap;
    }
    .summary {
      margin-top: 10px;
      font-size: 12px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 3px 0;
    }
    .total {
      border-top: 2px solid #111;
      margin-top: 5px;
      padding-top: 7px;
      font-size: 16px;
      font-weight: 900;
    }
    .legal {
      margin-top: 10px;
      font-size: 10px;
      line-height: 1.35;
      color: #333;
    }
  </style>
</head>
<body>
  <main class="ticket">
    <header class="center">
      <p class="business-name">${escapeHtml(config.tradeName)}</p>
      <p class="trade-name">${escapeHtml(config.businessName)}</p>
      <div class="small">NIF: ${escapeHtml(config.nif)}</div>
      <div class="small">${escapeHtml(config.address)}</div>
      ${config.city ? `<div class="small">${escapeHtml(config.city)}</div>` : ''}
      ${config.phone ? `<div class="small">Tel: ${escapeHtml(config.phone)}</div>` : ''}
    </header>

    <div class="divider"></div>

    <section>
      <p class="title center">Factura simplificada</p>
      <div class="meta">
        <div><strong>Numero / serie</strong>${escapeHtml(invoiceNumber)}</div>
        <div><strong>Fecha expedicion</strong>${escapeHtml(formatDateTime(issuedAt))}</div>
        <div><strong>Fecha operacion</strong>${escapeHtml(formatDateTime(issuedAt))}</div>
        <div><strong>Mesa</strong>${escapeHtml(tableZoneLabel(selectedTable.zone))} ${selectedTable.number}</div>
      </div>
    </section>

    <div class="divider"></div>

    <table>
      <thead>
        <tr>
          <th class="qty">Ud</th>
          <th>Concepto</th>
          <th class="money">Precio</th>
          <th class="money">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${buildLineRows(confirmedOrders)}
      </tbody>
    </table>

    <section class="summary">
      <div class="summary-row">
        <span>Articulos</span>
        <strong>${itemCount}</strong>
      </div>
      ${ticketNote ? `
      <div class="summary-row">
        <span>Modalidad</span>
        <strong>${escapeHtml(ticketNote)}</strong>
      </div>` : ''}
      <div class="summary-row">
        <span>Base imponible IVA ${config.vatRatePercent.toFixed(0)}%</span>
        <strong>${formatEuroFromCents(taxableBaseCents)}</strong>
      </div>
      <div class="summary-row">
        <span>IVA ${config.vatRatePercent.toFixed(0)}%</span>
        <strong>${formatEuroFromCents(vatCents)}</strong>
      </div>
      <div class="summary-row total">
        <span>Total IVA incluido</span>
        <strong>${formatEuroFromCents(totalCents)}</strong>
      </div>
      ${splitPeople && splitPeople > 1 ? `
      <div class="summary-row">
        <span>Comensales</span>
        <strong>${splitPeople}</strong>
      </div>
      <div class="summary-row">
        <span>Importe por persona</span>
        <strong>${formatEuroFromCents(Math.trunc(totalCents / splitPeople))}</strong>
      </div>` : ''}
    </section>

    <div class="divider"></div>

    <footer class="legal center">
      <div>IVA incluido. Documento emitido como factura simplificada.</div>
      <div>Gracias por su visita.</div>
    </footer>
  </main>
</body>
</html>`;
}

async function printHtmlInBrowser(html: string): Promise<void> {
  const documentRef = globalThis.document;
  if (!documentRef?.body) {
    throw new Error('Browser document is not available for printing');
  }

  const iframe = documentRef.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  documentRef.body.appendChild(iframe);

  const iframeWindow = iframe.contentWindow;
  const iframeDocument = iframe.contentDocument ?? iframeWindow?.document;
  if (!iframeWindow || !iframeDocument) {
    iframe.remove();
    throw new Error('Unable to create print frame');
  }

  iframeDocument.open();
  iframeDocument.write(html);
  iframeDocument.close();

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 100);
  });

  iframeWindow.focus();
  iframeWindow.print();

  window.setTimeout(() => {
    iframe.remove();
  }, 1000);
}

export async function printKitchenTicket(params: {
  selectedTable: SelectedTable;
  confirmedOrders: Order[];
  splitPeople?: number;
  ticketNote?: string;
}): Promise<void> {
  const config = getSimplifiedInvoiceConfig();
  const invoiceNumber = await nextInvoiceNumber(config.series);
  const issuedAt = new Date();
  const combinedLines = getCombinedOrderLines(params.confirmedOrders);
  const totalCents = combinedLines.reduce((sum, item) => sum + item.totalPriceCents, 0);
  const vatRate = config.vatRatePercent / 100;
  const taxableBaseCents = Math.round(totalCents / (1 + vatRate));
  const vatCents = totalCents - taxableBaseCents;

  if (shouldUseXprinterBridge()) {
    await apiService.printXprinterTicket({
      businessName: config.businessName,
      tradeName: config.tradeName,
      nif: config.nif,
      address: config.address,
      city: config.city || null,
      phone: config.phone || null,
      invoiceNumber,
      issuedAt: formatDateTime(issuedAt),
      tableLabel: `${tableZoneLabel(params.selectedTable.zone)} ${params.selectedTable.number}`,
      lines: combinedLines,
      taxableBaseCents,
      vatCents,
      vatRatePercent: config.vatRatePercent,
      totalCents,
      ticketNote: params.ticketNote ?? null,
      splitPeople: params.splitPeople ?? null,
      ...getOptionalXprinterTarget(),
    });
    return;
  }

  const html = buildSimplifiedInvoiceHtml({
    selectedTable: params.selectedTable,
    confirmedOrders: params.confirmedOrders,
    invoiceNumber,
    issuedAt,
    config,
    splitPeople: params.splitPeople,
    ticketNote: params.ticketNote,
  });

  if (Platform.OS === 'web') {
    await printHtmlInBrowser(html);
    return;
  }

  await Print.printAsync({ html });
}
