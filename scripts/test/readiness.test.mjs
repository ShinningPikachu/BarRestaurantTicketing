import assert from 'node:assert/strict';
import test from 'node:test';
import { getReadinessConfig } from '../readiness.mjs';

test('readiness uses the backend health route mounted at /health', () => {
  const config = getReadinessConfig({ PORT: '3456', DESKTOP_EXPO_PORT: '8765' });
  assert.equal(config.backendHealthUrl, 'http://127.0.0.1:3456/health');
  assert.equal(config.desktopUrl, 'http://127.0.0.1:8765');
});

test('readiness honors explicit URLs and rejects an invalid timeout', () => {
  const config = getReadinessConfig({
    BACKEND_HEALTH_URL: 'http://server.test/status',
    DESKTOP_URL: 'http://desktop.test',
    BAR_TICKETING_STARTUP_TIMEOUT_MS: 'invalid',
  });
  assert.equal(config.backendHealthUrl, 'http://server.test/status');
  assert.equal(config.desktopUrl, 'http://desktop.test');
  assert.equal(config.timeoutMs, 60000);
});
