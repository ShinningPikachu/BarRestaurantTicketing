import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  PrinterAdapter,
  PrinterAdapterDescriptor,
  PrinterAdapterStatus,
} from '../src/services/printer-adapter.ts';
import { PrinterTransportError } from '../src/services/printer-adapter.ts';
import {
  PreparedPrinterJob,
  validatePreparedPrinterJob,
  XprinterService,
  XprinterTicketPayload,
} from '../src/services/xprinter.service.ts';

const validTicket = (invoiceNumber = 'TEST-1'): XprinterTicketPayload => ({
  businessName: 'Test Business',
  tradeName: 'Test Restaurant',
  nif: 'TEST-NIF',
  address: 'Test address',
  invoiceNumber,
  issuedAt: '2026-01-01 12:00',
  tableLabel: 'Test table',
  lines: [{ name: 'Water', qty: 1, unitPriceCents: 100, totalPriceCents: 100 }],
  taxableBaseCents: 91,
  vatCents: 9,
  vatRatePercent: 10,
  totalCents: 100,
});

class MockPrinterAdapter implements PrinterAdapter {
  readonly descriptor: PrinterAdapterDescriptor;
  readonly printed: Buffer[] = [];
  readonly probes: PrinterAdapterStatus[] = [];
  readonly printBehaviors: Array<() => Promise<void>> = [];
  reconnectCalls = 0;

  constructor(format: 'escpos' | 'text' = 'escpos') {
    this.descriptor = {
      name: 'Mock printer',
      connectionType: 'network',
      address: '127.0.0.1:9100',
      dataFormat: format,
    };
  }

  async probe(): Promise<PrinterAdapterStatus> {
    return this.probes.shift() ?? { state: 'connected' };
  }

  async reconnect(): Promise<PrinterAdapterStatus> {
    this.reconnectCalls += 1;
    return this.probe();
  }

  async print(buffer: Buffer): Promise<void> {
    this.printed.push(Buffer.from(buffer));
    const behavior = this.printBehaviors.shift();
    if (behavior) await behavior();
  }
}

test('printer status follows connected, disconnected, out-of-paper, and recovery transitions', async () => {
  const adapter = new MockPrinterAdapter();
  adapter.probes.push(
    { state: 'connected' },
    { state: 'disconnected' },
    { state: 'out_of_paper' },
    { state: 'connected' },
  );
  const service = new XprinterService({ adapter });

  assert.equal((await service.getStatus()).state, 'connected');
  assert.equal((await service.getStatus()).state, 'disconnected');
  const noPaper = await service.getStatus();
  assert.equal(noPaper.state, 'out_of_paper');
  assert.equal(noPaper.error, 'The printer is out of paper.');
  assert.equal((await service.reconnect()).state, 'connected');
});

test('malformed prepared jobs and text control commands are rejected before transport', () => {
  const emptyJob: PreparedPrinterJob = {
    kind: 'test-print',
    dedupeKey: 'empty',
    escpos: Buffer.alloc(0),
    text: Buffer.from('test\n'),
  };
  assert.throws(() => validatePreparedPrinterJob(emptyJob), { code: 'PRINTER_JOB_INVALID' });

  const unsafeTextJob: PreparedPrinterJob = {
    kind: 'test-print',
    dedupeKey: 'unsafe',
    escpos: Buffer.from([0x1b, 0x40, 0x0a]),
    text: Buffer.from([0x45, 0x52, 0x52, 0x4f, 0x52, 0x1b, 0x40]),
  };
  assert.throws(() => validatePreparedPrinterJob(unsafeTextJob), { code: 'PRINTER_JOB_INVALID' });
});

test('a retry-safe pre-write failure retries once while duplicate submissions share one job', async () => {
  const adapter = new MockPrinterAdapter();
  adapter.printBehaviors.push(
    async () => { throw new PrinterTransportError('connection refused', 'PRINTER_DISCONNECTED', true, 'disconnected'); },
    async () => undefined,
  );
  const service = new XprinterService({ adapter, safeRetryLimit: 1 });

  const first = service.printTicket(validTicket());
  const duplicate = service.printTicket(validTicket());
  const [firstResult, duplicateResult] = await Promise.all([first, duplicate]);

  assert.equal(adapter.printed.length, 2);
  assert.equal(adapter.reconnectCalls, 1);
  assert.equal(firstResult.jobId, duplicateResult.jobId);
  assert.equal(firstResult.deduplicated, false);
  assert.equal(duplicateResult.deduplicated, true);
});

test('the queue recovers after a failed job and processes the next distinct receipt once', async () => {
  const adapter = new MockPrinterAdapter();
  adapter.printBehaviors.push(
    async () => { throw new PrinterTransportError('partial write', 'PRINTER_IO_ERROR', false, 'error'); },
    async () => undefined,
  );
  const service = new XprinterService({ adapter, safeRetryLimit: 1 });

  const results = await Promise.allSettled([
    service.printTicket(validTicket('FAIL-1')),
    service.printTicket(validTicket('NEXT-1')),
  ]);

  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'fulfilled');
  assert.equal(adapter.printed.length, 2);
  assert.equal((await service.getDiagnostics()).recentJobs[0].state, 'completed');
});

test('pending jobs can be cancelled without interrupting or duplicating the active job', async () => {
  const adapter = new MockPrinterAdapter();
  let releaseActive!: () => void;
  const activeGate = new Promise<void>((resolve) => { releaseActive = resolve; });
  adapter.printBehaviors.push(async () => activeGate);
  const service = new XprinterService({ adapter });

  const active = service.printTicket(validTicket('ACTIVE-1'));
  const pending = service.printTicket(validTicket('PENDING-1'));
  const pendingOutcome = pending.then(() => 'completed', (error: PrinterTransportError) => error.code);

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await service.getStatus(false)).queue.pending, 1);
  assert.equal(service.cancelPendingJobs(), 1);
  releaseActive();

  await active;
  assert.equal(await pendingOutcome, 'PRINTER_JOB_CANCELLED');
  assert.equal(adapter.printed.length, 1);
});

test('disconnect during an active write is not retried and safe test output contains no production data', async () => {
  const adapter = new MockPrinterAdapter('text');
  adapter.printBehaviors.push(async () => {
    throw new PrinterTransportError('socket closed after write', 'PRINTER_DISCONNECTED', false, 'disconnected');
  });
  const service = new XprinterService({ adapter, safeRetryLimit: 2 });

  await assert.rejects(service.printTicket(validTicket('CUSTOMER-SECRET')), { code: 'PRINTER_DISCONNECTED' });
  assert.equal(adapter.printed.length, 1);
  assert.equal((await service.getStatus(false)).state, 'disconnected');

  adapter.probes.push({ state: 'connected' });
  await service.runSafeTestPrint();
  const testText = adapter.printed[1].toString('ascii');
  assert.match(testText, /PRUEBA DE IMPRESORA/);
  assert.match(testText, /SIN DATOS DE CLIENTES/);
  assert.doesNotMatch(testText, /CUSTOMER-SECRET|Test Business|socket closed|PRINTER_DISCONNECTED/);
});
