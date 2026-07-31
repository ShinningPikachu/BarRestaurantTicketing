import { createHash, randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import {
  createConfiguredPrinterAdapter,
  PrinterAdapter,
  PrinterAdapterStatus,
  PrinterConnectionState,
  PrinterTransportError,
} from './printer-adapter.js';

export { PrinterTransportError } from './printer-adapter.js';

interface TicketLine {
  name: string;
  primaryName?: string | null;
  secondaryName?: string | null;
  qty: number;
  unitPriceCents: number;
  totalPriceCents: number;
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
  fiscal?: boolean;
}

export interface XprinterFinancialSummaryPayload {
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
}

export type PrinterJobKind = 'ticket' | 'financial-summary' | 'test-print' | 'cash-drawer';

export interface PreparedPrinterJob {
  kind: PrinterJobKind;
  dedupeKey: string;
  escpos: Buffer;
  text: Buffer;
  dedupeWindowMs?: number;
}

export interface PrinterJobResult {
  jobId: string;
  deduplicated: boolean;
  acceptedAt: string;
  completedAt: string;
}

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

interface QueuedJob {
  jobId: string;
  prepared: PreparedPrinterJob;
  createdAt: string;
  attempts: number;
  promise: Promise<PrinterJobResult>;
  resolve: (result: PrinterJobResult) => void;
  reject: (error: PrinterTransportError) => void;
}

interface RecentDeduplication {
  result: PrinterJobResult;
  expiresAt: number;
}

interface RecentJob {
  jobId: string;
  kind: PrinterJobKind;
  state: 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  completedAt: string;
  attempts: number;
  error: string | null;
}

export interface XprinterServiceOptions {
  adapter?: PrinterAdapter;
  paperColumns?: number;
  cutMode?: 'none' | 'full' | 'partial';
  safeRetryLimit?: number;
  queueLimit?: number;
  now?: () => Date;
}

const MAX_JOB_BYTES = 1_000_000;
const DEFAULT_DEDUPE_WINDOW_MS = 10_000;
const PRINTER_ACTION_COOLDOWN_MS = 3_000;

function sanitizePrintableText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/€/g, 'EUR')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizedErrorMessage(error: unknown): string {
  const code = error instanceof PrinterTransportError ? error.code : 'PRINTER_ERROR';
  const messages: Record<string, string> = {
    PRINTER_NOT_CONFIGURED: 'No printer is configured.',
    PRINTER_NOT_FOUND: 'The configured printer was not found.',
    PRINTER_COMMAND_UNAVAILABLE: 'The operating-system print tools are unavailable.',
    PRINTER_SCHEDULER_UNAVAILABLE: 'The operating-system print service is not running.',
    PRINTER_COMMAND_FAILED: 'The operating-system print queue reported an error.',
    PRINTER_TIMEOUT: 'The printer did not respond in time.',
    PRINTER_DISCONNECTED: 'The printer disconnected.',
    PRINTER_UNAVAILABLE: 'The printer is unavailable.',
    PRINTER_BUSY: 'The printer queue is full or busy.',
    PRINTER_OUT_OF_PAPER: 'The printer is out of paper.',
    PRINTER_RAW_MODE_REQUIRED: 'This action requires a raw printer connection.',
    PRINTER_PROTOCOL_UNCONFIGURED: 'Choose raw or driver mode for the configured system printer.',
    PRINTER_JOB_CANCELLED: 'The pending print job was cancelled.',
    PRINTER_JOB_INVALID: 'The print job was malformed and was rejected.',
    PRINTER_IO_ERROR: 'The printer reported an input/output error.',
  };
  return messages[code] ?? 'The printer reported an error.';
}

function stateError(state: PrinterConnectionState): PrinterTransportError {
  if (state === 'out_of_paper') {
    return new PrinterTransportError('Printer is out of paper', 'PRINTER_OUT_OF_PAPER', false, state);
  }
  if (state === 'disconnected') {
    return new PrinterTransportError('Printer is disconnected', 'PRINTER_DISCONNECTED', true, state);
  }
  if (state === 'busy') {
    return new PrinterTransportError('Printer is busy', 'PRINTER_BUSY', false, state);
  }
  return new PrinterTransportError('Printer is unavailable', 'PRINTER_UNAVAILABLE', false, state);
}

export function validatePreparedPrinterJob(job: PreparedPrinterJob): void {
  if (!job.dedupeKey.trim() || !Buffer.isBuffer(job.escpos) || !Buffer.isBuffer(job.text)) {
    throw new PrinterTransportError('Malformed printer job', 'PRINTER_JOB_INVALID');
  }
  if (
    job.escpos.length < 2
    || job.escpos.length > MAX_JOB_BYTES
    || job.text.length < 1
    || job.text.length > MAX_JOB_BYTES
  ) {
    throw new PrinterTransportError('Malformed printer job size', 'PRINTER_JOB_INVALID');
  }
  if (job.escpos[0] !== 0x1b || job.escpos[1] !== 0x40) {
    throw new PrinterTransportError('ESC/POS job is missing its initialization command', 'PRINTER_JOB_INVALID');
  }
  for (const byte of job.text) {
    if (byte === 0x1b || byte === 0x1d || (byte < 0x20 && byte !== 0x0a && byte !== 0x0d && byte !== 0x09)) {
      throw new PrinterTransportError('Text printer job contains control commands', 'PRINTER_JOB_INVALID');
    }
  }
}

function getLineDisplayName(item: Pick<TicketLine, 'name' | 'primaryName' | 'secondaryName'>): { primary: string; secondary: string | null } {
  const clean = (value: string | null | undefined) => {
    const normalized = sanitizePrintableText(value ?? '');
    return /^\.+$/.test(normalized) ? '' : normalized;
  };
  const primaryName = clean(item.primaryName);
  const secondaryName = clean(item.secondaryName);
  return primaryName
    ? { primary: primaryName, secondary: secondaryName || null }
    : { primary: clean(item.name), secondary: null };
}

function createFormatter(paperColumns: number, cutMode: 'none' | 'full' | 'partial') {
  const receiptWidth = paperColumns;
  const qtyWidth = 4;
  const unitPriceWidth = receiptWidth >= 42 ? 10 : 8;
  const totalWidth = receiptWidth >= 42 ? 12 : 10;
  const nameWidth = receiptWidth - qtyWidth - unitPriceWidth - totalWidth;

  const money = (cents: number) => `${(cents / 100).toFixed(2)} EUR`;
  const line = (left: string, right = '', width = receiptWidth) => {
    const cleanLeft = sanitizePrintableText(left);
    const cleanRight = sanitizePrintableText(right);
    if (!cleanRight) return cleanLeft.slice(0, width);
    const availableLeft = Math.max(0, width - cleanRight.length - 1);
    const clippedLeft = cleanLeft.slice(0, availableLeft);
    return `${clippedLeft}${' '.repeat(Math.max(1, width - clippedLeft.length - cleanRight.length))}${cleanRight.slice(-width)}`.slice(0, width);
  };
  const column = (value: string, width: number, align: 'left' | 'right' = 'left') => {
    const clean = sanitizePrintableText(value).slice(0, width);
    return align === 'right' ? clean.padStart(width, ' ') : clean.padEnd(width, ' ');
  };
  const itemLine = (qty: string, name: string, unit: string, total: string) => [
    column(qty, qtyWidth),
    column(name, nameWidth),
    column(unit, unitPriceWidth, 'right'),
    column(total, totalWidth, 'right'),
  ].join('');
  const wrap = (value: string, width = receiptWidth) => {
    const words = sanitizePrintableText(value).split(/\s+/).filter(Boolean);
    const rows: string[] = [];
    let current = '';
    for (const word of words) {
      let remaining = word;
      while (remaining.length > width) {
        if (current) {
          rows.push(current);
          current = '';
        }
        rows.push(remaining.slice(0, width));
        remaining = remaining.slice(width);
      }
      if (!remaining) continue;
      if (!current) current = remaining;
      else if (current.length + remaining.length + 1 <= width) current = `${current} ${remaining}`;
      else {
        rows.push(current);
        current = remaining;
      }
    }
    if (current) rows.push(current);
    return rows.length ? rows : [''];
  };
  const center = (value: string, width = receiptWidth) => {
    const clean = sanitizePrintableText(value).slice(0, width);
    return `${' '.repeat(Math.max(0, Math.floor((width - clean.length) / 2)))}${clean}`;
  };
  const appendCut = (push: (value: number[]) => void) => {
    if (cutMode === 'full') push([0x1d, 0x56, 0x41, 0x00]);
    if (cutMode === 'partial') push([0x1d, 0x56, 0x42, 0x00]);
  };

  const ticketRows = (payload: XprinterTicketPayload): string[] => {
    const rows: string[] = [];
    const push = (value = '') => rows.push(sanitizePrintableText(value));
    push(center(payload.tradeName.toUpperCase()));
    push(center(payload.businessName));
    push(center(`NIF: ${payload.nif}`));
    for (const row of wrap(payload.address)) push(center(row));
    if (payload.city) push(center(payload.city));
    if (payload.phone) push(center(`Movil: ${payload.phone}`));
    push('='.repeat(receiptWidth));
    push(center(payload.fiscal ? 'FACTURA SIMPLIFICADA' : 'PRECUENTA - NO FISCAL'));
    push(line(payload.fiscal ? 'TICKET' : 'REFERENCIA', payload.invoiceNumber));
    push(line('FECHA', payload.issuedAt));
    push(line('MESA', payload.tableLabel));
    if (payload.ticketNote) push(line('MODALIDAD', payload.ticketNote));
    push('-'.repeat(receiptWidth));
    push(itemLine('UD', 'PRODUCTO', 'PRECIO', 'TOTAL'));
    push('-'.repeat(receiptWidth));
    for (const item of payload.lines) {
      const displayName = getLineDisplayName(item);
      const nameRows = wrap(displayName.primary, nameWidth);
      push(itemLine(`${item.qty}x`, nameRows[0], money(item.unitPriceCents), money(item.totalPriceCents)));
      for (const extra of nameRows.slice(1)) push(itemLine('', extra, '', ''));
      if (displayName.secondary) {
        for (const secondary of wrap(displayName.secondary, nameWidth)) push(itemLine('', secondary, '', ''));
      }
    }
    push('='.repeat(receiptWidth));
    push(line(`BASE IVA ${payload.vatRatePercent.toFixed(0)}%`, money(payload.taxableBaseCents)));
    push(line(`IVA ${payload.vatRatePercent.toFixed(0)}%`, money(payload.vatCents)));
    push('-'.repeat(receiptWidth));
    push(line('TOTAL', money(payload.totalCents)));
    if (payload.splitPeople && payload.splitPeople > 1) {
      push(line('COMENSALES', String(payload.splitPeople)));
      push(line('POR PERSONA', money(Math.trunc(payload.totalCents / payload.splitPeople))));
    }
    push('='.repeat(receiptWidth));
    push(center('IVA incluido'));
    push(center('Gracias por su visita'));
    push('');
    return rows;
  };

  const summaryRows = (payload: XprinterFinancialSummaryPayload): string[] => {
    const rows: string[] = [];
    const push = (value = '') => rows.push(sanitizePrintableText(value));
    const vatLabel = payload.vatRateLabel ? `IVA ${payload.vatRateLabel}` : 'IVA';
    push(center(payload.tradeName.toUpperCase()));
    push(center(payload.businessName));
    push(center(`NIF: ${payload.nif}`));
    push('='.repeat(receiptWidth));
    push(center('RESULTADO FINANCIERO'));
    push(line('PERIODO', payload.periodLabel));
    push(line('EMITIDO', payload.issuedAt));
    push(line('TICKETS', String(payload.ticketCount)));
    push(line('ARTICULOS', String(payload.itemQuantity)));
    if (payload.firstTicketNumber || payload.lastTicketNumber) {
      push(line('DESDE', payload.firstTicketNumber ?? '-'));
      push(line('HASTA', payload.lastTicketNumber ?? '-'));
    }
    for (const day of payload.dailyTotals) {
      push('-'.repeat(receiptWidth));
      push(center(day.dayLabel));
      push(line('TICKETS', String(day.ticketCount)));
      push(line('ARTICULOS', String(day.itemQuantity)));
      push(line('BASE', money(day.taxableBaseCents)));
      push(line(vatLabel, money(day.vatCents)));
      push(line('EFECTIVO', money(day.cashCents)));
      push(line('TARJETA', money(day.cardCents)));
      push(line('TOTAL DIA', money(day.totalCents)));
    }
    push('='.repeat(receiptWidth));
    push(center('TOTAL GENERAL'));
    push(line('BASE IMPONIBLE', money(payload.taxableBaseCents)));
    push(line(vatLabel, money(payload.vatCents)));
    push(line('EFECTIVO', money(payload.cashCents)));
    push(line('TARJETA', money(payload.cardCents)));
    push(line('TOTAL', money(payload.totalCents)));
    push('='.repeat(receiptWidth));
    push(center('Resumen de tickets seleccionados'));
    push('');
    return rows;
  };

  const escposFromRows = (rows: string[]) => {
    const chunks: Buffer[] = [];
    const pushBytes = (value: number[]) => chunks.push(Buffer.from(value));
    const pushText = (value: string) => chunks.push(Buffer.from(`${sanitizePrintableText(value)}\n`, 'ascii'));
    pushBytes([0x1b, 0x40]);
    pushBytes([0x1b, 0x4d, 0x00]);
    for (const row of rows) pushText(row);
    pushText('');
    appendCut(pushBytes);
    return Buffer.concat(chunks);
  };
  const textFromRows = (rows: string[]) => Buffer.from(`${rows.join('\n')}\n`, 'ascii');

  return {
    ticket(payload: XprinterTicketPayload) {
      const rows = ticketRows(payload);
      return { escpos: escposFromRows(rows), text: textFromRows(rows) };
    },
    summary(payload: XprinterFinancialSummaryPayload) {
      const rows = summaryRows(payload);
      return { escpos: escposFromRows(rows), text: textFromRows(rows) };
    },
    test() {
      const rows = [
        center('PRUEBA DE IMPRESORA'),
        '='.repeat(receiptWidth),
        center('CONTENIDO SEGURO'),
        center('SIN DATOS DE CLIENTES'),
        center('NO ES UN TICKET'),
        '='.repeat(receiptWidth),
        '',
      ];
      return { escpos: escposFromRows(rows), text: textFromRows(rows) };
    },
    drawer() {
      return {
        escpos: Buffer.from([0x1b, 0x40, 0x1b, 0x70, 0x00, 0x19, 0xfa]),
        text: Buffer.from('CASH DRAWER COMMAND REQUIRES RAW MODE\n', 'ascii'),
      };
    },
  };
}

export class XprinterService {
  private readonly adapter: PrinterAdapter;
  private readonly formatter: ReturnType<typeof createFormatter>;
  private readonly safeRetryLimit: number;
  private readonly queueLimit: number;
  private readonly now: () => Date;
  private readonly pending: QueuedJob[] = [];
  private readonly jobsByKey = new Map<string, QueuedJob>();
  private readonly recentDeduplications = new Map<string, RecentDeduplication>();
  private readonly recentJobs: RecentJob[] = [];
  private active: QueuedJob | null = null;
  private processing = false;
  private adapterState: PrinterConnectionState = 'unknown';
  private lastSuccessfulConnectionAt: string | null = null;
  private lastSuccessfulPrintAt: string | null = null;
  private lastStateChangeAt: string;
  private lastError: string | null = null;
  private externalQueueDepth: number | null = null;

  constructor(options: XprinterServiceOptions = {}) {
    this.adapter = options.adapter ?? createConfiguredPrinterAdapter(config.xprinter);
    const paperColumns = options.paperColumns ?? config.xprinter.paperColumns;
    const cutMode = options.cutMode ?? config.xprinter.cutMode;
    this.formatter = createFormatter(paperColumns, cutMode);
    this.safeRetryLimit = options.safeRetryLimit ?? config.xprinter.safeRetries;
    this.queueLimit = options.queueLimit ?? 50;
    this.now = options.now ?? (() => new Date());
    this.lastStateChangeAt = this.now().toISOString();
  }

  private setAdapterState(state: PrinterConnectionState, error: string | null = null): void {
    if (state !== this.adapterState) this.lastStateChangeAt = this.now().toISOString();
    this.adapterState = state;
    this.lastError = error;
    if (state === 'connected' || state === 'busy') {
      this.lastSuccessfulConnectionAt = this.now().toISOString();
      this.lastError = null;
    }
  }

  private applyProbeStatus(status: PrinterAdapterStatus): void {
    this.externalQueueDepth = status.externalQueueDepth ?? null;
    const publicError = status.code
      ? sanitizedErrorMessage(new PrinterTransportError(status.detail ?? 'Printer error', status.code, false, status.state))
      : status.state === 'connected' || status.state === 'busy'
      ? null
      : status.state === 'out_of_paper'
        ? 'The printer is out of paper.'
        : status.state === 'disconnected'
          ? 'The printer is disconnected.'
          : status.state === 'unavailable'
            ? 'The configured printer is unavailable.'
            : status.state === 'error'
              ? 'The printer reported an error.'
              : 'Printer status could not be determined.';
    this.setAdapterState(status.state, publicError);
  }

  private statusSnapshot(): PrinterStatus {
    const queueBusy = Boolean(this.active) || this.pending.length > 0;
    const blockingState = ['disconnected', 'unavailable', 'out_of_paper', 'error'].includes(this.adapterState);
    return {
      state: queueBusy && !blockingState ? 'busy' : this.adapterState,
      printerName: this.adapter.descriptor.name,
      connectionType: this.adapter.descriptor.connectionType,
      address: this.adapter.descriptor.address,
      dataFormat: this.adapter.descriptor.dataFormat,
      lastSuccessfulConnectionAt: this.lastSuccessfulConnectionAt,
      lastSuccessfulPrintAt: this.lastSuccessfulPrintAt,
      lastStateChangeAt: this.lastStateChangeAt,
      error: this.lastError,
      queue: {
        pending: this.pending.length,
        external: this.externalQueueDepth,
        active: Boolean(this.active),
        activeJobId: this.active?.jobId ?? null,
        activeJobKind: this.active?.prepared.kind ?? null,
      },
    };
  }

  async getStatus(refresh = true): Promise<PrinterStatus> {
    if (refresh && !this.active) {
      try {
        this.applyProbeStatus(await this.adapter.probe());
      } catch (error) {
        const normalized = error instanceof PrinterTransportError
          ? error
          : new PrinterTransportError('Printer status failed');
        this.setAdapterState(normalized.state, sanitizedErrorMessage(normalized));
      }
    }
    return this.statusSnapshot();
  }

  async reconnect(): Promise<PrinterStatus> {
    if (this.active) return this.statusSnapshot();
    try {
      this.applyProbeStatus(await this.adapter.reconnect());
    } catch (error) {
      const normalized = error instanceof PrinterTransportError ? error : new PrinterTransportError('Reconnect failed');
      this.setAdapterState(normalized.state, sanitizedErrorMessage(normalized));
    }
    return this.statusSnapshot();
  }

  async getDiagnostics(): Promise<PrinterDiagnostics> {
    const status = await this.getStatus(true);
    return {
      status,
      paperColumns: config.xprinter.paperColumns,
      cutMode: config.xprinter.cutMode,
      safeRetryLimit: this.safeRetryLimit,
      queueLimit: this.queueLimit,
      note: 'A successful system print means CUPS accepted the job; printers without bidirectional status may not report paper or hardware faults.',
      recentJobs: [...this.recentJobs],
    };
  }

  cancelPendingJobs(): number {
    const cancelled = this.pending.splice(0);
    const completedAt = this.now().toISOString();
    for (const job of cancelled) {
      this.jobsByKey.delete(job.prepared.dedupeKey);
      const error = new PrinterTransportError('Pending job cancelled', 'PRINTER_JOB_CANCELLED', false, 'unknown');
      job.reject(error);
      this.recordRecent(job, 'cancelled', completedAt, sanitizedErrorMessage(error));
    }
    return cancelled.length;
  }

  private recordRecent(job: QueuedJob, state: RecentJob['state'], completedAt: string, error: string | null): void {
    this.recentJobs.unshift({
      jobId: job.jobId,
      kind: job.prepared.kind,
      state,
      createdAt: job.createdAt,
      completedAt,
      attempts: job.attempts,
      error,
    });
    if (this.recentJobs.length > 20) this.recentJobs.length = 20;
  }

  private expireDeduplications(): void {
    const now = this.now().getTime();
    for (const [key, value] of this.recentDeduplications) {
      if (value.expiresAt <= now) this.recentDeduplications.delete(key);
    }
  }

  private submit(prepared: PreparedPrinterJob): Promise<PrinterJobResult> {
    validatePreparedPrinterJob(prepared);
    this.expireDeduplications();

    const existing = this.jobsByKey.get(prepared.dedupeKey);
    if (existing) {
      return existing.promise.then((result) => ({ ...result, deduplicated: true }));
    }
    const recent = this.recentDeduplications.get(prepared.dedupeKey);
    if (recent) return Promise.resolve({ ...recent.result, deduplicated: true });
    if (this.pending.length + (this.active ? 1 : 0) >= this.queueLimit) {
      return Promise.reject(new PrinterTransportError('Printer queue is full', 'PRINTER_BUSY', false, 'busy'));
    }

    let resolveJob!: (result: PrinterJobResult) => void;
    let rejectJob!: (error: PrinterTransportError) => void;
    const promise = new Promise<PrinterJobResult>((resolve, reject) => {
      resolveJob = resolve;
      rejectJob = reject;
    });
    const job: QueuedJob = {
      jobId: randomUUID(),
      prepared,
      createdAt: this.now().toISOString(),
      attempts: 0,
      promise,
      resolve: resolveJob,
      reject: rejectJob,
    };
    this.pending.push(job);
    this.jobsByKey.set(prepared.dedupeKey, job);
    void this.processQueue();
    return promise;
  }

  private async execute(job: QueuedJob): Promise<void> {
    const probe = await this.adapter.probe();
    this.applyProbeStatus(probe);
    if (probe.state !== 'connected' && probe.state !== 'busy') throw stateError(probe.state);

    const buffer = this.adapter.descriptor.dataFormat === 'text' ? job.prepared.text : job.prepared.escpos;
    for (;;) {
      job.attempts += 1;
      try {
        await this.adapter.print(buffer);
        this.setAdapterState('connected');
        this.lastSuccessfulPrintAt = this.now().toISOString();
        return;
      } catch (error) {
        const normalized = error instanceof PrinterTransportError
          ? error
          : new PrinterTransportError('Printer write failed', 'PRINTER_IO_ERROR', false, 'error');
        this.setAdapterState(normalized.state, sanitizedErrorMessage(normalized));
        if (!normalized.retrySafe || job.attempts > this.safeRetryLimit) throw normalized;
        const reconnectStatus = await this.adapter.reconnect();
        this.applyProbeStatus(reconnectStatus);
        if (reconnectStatus.state !== 'connected' && reconnectStatus.state !== 'busy') throw stateError(reconnectStatus.state);
      }
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.pending.length) {
        const job = this.pending.shift();
        if (!job) continue;
        this.active = job;
        try {
          await this.execute(job);
          const completedAt = this.now().toISOString();
          const result: PrinterJobResult = {
            jobId: job.jobId,
            deduplicated: false,
            acceptedAt: job.createdAt,
            completedAt,
          };
          this.recentDeduplications.set(job.prepared.dedupeKey, {
            result,
            expiresAt: this.now().getTime() + (job.prepared.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS),
          });
          this.recordRecent(job, 'completed', completedAt, null);
          job.resolve(result);
        } catch (error) {
          const normalized = error instanceof PrinterTransportError
            ? error
            : new PrinterTransportError('Printer job failed');
          const publicError = sanitizedErrorMessage(normalized);
          logger.warn({
            code: normalized.code,
            state: normalized.state,
            retrySafe: normalized.retrySafe,
            jobId: job.jobId,
            kind: job.prepared.kind,
            attempts: job.attempts,
          }, 'Printer job failed');
          this.recordRecent(job, 'failed', this.now().toISOString(), publicError);
          job.reject(new PrinterTransportError(publicError, normalized.code, false, normalized.state));
        } finally {
          this.jobsByKey.delete(job.prepared.dedupeKey);
          this.active = null;
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private prepared(kind: PrinterJobKind, buffers: { escpos: Buffer; text: Buffer }, dedupeWindowMs?: number): PreparedPrinterJob {
    const digest = createHash('sha256').update(kind).update(buffers.escpos).digest('hex');
    return { kind, dedupeKey: `${kind}:${digest}`, ...buffers, dedupeWindowMs };
  }

  printTicket(payload: XprinterTicketPayload): Promise<PrinterJobResult> {
    return this.submit(this.prepared('ticket', this.formatter.ticket(payload), PRINTER_ACTION_COOLDOWN_MS));
  }

  printFinancialSummary(payload: XprinterFinancialSummaryPayload): Promise<PrinterJobResult> {
    return this.submit(this.prepared('financial-summary', this.formatter.summary(payload)));
  }

  runSafeTestPrint(): Promise<PrinterJobResult> {
    return this.submit(this.prepared('test-print', this.formatter.test(), 3_000));
  }

  openCashDrawer(): Promise<PrinterJobResult> {
    if (this.adapter.descriptor.dataFormat !== 'escpos') {
      return Promise.reject(new PrinterTransportError(
        'Cash drawer command requires raw mode',
        'PRINTER_RAW_MODE_REQUIRED',
        false,
        'error'
      ));
    }
    return this.submit(this.prepared('cash-drawer', this.formatter.drawer(), PRINTER_ACTION_COOLDOWN_MS));
  }
}

export const xprinterService = new XprinterService();
