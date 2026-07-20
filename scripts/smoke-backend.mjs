import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function reservePort() {
  return new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : undefined;
      server.close((error) => (error ? reject(error) : resolvePromise(port)));
    });
  });
}

function signalChild(child, signal) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    try { child.kill(signal); } catch { /* already stopped */ }
  }
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => resolvePromise(false), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolvePromise(true);
    });
  });
}

const port = await reservePort();
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'bar-ticketing-smoke-'));
const temporaryDatabaseUrl = `file:${join(temporaryDirectory, 'smoke.db')}`;
const output = [];
const child = spawn(npmCommand, ['run', '-w', 'backend', 'start'], {
  cwd: process.cwd(),
  detached: process.platform !== 'win32',
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    POS_ACCESS_CODE: 'smoke-test-only',
    POS_AUTH_TOKEN: 'smoke-test-token-not-for-runtime-use',
    NODE_ENV: 'test',
    BAR_TICKETING_TEST_DATABASE_URL: temporaryDatabaseUrl,
    TICKET_BUSINESS_NAME: 'Smoke Test Business',
    TICKET_TRADE_NAME: 'Smoke Test',
    TICKET_BUSINESS_NIF: 'TEST-NIF',
    TICKET_BUSINESS_ADDRESS: 'Smoke test only',
    TICKET_BUSINESS_CITY: 'Test City',
    TICKET_BUSINESS_PHONE: '000000000',
    TICKET_VAT_RATE: '10',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    output.push(chunk);
    if (output.join('').length > 12000) output.shift();
  });
}

let ready = false;
const deadline = Date.now() + 15000;
try {
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) break;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // The compiled server may still be starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }

  if (!ready) {
    throw new Error(`Compiled backend did not become healthy.\n${output.join('').trim()}`);
  }

  const unauthenticated = await fetch(`http://127.0.0.1:${port}/api/sync/revision`);
  if (unauthenticated.status !== 401) {
    throw new Error(`Compiled backend auth boundary returned ${unauthenticated.status}; expected 401.`);
  }

  const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accessCode: 'smoke-test-only' }),
  });
  const loginBody = await login.json();
  const token = loginBody?.data?.token;
  if (!login.ok || token !== 'smoke-test-token-not-for-runtime-use') {
    throw new Error(`Compiled backend login failed with status ${login.status}.`);
  }

  const authenticated = await fetch(`http://127.0.0.1:${port}/api/sync/revision`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const syncBody = await authenticated.json();
  if (!authenticated.ok || typeof syncBody?.data?.instanceId !== 'string') {
    throw new Error(`Compiled backend authenticated API check failed with status ${authenticated.status}.`);
  }
  console.log(`Compiled backend smoke check passed on port ${port}.`);
} finally {
  signalChild(child, 'SIGTERM');
  if (!await waitForExit(child, 3000)) {
    signalChild(child, 'SIGKILL');
    await waitForExit(child, 1000);
  }
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
