import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import { Order, PreOrderItem } from '../types';
import { SelectedTable } from '../app/app.types';

const TICKET_SEQUENCE_STORAGE_KEY = 'bar-ticketing-spain-simplified-sequence';

type ExpoLikeGlobal = typeof globalThis & {
  process?: {
    env?: {
      EXPO_PUBLIC_TICKET_ISSUER_NAME?: string;
      EXPO_PUBLIC_TICKET_ISSUER_NIF?: string;
      EXPO_PUBLIC_TICKET_ISSUER_ADDRESS?: string;
      EXPO_PUBLIC_TICKET_SERIES?: string;
      EXPO_PUBLIC_TICKET_VAT_RATE?: string;
    };
  };
};

interface SpainTicketIssuer {
  legalName: string;
  nif: string;
  address: string;
}

interface SpainTicketConfig {
  issuer: SpainTicketIssuer;
  series: string;
  vatRatePercent: number;
}

function getSpainTicketConfig(): SpainTicketConfig {
  const env = (globalThis as ExpoLikeGlobal).process?.env;
  const vatRateRaw = Number(env?.EXPO_PUBLIC_TICKET_VAT_RATE ?? '10');
  const vatRatePercent = Number.isFinite(vatRateRaw) && vatRateRaw > 0 ? vatRateRaw : 10;

  return {
    issuer: {
      legalName: env?.EXPO_PUBLIC_TICKET_ISSUER_NAME ?? 'Bar Restaurant Ticketing',
      nif: env?.EXPO_PUBLIC_TICKET_ISSUER_NIF ?? 'PENDING-NIF',
      address: env?.EXPO_PUBLIC_TICKET_ISSUER_ADDRESS ?? 'PENDING-ADDRESS',
    },
    series: env?.EXPO_PUBLIC_TICKET_SERIES ?? 'FS',
    vatRatePercent,
  };
}

function eurosFromCents(cents: number): number {
  return cents / 100;
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatSpanishDateTime(date: Date): { date: string; time: string } {
  const dateLabel = date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeLabel = date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return { date: dateLabel, time: timeLabel };
}

async function nextTicketNumber(series: string): Promise<string> {
  const currentRaw = await AsyncStorage.getItem(TICKET_SEQUENCE_STORAGE_KEY);
  const currentNumber = Number(currentRaw ?? '0');
  const nextNumber = Number.isFinite(currentNumber) && currentNumber >= 0 ? currentNumber + 1 : 1;
  await AsyncStorage.setItem(TICKET_SEQUENCE_STORAGE_KEY, String(nextNumber));
  return `${series}-${String(nextNumber).padStart(6, '0')}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSpainTicketHtml(params: {
  selectedTable: SelectedTable;
  confirmedOrders: Order[];
  preorderItems: PreOrderItem[];
  ticketNumber: string;
  issuedAt: Date;
  config: SpainTicketConfig;
}): string {
  const { selectedTable, confirmedOrders, preorderItems, ticketNumber, issuedAt, config } = params;
  const { date, time } = formatSpanishDateTime(issuedAt);

  const lineItems = confirmedOrders.flatMap((order) => order.items);
  const pendingItems = preorderItems;
  const grossTotal = lineItems.reduce(
    (sum, item) => sum + eurosFromCents((item.unitPriceCents ?? 0) * item.qty),
    0
  );
  const pendingTotal = pendingItems.reduce(
    (sum, item) => sum + eurosFromCents(item.unitPriceCents * item.qty),
    0
  );
  const ticketTotal = grossTotal + pendingTotal;

  const vatRate = config.vatRatePercent / 100;
  const taxableBase = ticketTotal / (1 + vatRate);
  const vatQuota = ticketTotal - taxableBase;

  const rows = lineItems
    .map((item) => {
      const unit = eurosFromCents(item.unitPriceCents ?? 0);
      const lineTotal = unit * item.qty;
      return `
      <tr>
        <td class="item-name">${escapeHtml(item.name)}</td>
        <td class="qty">${item.qty}</td>
        <td class="right">${formatEuro(unit)}</td>
        <td class="right">${formatEuro(lineTotal)}</td>
      </tr>`;
    })
    .join('');

  const pendingRows = pendingItems
    .map((item) => {
      const unit = eurosFromCents(item.unitPriceCents);
      const lineTotal = unit * item.qty;
      return `
      <tr>
        <td class="item-name">${escapeHtml(item.name)}</td>
        <td class="qty">${item.qty}</td>
        <td class="right">${formatEuro(unit)}</td>
        <td class="right">${formatEuro(lineTotal)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Factura simplificada ${escapeHtml(ticketNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      color: #111;
      margin: 0 auto;
      max-width: 420px;
      padding: 20px 16px;
      background: #fff;
    }
    .center { text-align: center; }
    .title { font-size: 18px; font-weight: 700; margin: 0 0 4px; text-transform: uppercase; }
    .meta, .issuer, .summary {
      border-top: 1px dashed #999;
      padding-top: 8px;
      margin-top: 8px;
      font-size: 12px;
      line-height: 1.4;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 12px;
    }
    th, td {
      border-bottom: 1px solid #ddd;
      padding: 6px 2px;
      vertical-align: top;
    }
    th { text-align: left; font-size: 11px; text-transform: uppercase; }
    .item-name { width: 48%; }
    .qty { width: 10%; text-align: center; }
    .right { text-align: right; }
    .total-row td {
      border-top: 2px solid #111;
      border-bottom: none;
      font-weight: 700;
      font-size: 14px;
      padding-top: 10px;
    }
    .legal {
      margin-top: 12px;
      font-size: 10px;
      color: #444;
      line-height: 1.35;
      border-top: 1px dashed #999;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div class="center">
    <p class="title">Ticket / Factura simplificada</p>
    <div>${escapeHtml(ticketNumber)}</div>
  </div>

  <div class="issuer">
    <div><strong>${escapeHtml(config.issuer.legalName)}</strong></div>
    <div>NIF: ${escapeHtml(config.issuer.nif)}</div>
    <div>${escapeHtml(config.issuer.address)}</div>
  </div>

  <div class="meta">
    <div>Fecha de expedicion: ${date}</div>
    <div>Hora: ${time}</div>
    <div>Mesa: ${escapeHtml(selectedTable.zone)}-${selectedTable.number}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Concepto</th>
        <th class="qty">Uds</th>
        <th class="right">Precio</th>
        <th class="right">Importe</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4">Sin lineas facturables.</td></tr>'}
      <tr class="total-row">
        <td colspan="3">Total</td>
        <td class="right">${formatEuro(grossTotal)}</td>
      </tr>
    </tbody>
  </table>

  ${pendingItems.length > 0 ? `
  <div class="summary" style="margin-top: 14px;">
    <strong>Items pendientes</strong>
  </div>
  <table>
    <thead>
      <tr>
        <th>Concepto</th>
        <th class="qty">Uds</th>
        <th class="right">Precio</th>
        <th class="right">Importe</th>
      </tr>
    </thead>
    <tbody>
      ${pendingRows}
      <tr class="total-row">
        <td colspan="3">Subtotal pendiente</td>
        <td class="right">${formatEuro(pendingTotal)}</td>
      </tr>
    </tbody>
  </table>` : ''}

  <div class="summary">
    <div>Base imponible: ${formatEuro(taxableBase)}</div>
    <div>IVA (${config.vatRatePercent.toFixed(0)}%): ${formatEuro(vatQuota)}</div>
    <div>Contraprestacion total: <strong>${formatEuro(ticketTotal)}</strong></div>
    <div>IVA incluido</div>
  </div>

  <div class="legal">
    Documento emitido como factura simplificada para servicios de hosteleria y restauracion.
  </div>
</body>
</html>`;
}

export async function printSpainSimplifiedTicket(params: {
  selectedTable: SelectedTable;
  confirmedOrders: Order[];
  preorderItems: PreOrderItem[];
}): Promise<void> {
  const config = getSpainTicketConfig();
  const issuedAt = new Date();
  const ticketNumber = await nextTicketNumber(config.series);

  const html = buildSpainTicketHtml({
    selectedTable: params.selectedTable,
    confirmedOrders: params.confirmedOrders,
    preorderItems: params.preorderItems,
    ticketNumber,
    issuedAt,
    config,
  });

  await Print.printAsync({ html });
}
