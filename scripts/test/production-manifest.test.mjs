import assert from 'node:assert/strict';
import test from 'node:test';
import { productionSourceDigest } from '../production-manifest.mjs';

test('compiled-source fingerprint is deterministic and non-empty', () => {
  const digest = productionSourceDigest();
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(productionSourceDigest(), digest);
});
