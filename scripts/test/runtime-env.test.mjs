import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { ensureRuntimeEnv, parseEnvContent } from '../runtime-env.mjs';

function withCleanAuthEnvironment(callback) {
  const oldAccessCode = process.env.POS_ACCESS_CODE;
  const oldAuthToken = process.env.POS_AUTH_TOKEN;
  delete process.env.POS_ACCESS_CODE;
  delete process.env.POS_AUTH_TOKEN;
  try {
    return callback();
  } finally {
    if (oldAccessCode === undefined) delete process.env.POS_ACCESS_CODE;
    else process.env.POS_ACCESS_CODE = oldAccessCode;
    if (oldAuthToken === undefined) delete process.env.POS_AUTH_TOKEN;
    else process.env.POS_AUTH_TOKEN = oldAuthToken;
  }
}

test('parseEnvContent handles quoted values and final duplicate wins', () => {
  const values = parseEnvContent('A="first value"\nA=second\nB=\'third\'\n');
  assert.equal(values.get('A'), 'second');
  assert.equal(values.get('B'), 'third');
});

test('ensureRuntimeEnv replaces blank credentials and protects the file', () => {
  withCleanAuthEnvironment(() => {
    const directory = mkdtempSync(resolve(tmpdir(), 'bar-ticketing-env-test-'));
    const envPath = resolve(directory, '.env');
    try {
      writeFileSync(envPath, 'POS_ACCESS_CODE=\nPOS_AUTH_TOKEN=\n', { mode: 0o644 });
      const result = ensureRuntimeEnv(envPath);
      const values = parseEnvContent(readFileSync(envPath, 'utf8'));
      assert.match(values.get('POS_ACCESS_CODE'), /^\d{6}$/);
      assert.match(values.get('POS_AUTH_TOKEN'), /^[a-f0-9]{64}$/);
      assert.equal(result.accessCode, values.get('POS_ACCESS_CODE'));
      if (process.platform !== 'win32') {
        assert.equal(statSync(envPath).mode & 0o777, 0o600);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

test('ensureRuntimeEnv reports the effective process override', () => {
  withCleanAuthEnvironment(() => {
    const directory = mkdtempSync(resolve(tmpdir(), 'bar-ticketing-env-test-'));
    const envPath = resolve(directory, '.env');
    try {
      writeFileSync(envPath, 'POS_ACCESS_CODE=111111\nPOS_AUTH_TOKEN=file-token\n');
      process.env.POS_ACCESS_CODE = '222222';
      process.env.POS_AUTH_TOKEN = 'environment-token';
      const result = ensureRuntimeEnv(envPath);
      assert.equal(result.accessCode, '222222');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
