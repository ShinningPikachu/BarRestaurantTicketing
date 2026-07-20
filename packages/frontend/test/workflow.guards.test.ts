import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isWorkflowContextCurrent,
  OperationFingerprintLock,
  PaymentIdempotencyKeyStore,
  paymentItemsFingerprint,
  paymentOrdersFingerprint,
  shouldApplyWorkflowResponse,
} from '../src/native/controllers/workflow.guards';

test('workflow context rejects responses from stale sessions and table selections', () => {
  const current = {
    session: 4,
    currentSession: 4,
    tableKey: 'floor1-7',
    desiredTableKey: 'floor1-7',
  };

  assert.equal(isWorkflowContextCurrent(current), true);
  assert.equal(isWorkflowContextCurrent({ ...current, session: 3 }), false);
  assert.equal(isWorkflowContextCurrent({ ...current, desiredTableKey: 'outside-2' }), false);
  assert.equal(isWorkflowContextCurrent({ ...current, desiredTableKey: null }), false);
});

test('workflow response guard only accepts a newer response in the active context', () => {
  const current = {
    session: 4,
    currentSession: 4,
    tableKey: 'floor1-7',
    desiredTableKey: 'floor1-7',
    requestId: 12,
    lastAppliedRequestId: 11,
  };

  assert.equal(shouldApplyWorkflowResponse(current), true);
  assert.equal(shouldApplyWorkflowResponse({ ...current, requestId: 11 }), false);
  assert.equal(shouldApplyWorkflowResponse({ ...current, requestId: 10 }), false);
  assert.equal(shouldApplyWorkflowResponse({ ...current, currentSession: 5 }), false);
  assert.equal(shouldApplyWorkflowResponse({ ...current, desiredTableKey: 'floor2-7' }), false);
});

test('payment idempotency keys survive retries, clear after success, and reset with the workflow', () => {
  let sequence = 0;
  const keys = new PaymentIdempotencyKeyStore(() => `key-${++sequence}`);

  assert.equal(keys.getOrCreate('table:outside-1:cash'), 'key-1');
  assert.equal(keys.getOrCreate('table:outside-1:cash'), 'key-1');
  assert.equal(keys.getOrCreate('table:outside-1:card'), 'key-2');

  keys.clear('table:outside-1:cash');
  assert.equal(keys.getOrCreate('table:outside-1:cash'), 'key-3');

  keys.reset();
  assert.equal(keys.getOrCreate('table:outside-1:card'), 'key-4');
});

test('selected-item payment fingerprints are independent of selection order', () => {
  const first = [
    { orderId: 'order-b', itemId: 2, qty: 1 },
    { orderId: 'order-a', itemId: 1, qty: 3 },
  ];
  const reordered = [first[1], first[0]];

  assert.equal(paymentItemsFingerprint(first), paymentItemsFingerprint(reordered));
  assert.equal(
    paymentItemsFingerprint([{ orderId: 'order-a', itemId: 1, qty: 1 }, { orderId: 'order-a', itemId: 1, qty: 2 }]),
    paymentItemsFingerprint([{ orderId: 'order-a', itemId: 1, qty: 3 }])
  );
  assert.notEqual(
    paymentItemsFingerprint(first),
    paymentItemsFingerprint([{ ...first[0], qty: 2 }, first[1]])
  );
});

test('whole-table payment fingerprints include product quantities and prices', () => {
  const orders = [{
    id: 'order-a',
    items: [
      { id: 2, menuItemId: 22, qty: 1, unitPriceCents: 250 },
      { id: 1, menuItemId: 11, qty: 2, unitPriceCents: 180 },
    ],
  }];

  assert.equal(
    paymentOrdersFingerprint(orders),
    paymentOrdersFingerprint([{ ...orders[0], items: [...orders[0].items].reverse() }])
  );
  assert.notEqual(
    paymentOrdersFingerprint(orders),
    paymentOrdersFingerprint([{
      ...orders[0],
      items: [{ ...orders[0].items[0], unitPriceCents: 275 }, orders[0].items[1]],
    }])
  );
  assert.notEqual(
    paymentOrdersFingerprint(orders),
    paymentOrdersFingerprint([{
      ...orders[0],
      items: [{ ...orders[0].items[0], qty: 2 }, orders[0].items[1]],
    }])
  );
});

test('operation fingerprint locks synchronously reject a duplicate destructive action', () => {
  const lock = new OperationFingerprintLock();

  assert.equal(lock.tryAcquire('remove:outside-1:item-3'), true);
  assert.equal(lock.tryAcquire('remove:outside-1:item-3'), false);
  assert.equal(lock.tryAcquire('remove:outside-1:item-4'), true);

  lock.release('remove:outside-1:item-3');
  assert.equal(lock.tryAcquire('remove:outside-1:item-3'), true);

  lock.reset();
  assert.equal(lock.tryAcquire('remove:outside-1:item-4'), true);
});
