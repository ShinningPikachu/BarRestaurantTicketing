import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestDatabase } from './test-database.ts';
import { PrinterTransportError } from '../src/services/printer-adapter.ts';
import { markInterruptedPrintJobsUnknown, trackPrinterOperation } from '../src/services/print-job.service.ts';

test('accepted print attempts survive in the application database', async () => {
  const db = await createTestDatabase();
  try {
    const result = await trackPrinterOperation('paid-ticket', 'ticket-1', async () => ({
      jobId: 'spool-1', deduplicated: false, acceptedAt: 'start', completedAt: 'end',
    }), db.client);
    const row = await db.client.printJob.findUniqueOrThrow({ where: { id: result.printRecordId } });
    assert.equal(row.status, 'accepted');
    assert.equal(row.referenceId, 'ticket-1');
    assert.equal(row.printerJobId, 'spool-1');
    assert.ok(row.completedAt);
  } finally {
    await db.cleanup();
  }
});

test('uncertain printing failures are recorded without retries', async () => {
  const db = await createTestDatabase();
  try {
    await assert.rejects(
      trackPrinterOperation('provisional-ticket', 'PRE-1', async () => {
        throw new PrinterTransportError('write failed', 'PRINTER_TIMEOUT', false, 'disconnected');
      }, db.client),
      { code: 'PRINTER_TIMEOUT' }
    );
    const row = await db.client.printJob.findFirstOrThrow();
    assert.equal(row.status, 'unknown');
    assert.equal(row.errorCode, 'PRINTER_TIMEOUT');
  } finally {
    await db.cleanup();
  }
});

test('pending printer jobs are marked unknown during startup recovery', async () => {
  const db = await createTestDatabase();
  try {
    const pending = await db.client.printJob.create({ data: { kind: 'ticket' } });
    assert.equal(await markInterruptedPrintJobsUnknown(db.client), 1);
    const row = await db.client.printJob.findUniqueOrThrow({ where: { id: pending.id } });
    assert.equal(row.status, 'unknown');
    assert.equal(row.errorCode, 'PROCESS_INTERRUPTED');
    assert.equal(await markInterruptedPrintJobsUnknown(db.client), 0);
  } finally {
    await db.cleanup();
  }
});
