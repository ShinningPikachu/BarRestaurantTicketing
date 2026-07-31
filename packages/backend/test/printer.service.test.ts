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

test('thermal ticket uses a large bar name, bold legal name, fiscal heading, ticket id, structure, and cut', async () => {
  const adapter = new MockPrinterAdapter();
  const service = new XprinterService({
    adapter,
    paperColumns: 48,
    cutMode: 'partial',
  });

  await service.printTicket(validTicket());

  const output = adapter.printed[0];
  const printable = output.toString('ascii');
  const rows = printable.split('\n');
  assert.equal(rows.find((row) => row.includes('TEST RESTAURANT'))?.endsWith('TEST RESTAURANT'), true);
  assert.equal(output.includes(Buffer.from([
    0x1b, 0x61, 0x01,
    0x1b, 0x45, 0x01,
    0x1d, 0x21, 0x11,
  ])), true);
  assert.equal(output.includes(Buffer.concat([
    Buffer.from([0x1b, 0x61, 0x01, 0x1b, 0x45, 0x01]),
    Buffer.from('Test Business\n', 'ascii'),
  ])), true);
  assert.match(printable, /FACTURA SIMPLIFICADA/);
  assert.equal(rows.find((row) => row.startsWith('TICKET ID'))?.length, 48);
  assert.equal(rows.find((row) => row.startsWith('TICKET ID'))?.endsWith('TEST-1'), true);
  assert.match(printable, /DETALLE/);
  assert.match(printable, /RESUMEN/);
  assert.doesNotMatch(printable, /PROVISIONAL|NO FISCAL|REFERENCIA/);
  assert.equal(
    rows.find((row) => row.includes('UD  PRODUCTO'))?.endsWith('UD  PRODUCTO                  PRECIO       TOTAL'),
    true,
  );
  assert.equal(rows.find((row) => row.startsWith('1x  ')), '1x  Water                   1.00 EUR    1.00 EUR');
  assert.equal(
    rows.find((row) => row.includes('TOTAL                                   1.00 EUR'))
      ?.endsWith('TOTAL                                   1.00 EUR'),
    true,
  );
  assert.deepEqual(
    Array.from(output.subarray(-4)),
    [0x1d, 0x56, 0x42, 0x00],
  );
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

test('ticket and cash drawer commands have an exact three-second deduplication window', async () => {
  let nowMs = Date.parse('2026-01-01T12:00:00.000Z');
  const adapter = new MockPrinterAdapter();
  const service = new XprinterService({ adapter, now: () => new Date(nowMs) });

  const firstTicket = await service.printTicket(validTicket());
  nowMs += 2_999;
  const duplicateTicket = await service.printTicket(validTicket());

  assert.equal(firstTicket.deduplicated, false);
  assert.equal(duplicateTicket.deduplicated, true);
  assert.equal(adapter.printed.length, 1);

  nowMs += 1;
  const nextTicket = await service.printTicket(validTicket());
  assert.equal(nextTicket.deduplicated, false);
  assert.equal(adapter.printed.length, 2);

  const firstDrawer = await service.openCashDrawer();
  nowMs += 2_999;
  const duplicateDrawer = await service.openCashDrawer();

  assert.equal(firstDrawer.deduplicated, false);
  assert.equal(duplicateDrawer.deduplicated, true);
  assert.equal(adapter.printed.length, 3);

  nowMs += 1;
  const nextDrawer = await service.openCashDrawer();
  assert.equal(nextDrawer.deduplicated, false);
  assert.equal(adapter.printed.length, 4);
});

test('ticket output cannot contain the cash drawer pulse command', async () => {
  const adapter = new MockPrinterAdapter();
  const service = new XprinterService({ adapter });

  await service.printTicket(validTicket());

  assert.equal(adapter.printed.length, 1);
  assert.equal(adapter.printed[0].includes(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa])), false);
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
