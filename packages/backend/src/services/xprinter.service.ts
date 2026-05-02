import net from 'node:net';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { config } from '../config/index.js';

interface TicketLine {
  name: string;
  qty: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

const RECEIPT_WIDTH = 48;

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
  push(line('UD  PRODUCTO', 'TOTAL'));
  push('-'.repeat(RECEIPT_WIDTH));

  for (const item of payload.lines) {
    const prefix = `${item.qty}x `;
    const nameRows = wrap(item.name, 32);
    push([0x1b, 0x45, 0x01]);
    push(line(`${prefix}${nameRows[0]}`, money(item.totalPriceCents)));
    push([0x1b, 0x45, 0x00]);
    for (const extraRow of nameRows.slice(1)) {
      push(`   ${extraRow}`);
    }
    push(line('   Precio ud.', money(item.unitPriceCents)));
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
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `lp exited with code ${code}`));
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
