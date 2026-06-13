import net from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { printExpoGoLink, printInstalledAppPairingCode } from './expo-terminal.mjs';
import { getHostIp } from './network-address.mjs';
import { ensureRuntimeEnv } from './runtime-env.mjs';

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

const runtimeEnv = ensureRuntimeEnv(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), '.env'));

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const backendPort = process.env.PORT || '3000';
const hostIp = getHostIp({ fallback: 'localhost' });
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || `http://${hostIp}:${backendPort}/api`;
const pairingApiBaseUrl = `http://${hostIp}:${backendPort}/api`;
const desktopPort = process.env.DESKTOP_EXPO_PORT || '8081';
const phonePort = process.env.PHONE_EXPO_PORT || '8082';
const phoneExpoUrl = `exp://${hostIp}:${phonePort}`;
const cacheRoot = resolve(process.cwd(), '.cache', 'expo');
const pidFile = resolve(process.cwd(), '.cache', 'bar-restaurant-ticketing.pids');
const desktopExpoHome = resolve(cacheRoot, 'desktop');
const phoneExpoHome = resolve(cacheRoot, 'phone');
const enableNativeDevTools = process.env.BAR_TICKETING_ENABLE_NATIVE_DEVTOOLS === '1';
const expoDevToolsArgs = enableNativeDevTools ? [] : ['--without-native-devtools'];

function verifyPortAvailable(label, port) {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`${label} port ${port} is already in use.`));
        return;
      }
      reject(error);
    });

    server.listen(Number(port), '0.0.0.0', () => {
      server.close(resolvePort);
    });
  });
}

const configuredPorts = [
  { label: 'Backend API', port: backendPort },
  { label: 'Desktop POS', port: desktopPort },
  { label: 'Phone POS', port: phonePort },
];
const distinctPorts = new Set(configuredPorts.map(({ port }) => String(port)));

if (distinctPorts.size !== configuredPorts.length) {
  console.error('Cannot start BarRestaurantTicketing because backend, desktop, and phone ports must be different.');
  process.exit(1);
}

try {
  await Promise.all(configuredPorts.map(({ label, port }) => verifyPortAvailable(label, port)));
} catch (error) {
  console.error(`Cannot start BarRestaurantTicketing: ${error.message}`);
  console.error('If a previous application window was closed unexpectedly, run `npm run stop`, then start again.');
  process.exit(1);
}

mkdirSync(desktopExpoHome, { recursive: true });
mkdirSync(phoneExpoHome, { recursive: true });

let shuttingDown = false;
const childProcesses = [];

function writePidFile() {
  const pids = childProcesses
    .map((child) => child.pid)
    .filter(Boolean);

  writeFileSync(pidFile, `${pids.join('\n')}\n`, 'utf8');
}

function spawnChild(command, args, options) {
  const child = spawn(command, args, {
    ...options,
    detached: process.platform !== 'win32',
  });
  childProcesses.push(child);
  writePidFile();
  attachExitHandler(child);
  return child;
}

function attachExitHandler(child) {
  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    if (code !== 0 && signal !== 'SIGINT') {
      shutdown(code ?? 1);
    }
  });
}

spawnChild(npmCommand, ['run', 'dev', '-w', 'backend'], {
  stdio: 'inherit',
  env: process.env,
});

spawnChild(npmCommand, ['run', 'web:desktop', '-w', 'frontend', '--', '--port', desktopPort, ...expoDevToolsArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    BROWSER: 'none',
    EXPO_HOME: desktopExpoHome,
    __UNSAFE_EXPO_HOME_DIRECTORY: desktopExpoHome,
    EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
    EXPO_PUBLIC_TPV_SCREEN: 'desktop',
  },
});

setTimeout(() => {
  if (shuttingDown) {
    return;
  }

  spawnChild(npmCommand, ['run', 'dev:phone', '-w', 'frontend', '--', '--port', phonePort, ...expoDevToolsArgs], {
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_HOME: phoneExpoHome,
      __UNSAFE_EXPO_HOME_DIRECTORY: phoneExpoHome,
      EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
      EXPO_PUBLIC_TPV_SCREEN: 'mobile',
    },
  });

  if (!enableNativeDevTools) {
    printExpoGoLink(phoneExpoUrl);
  }
}, 1500);

console.log(`\nSelected computer address for phone pairing: ${hostIp}`);
console.log('Tip: if you use the computer hotspot and the QR shows the wrong address, restart with BAR_TICKETING_HOST_IP set to the hotspot IP.');
console.log(`Backend API shared by both screens: ${apiBaseUrl}`);
console.log(`Computer web TPV: http://localhost:${desktopPort}`);
console.log(`Phone Expo TPV: scan the QR code from the Expo server on port ${phonePort}\n`);
printInstalledAppPairingCode(pairingApiBaseUrl);
if (!enableNativeDevTools) {
  console.log('Native React DevTools disabled for the combined POS launcher. Set BAR_TICKETING_ENABLE_NATIVE_DEVTOOLS=1 to enable them.\n');
}
if (runtimeEnv.accessCode) {
  console.log(`POS access code: ${runtimeEnv.accessCode}\n`);
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of childProcesses) {
    if (!child.killed) {
      try {
        if (process.platform === 'win32') {
          child.kill('SIGINT');
        } else {
          process.kill(-child.pid, 'SIGINT');
        }
      } catch {
        child.kill('SIGINT');
      }
    }
  }
  rmSync(pidFile, { force: true });
  process.exitCode = exitCode;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
