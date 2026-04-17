import * as Print from 'expo-print';
import { Order, PreOrderItem } from '../types';
import { SelectedTable } from '../app/app.types';

function centsToCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildTicketHtml(params: {
  selectedTable: SelectedTable;
  confirmedOrders: Order[];
  preorderItems: PreOrderItem[];
  now: Date;
}): string {
  const { selectedTable, confirmedOrders, preorderItems, now } = params;

  // Flatten all confirmed items
  const confirmedItems = confirmedOrders.flatMap((order) => order.items);

  // Confirmed section rows
  const confirmedRows = confirmedItems.map((item) => {
    const unit = centsToCurrency(item.unitPriceCents ?? 0);
    const total = centsToCurrency((item.unitPriceCents ?? 0) * item.qty);
    return `
      <tr>
        <td class="item-name">${escapeHtml(item.name)}</td>
        <td class="qty">${item.qty}</td>
        <td class="price">${unit}</td>
        <td class="price">${total}</td>
      </tr>`;
  }).join('');

  // Pre-order section rows
  const preorderRows = preorderItems.map((item) => {
    const unit = centsToCurrency(item.unitPriceCents);
    const total = centsToCurrency(item.unitPriceCents * item.qty);
    return `
      <tr>
        <td class="item-name">${escapeHtml(item.name)}</td>
        <td class="qty">${item.qty}</td>
        <td class="price">${unit}</td>
        <td class="price">${total}</td>
      </tr>`;
  }).join('');

  // Totals
  const confirmedTotal = confirmedItems.reduce(
    (sum, item) => sum + (item.unitPriceCents ?? 0) * item.qty,
    0
  );
  const preorderTotal = preorderItems.reduce(
    (sum, item) => sum + item.unitPriceCents * item.qty,
    0
  );
  const grandTotal = confirmedTotal + preorderTotal;

  const hasSeparateSections = preorderItems.length > 0 && confirmedItems.length > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ticket — Table ${escapeHtml(selectedTable.zone)}-${selectedTable.number}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      background: #fff;
      color: #111;
      margin: 0;
      padding: 32px 24px;
      max-width: 480px;
      margin-left: auto;
      margin-right: auto;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #111;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header h1 {
      font-size: 22px;
      margin: 0 0 4px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .header .subtitle {
      font-size: 12px;
      color: #555;
      margin: 0;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 16px;
    }
    .meta strong {
      font-size: 15px;
    }
    .section-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      border-bottom: 1px dashed #bbb;
      padding-bottom: 4px;
      margin: 12px 0 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead th {
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #555;
      padding-bottom: 4px;
      border-bottom: 1px solid #ddd;
    }
    thead th.price { text-align: right; }
    thead th.qty { text-align: center; }
    td {
      padding: 5px 0;
      vertical-align: top;
    }
    td.item-name { width: 50%; }
    td.qty { width: 10%; text-align: center; }
    td.price { width: 20%; text-align: right; }
    .modified {
      font-size: 10px;
      color: #e67e22;
    }
    .empty-section {
      font-size: 12px;
      color: #999;
      font-style: italic;
      padding: 6px 0;
    }
    .totals {
      margin-top: 16px;
      border-top: 2px solid #111;
      padding-top: 10px;
    }
    .totals table {
      font-size: 14px;
    }
    .totals td.label { text-align: left; color: #555; }
    .totals td.amount { text-align: right; font-weight: bold; }
    .grand-total td {
      font-size: 17px;
      font-weight: bold;
      padding-top: 8px;
      border-top: 1px solid #111;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 11px;
      color: #999;
      border-top: 1px dashed #bbb;
      padding-top: 10px;
    }
    .pending-badge {
      display: inline-block;
      background: #fff3cd;
      border: 1px solid #ffc107;
      color: #856404;
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Bar &amp; Restaurant</h1>
    <p class="subtitle">Kitchen &amp; Table Ticket</p>
  </div>

  <div class="meta">
    <div>
      <div>Table</div>
      <strong>${escapeHtml(selectedTable.zone)}-${selectedTable.number}</strong>
    </div>
    <div style="text-align:right;">
      <div>${formatDate(now)}</div>
      <strong>${formatTime(now)}</strong>
    </div>
  </div>

  ${hasSeparateSections || confirmedItems.length > 0 ? `
  <div class="section-label">Confirmed Orders</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="qty">Qty</th>
        <th class="price">Unit</th>
        <th class="price">Total</th>
      </tr>
    </thead>
    <tbody>
      ${confirmedRows || '<tr><td colspan="4" class="empty-section">No confirmed orders.</td></tr>'}
    </tbody>
  </table>` : ''}

  ${preorderItems.length > 0 ? `
  <div class="section-label">
    Pending Items <span class="pending-badge">Not sent</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="qty">Qty</th>
        <th class="price">Unit</th>
        <th class="price">Total</th>
      </tr>
    </thead>
    <tbody>
      ${preorderRows}
    </tbody>
  </table>` : ''}

  <div class="totals">
    <table>
      ${hasSeparateSections ? `
      <tr>
        <td class="label">Confirmed subtotal</td>
        <td class="amount">${centsToCurrency(confirmedTotal)}</td>
      </tr>
      <tr>
        <td class="label">Pending subtotal</td>
        <td class="amount">${centsToCurrency(preorderTotal)}</td>
      </tr>` : ''}
      <tr class="grand-total">
        <td class="label">Total</td>
        <td class="amount">${centsToCurrency(grandTotal)}</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    Generated ${formatDate(now)} at ${formatTime(now)}<br/>
    Thank you for your visit!
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function generateAndShareTicketPdf(params: {
  selectedTable: SelectedTable;
  confirmedOrders: Order[];
  preorderItems: PreOrderItem[];
}): Promise<void> {
  const now = new Date();
  const html = buildTicketHtml({ ...params, now });

  // Always print the generated ticket HTML directly so "Print Kitchen Ticket"
  // opens a print flow for ticket content.
  await Print.printAsync({ html });
}
