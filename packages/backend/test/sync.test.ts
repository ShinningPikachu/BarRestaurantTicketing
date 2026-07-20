import assert from 'node:assert/strict';
import test from 'node:test';
import { getSyncRevision, signalDataChange } from '../src/services/sync.service.ts';

test('sync revisions identify the process and advance monotonically', () => {
  const before = getSyncRevision();
  const after = signalDataChange('orders');

  assert.match(before.instanceId, /^[0-9a-f-]{36}$/i);
  assert.equal(after.instanceId, before.instanceId);
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.scope, 'orders');
  assert.ok(Date.parse(after.changedAt) >= Date.parse(before.changedAt));
});
