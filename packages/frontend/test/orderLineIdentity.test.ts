import assert from 'node:assert/strict';
import test from 'node:test';
import { getOrderLineIdentity } from '../src/native/helpers/orderLineIdentity';

const baseLine = {
  menuItemId: 11,
  name: 'Café',
  primaryName: 'Café',
  secondaryName: 'Coffee',
  unitPriceCents: 180,
};

test('order-line identity permits aggregation only for the same product and display labels', () => {
  assert.equal(getOrderLineIdentity(baseLine), getOrderLineIdentity({ ...baseLine }));
  assert.notEqual(getOrderLineIdentity(baseLine), getOrderLineIdentity({ ...baseLine, menuItemId: 12 }));
  assert.notEqual(getOrderLineIdentity(baseLine), getOrderLineIdentity({ ...baseLine, primaryName: 'Cortado' }));
  assert.notEqual(getOrderLineIdentity(baseLine), getOrderLineIdentity({ ...baseLine, secondaryName: null }));
  assert.notEqual(getOrderLineIdentity(baseLine), getOrderLineIdentity({ ...baseLine, unitPriceCents: 190 }));
});

test('legacy lines without a product id still keep distinct display identities separate', () => {
  const legacy = { ...baseLine, menuItemId: null };
  assert.notEqual(
    getOrderLineIdentity(legacy),
    getOrderLineIdentity({ ...legacy, primaryName: 'Café solo' })
  );
});
