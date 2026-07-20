import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { config } from '../src/config/index.ts';
import { secureCompare } from '../src/middleware/auth.ts';
import { xprinterTicketSchema } from '../src/routes/printers.ts';

test('secure comparison handles equal and different-length credentials', () => {
  assert.equal(secureCompare('same-secret', 'same-secret'), true);
  assert.equal(secureCompare('x', 'a-much-longer-secret'), false);
});

test('login is rate-limited and HTTP failures remain structured JSON', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const validLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessCode: config.auth.accessCode }),
    });
    assert.equal(validLogin.status, 200);
    assert.match(validLogin.headers.get('cache-control') ?? '', /no-store/);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accessCode: 'wrong-access-code' }),
      });
      assert.equal(failedLogin.status, 401);
    }

    const limitedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessCode: 'wrong-access-code' }),
    });
    assert.equal(limitedLogin.status, 429);
    assert.ok(Number(limitedLogin.headers.get('retry-after')) > 0);

    const malformed = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.headers.get('content-type')?.includes('application/json'), true);

    const notFound = await fetch(`${baseUrl}/not-a-route`);
    assert.equal(notFound.status, 404);
    assert.equal((await notFound.json() as { error: { code: string } }).error.code, 'ROUTE_NOT_FOUND');
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('provisional printer payload strips client-controlled transport and fiscal fields', () => {
  const parsed = xprinterTicketSchema.parse({
    businessName: 'Legal Name',
    tradeName: 'Restaurant',
    nif: 'B00000000',
    address: 'Test address',
    invoiceNumber: 'PRE-1',
    issuedAt: '2026-07-18T12:00:00.000Z',
    tableLabel: 'outside 1',
    lines: [{ name: 'Soup', qty: 1, unitPriceCents: 500, totalPriceCents: 500 }],
    taxableBaseCents: 455,
    vatCents: 45,
    vatRatePercent: 10,
    totalCents: 500,
    host: 'attacker.example',
    port: 9100,
    printerName: 'other-printer',
    usbDevice: '/tmp/untrusted',
    openCashDrawer: true,
    fiscal: true,
  });

  assert.equal('host' in parsed, false);
  assert.equal('port' in parsed, false);
  assert.equal('printerName' in parsed, false);
  assert.equal('usbDevice' in parsed, false);
  assert.equal('openCashDrawer' in parsed, false);
  assert.equal('fiscal' in parsed, false);
});
