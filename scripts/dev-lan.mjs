import os from 'node:os';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), '.env'));

function getLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) {
        continue;
      }

      const score = /^(en|eth|wl|wlan|wifi)/i.test(name) ? 0 : 1;
      candidates.push({ address: address.address, score });
    }
  }

  candidates.sort((left, right) => left.score - right.score);
  return candidates[0]?.address ?? 'localhost';
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const backendPort = process.env.PORT || '3000';
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || `http://${getLanIp()}:${backendPort}/api`;
const desktopPort = process.env.DESKTOP_EXPO_PORT || '8081';
const phonePort = process.env.PHONE_EXPO_PORT || '8082';

const childProcesses = [
  spawn(npmCommand, ['run', 'dev', '-w', 'backend'], {
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(npmCommand, ['run', 'web:desktop', '-w', 'frontend', '--', '--port', desktopPort], {
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
      EXPO_PUBLIC_TPV_SCREEN: 'desktop',
    },
  }),
  spawn(npmCommand, ['run', 'dev:phone', '-w', 'frontend', '--', '--port', phonePort], {
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
      EXPO_PUBLIC_TPV_SCREEN: 'mobile',
    },
  }),
];

console.log(`\nBackend API shared by both screens: ${apiBaseUrl}`);
console.log(`Computer web TPV: http://localhost:${desktopPort}`);
console.log(`Phone Expo TPV: scan the QR code from the Expo server on port ${phonePort}\n`);

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
  process.exitCode = exitCode;
}

for (const child of childProcesses) {
  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    if (code !== 0 && signal !== 'SIGINT') {
      shutdown(code ?? 1);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
