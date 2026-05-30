import net from 'node:net';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { config } from '../config/index.js';

interface TicketLine {
  name: string;
  primaryName?: string | null;
  secondaryName?: string | null;
  qty: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

const RECEIPT_WIDTH = 48;
const ITEM_QTY_WIDTH = 4;
const ITEM_UNIT_PRICE_WIDTH = 10;
const ITEM_TOTAL_WIDTH = 12;
const ITEM_NAME_WIDTH = RECEIPT_WIDTH - ITEM_QTY_WIDTH - ITEM_UNIT_PRICE_WIDTH - ITEM_TOTAL_WIDTH;

function getLineDisplayName(item: Pick<TicketLine, 'name' | 'primaryName' | 'secondaryName'>): { primary: string; secondary: string | null } {
  const cleanDisplayName = (value: string | null | undefined) => {
    const trimmed = value?.trim() ?? '';
    return /^\.+$/.test(trimmed) ? '' : trimmed;
  };
  const primaryName = cleanDisplayName(item.primaryName);
  const secondaryName = cleanDisplayName(item.secondaryName);

  if (primaryName) {
    return { primary: primaryName, secondary: secondaryName || null };
  }

  return { primary: item.name.trim(), secondary: null };
}

export interface XprinterTicketPayload {
  businessName: string;
  tradeName: string;
  nif: string;
  address: string;
  city?: string | null;
  phone?: string | null;
  invoiceNumber: string;
  issuedAt: string;
  tableLabel: string;
  lines: TicketLine[];
  taxableBaseCents: number;
  vatCents: number;
  vatRatePercent: number;
  totalCents: number;
  ticketNote?: string | null;
  splitPeople?: number | null;
  openCashDrawer?: boolean | null;
}

export class PrinterTransportError extends Error {
  constructor(
    message: string,
    public code = 'PRINTER_UNAVAILABLE'
  ) {
    super(message);
    this.name = 'PrinterTransportError';
  }
}

function normalizeReceiptText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[€]/g, 'EUR')
    .replace(/[^\x20-\x7E\n]/g, '');
}

function money(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`;
}

function line(left: string, right = '', width = RECEIPT_WIDTH): string {
  const cleanLeft = normalizeReceiptText(left);
  const cleanRight = normalizeReceiptText(right);
  if (!cleanRight) return cleanLeft.slice(0, width);

  const space = Math.max(1, width - cleanLeft.length - cleanRight.length);
  return `${cleanLeft.slice(0, width - cleanRight.length - 1)}${' '.repeat(space)}${cleanRight}`;
}

function receiptColumn(value: string, width: number, align: 'left' | 'right' = 'left'): string {
  const clean = normalizeReceiptText(value).slice(0, width);
  return align === 'right' ? clean.padStart(width, ' ') : clean.padEnd(width, ' ');
}

function itemLine(qty: string, name: string, unitPrice: string, totalPrice: string): string {
  return [
    receiptColumn(qty, ITEM_QTY_WIDTH),
    receiptColumn(name, ITEM_NAME_WIDTH),
    receiptColumn(unitPrice, ITEM_UNIT_PRICE_WIDTH, 'right'),
    receiptColumn(totalPrice, ITEM_TOTAL_WIDTH, 'right'),
  ].join('');
}

function wrap(value: string, width = RECEIPT_WIDTH): string[] {
  const words = normalizeReceiptText(value).split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word.slice(0, width);
      continue;
    }
    if (current.length + 1 + word.length <= width) {
      current = `${current} ${word}`;
    } else {
      rows.push(current);
      current = word.slice(0, width);
    }
  }

  if (current) rows.push(current);
  return rows.length > 0 ? rows : [''];
}

function center(value: string, width = RECEIPT_WIDTH): string {
  const clean = normalizeReceiptText(value).slice(0, width);
  const left = Math.max(0, Math.floor((width - clean.length) / 2));
  return `${' '.repeat(left)}${clean}`;
}

function buildEscPosTicket(payload: XprinterTicketPayload): Buffer {
  const chunks: Buffer[] = [];
  const push = (value: string | number[]) => {
    chunks.push(Array.isArray(value) ? Buffer.from(value) : Buffer.from(`${value}\n`, 'ascii'));
  };

  push([0x1b, 0x40]); // Initialize
  if (payload.openCashDrawer) {
    push([0x1b, 0x70, 0x00, 0x19, 0xfa]); // Cash drawer pulse on pin 2
  }
  push([0x1b, 0x4d, 0x00]); // Font A
  push([0x1b, 0x61, 0x01]); // Center
  push([0x1d, 0x21, 0x11]); // Double width + height
  push([0x1b, 0x45, 0x01]); // Bold on
  push(payload.tradeName.toUpperCase());
  push([0x1d, 0x21, 0x00]); // Normal size
  push(payload.businessName);
  push([0x1b, 0x45, 0x00]); // Bold off
  push(`NIF: ${payload.nif}`);
  for (const row of wrap(payload.address, RECEIPT_WIDTH - 4)) push(row);
  if (payload.city) push(payload.city);
  if (payload.phone) push(`Movil: ${payload.phone}`);

  push([0x1b, 0x61, 0x00]); // Left
  push('='.repeat(RECEIPT_WIDTH));
  push([0x1b, 0x61, 0x01]);
  push([0x1d, 0x21, 0x01]); // Double height
  push([0x1b, 0x45, 0x01]);
  push('FACTURA SIMPLIFICADA');
  push([0x1d, 0x21, 0x00]);
  push([0x1b, 0x45, 0x00]);
  push([0x1b, 0x61, 0x00]);
  push(line('TICKET', payload.invoiceNumber));
  push(line('FECHA', payload.issuedAt));
  push(line('MESA', payload.tableLabel));
  if (payload.ticketNote) push(line('Modalidad', payload.ticketNote));
  push('-'.repeat(RECEIPT_WIDTH));
  push(itemLine('UD', 'PRODUCTO', 'PRECIO', 'TOTAL'));
  push('-'.repeat(RECEIPT_WIDTH));

  for (const item of payload.lines) {
    const displayName = getLineDisplayName(item);
    const nameRows = wrap(displayName.primary, ITEM_NAME_WIDTH);
    push([0x1b, 0x45, 0x01]);
    push(itemLine(`${item.qty}x`, nameRows[0], money(item.unitPriceCents), money(item.totalPriceCents)));
    push([0x1b, 0x45, 0x00]);
    for (const extraRow of nameRows.slice(1)) {
      push(itemLine('', extraRow, '', ''));
    }
    if (displayName.secondary) {
      for (const secondaryRow of wrap(displayName.secondary, ITEM_NAME_WIDTH)) {
        push(itemLine('', secondaryRow, '', ''));
      }
    }
  }

  push('='.repeat(RECEIPT_WIDTH));
  push(line(`BASE IVA ${payload.vatRatePercent.toFixed(0)}%`, money(payload.taxableBaseCents)));
  push(line(`IVA ${payload.vatRatePercent.toFixed(0)}%`, money(payload.vatCents)));
  push('-'.repeat(RECEIPT_WIDTH));
  push([0x1d, 0x21, 0x11]); // Double width + height
  push([0x1b, 0x45, 0x01]);
  push(line('TOTAL', money(payload.totalCents)));
  push([0x1d, 0x21, 0x00]);
  push([0x1b, 0x45, 0x00]);
  if (payload.splitPeople && payload.splitPeople > 1) {
    push(line('Comensales', String(payload.splitPeople)));
    push(line('Por persona', money(Math.trunc(payload.totalCents / payload.splitPeople))));
  }
  push('='.repeat(RECEIPT_WIDTH));
  push([0x1b, 0x61, 0x01]);
  push([0x1b, 0x45, 0x01]);
  push('IVA incluido');
  push([0x1b, 0x45, 0x00]);
  push('Gracias por su visita');
  push('\n\n');
  push([0x1d, 0x56, 0x42, 0x00]); // Cut

  return Buffer.concat(chunks);
}

function buildOpenDrawerCommand(): Buffer {
  return Buffer.from([
    0x1b, 0x40, // Initialize
    0x1b, 0x70, 0x00, 0x19, 0xfa, // Pulse drawer pin 2
  ]);
}

function writeToPrinter(buffer: Buffer, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 5000 }, () => {
      socket.write(buffer, (error) => {
        if (error) {
          socket.destroy(error);
          return;
        }
        socket.end();
      });
    });

    socket.once('close', (hadError) => {
      if (!hadError) resolve();
    });
    socket.once('timeout', () => {
      socket.destroy(new Error('Printer connection timed out'));
    });
    socket.once('error', reject);
  });
}

function writeToSystemPrinter(buffer: Buffer, printerName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['-d', printerName, '-o', 'raw'];
    const child = spawn('lp', args);
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.once('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new PrinterTransportError('The CUPS lp command is not available on this machine.', 'PRINTER_COMMAND_UNAVAILABLE'));
        return;
      }
      reject(error);
    });
    child.once('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const lpError = stderr.trim() || `lp exited with code ${code}`;
        if (/printer or class does not exist/i.test(lpError)) {
          reject(new PrinterTransportError(
            `The configured system printer "${printerName}" does not exist. Install it in CUPS or configure XPRINTER_HOST/XPRINTER_USB_DEVICE instead.`,
            'PRINTER_NOT_FOUND'
          ));
          return;
        }
        reject(new PrinterTransportError(lpError));
      }
    });

    child.stdin.end(buffer);
  });
}

async function writeToUsbDevice(buffer: Buffer, usbDevice: string): Promise<void> {
  await writeFile(usbDevice, buffer);
}

export class XprinterService {
  async printTicket(
    payload: XprinterTicketPayload,
    options?: { host?: string; port?: number; printerName?: string; usbDevice?: string }
  ): Promise<void> {
    const openCashDrawer = payload.openCashDrawer ?? config.xprinter.openDrawer;
    const ticketPayload = { ...payload, openCashDrawer };
    const printerName = options?.printerName || config.xprinter.printerName;
    const usbDevice = options?.usbDevice || config.xprinter.usbDevice;
    const host = options?.host || config.xprinter.host;
    const port = options?.port || config.xprinter.port;
    const ticketBuffer = buildEscPosTicket(ticketPayload);

    if (printerName) {
      await writeToSystemPrinter(ticketBuffer, printerName);
      return;
    }

    if (usbDevice) {
      await writeToUsbDevice(ticketBuffer, usbDevice);
      return;
    }

    if (!host) {
      throw new Error('Configure XPRINTER_PRINTER_NAME, XPRINTER_USB_DEVICE, or XPRINTER_HOST');
    }

    await writeToPrinter(ticketBuffer, host, port);
  }

  async openCashDrawer(options?: { host?: string; port?: number; printerName?: string; usbDevice?: string }): Promise<void> {
    const printerName = options?.printerName || config.xprinter.printerName;
    const usbDevice = options?.usbDevice || config.xprinter.usbDevice;
    const host = options?.host || config.xprinter.host;
    const port = options?.port || config.xprinter.port;
    const drawerBuffer = buildOpenDrawerCommand();

    if (printerName) {
      await writeToSystemPrinter(drawerBuffer, printerName);
      return;
    }

    if (usbDevice) {
      await writeToUsbDevice(drawerBuffer, usbDevice);
      return;
    }

    if (!host) {
      throw new Error('Configure XPRINTER_PRINTER_NAME, XPRINTER_USB_DEVICE, or XPRINTER_HOST');
    }

    await writeToPrinter(drawerBuffer, host, port);
  }
}

export const xprinterService = new XprinterService();
