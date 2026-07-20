import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packagedPathViolation } from '../package-safety.mjs';

test('package safety rejects runtime databases and private environment files', () => {
  for (const filePath of [
    'packages/backend/prisma/dev.db',
    'packages/backend/prisma/dev.db-journal',
    'packages/backend/prisma/dev.db-wal',
    'packages/backend/prisma/dev.db.backup-before-cleanup',
    'packages/backend/.env.production',
    '.env',
  ]) {
    assert.ok(packagedPathViolation(filePath), `${filePath} should be rejected`);
  }
  assert.equal(packagedPathViolation('.env.example'), undefined);
});

test('offline packages retain dependency build and dist directories', () => {
  assert.ok(packagedPathViolation('packages/frontend/node_modules/typescript/lib/tsc.js'));
  assert.equal(
    packagedPathViolation('node_modules/@expo/cli/build/bin/cli.js', { includeNodeModules: true }),
    undefined,
  );
  assert.equal(
    packagedPathViolation('node_modules/tsx/dist/cli.mjs', { includeNodeModules: true }),
    undefined,
  );
  assert.ok(packagedPathViolation('packages/backend/dist/index.js', { includeNodeModules: true }));
});

test('production database preparation requires and verifies an external backup', () => {
  const source = readFileSync(resolve('scripts/prepare-database.mjs'), 'utf8');
  assert.match(source, /Pending migrations require a verified external backup/);
  assert.match(source, /Testing migrations against a restored temporary copy/);
  assert.match(source, /assertPreserved\(beforeSnapshot, afterSnapshot, 'Production migration'\)/);
  assert.match(source, /if \(initializeNewDatabase\)/);
});
