import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { printExpoGoLink, printInstalledAppPairingCode } from './expo-terminal.mjs';
import { getHostIp } from './network-address.mjs';
import { ensureRuntimeEnv, loadEnvFile } from './runtime-env.mjs';

const runtimeEnv = ensureRuntimeEnv(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), '.env'));

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const productionMode = process.argv.includes('--production');
const backendPort = process.env.PORT || '3000';
const hostIp = getHostIp({ fallback: 'localhost' });
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || `http://${hostIp}:${backendPort}/api`;
const pairingApiBaseUrl = `http://${hostIp}:${backendPort}/api`;
const desktopPort = process.env.DESKTOP_EXPO_PORT || '8081';
const phonePort = process.env.PHONE_EXPO_PORT || '8082';
const corsOrigins = process.env.CORS_ORIGINS
  || `http://localhost:${desktopPort},http://127.0.0.1:${desktopPort}`;
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
];
if (!productionMode) configuredPorts.push({ label: 'Phone POS', port: phonePort });
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
let phoneStartTimer;
let shutdownPromise;
let requestedExitCode = 0;

function writePidFile() {
  const pids = childProcesses
    .map((child) => child.pid)
    .filter(Boolean);
  const temporaryPath = `${pidFile}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${pids.join('\n')}\n`, 'utf8');
  renameSync(temporaryPath, pidFile);
}

function spawnChild(label, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    detached: process.platform !== 'win32',
  });
  child.appLabel = label;
  childProcesses.push(child);
  writePidFile();
  attachExitHandler(child);
  return child;
}

function attachExitHandler(child) {
  child.once('error', (error) => {
    if (shuttingDown) {
      return;
    }
    console.error(`${child.appLabel} failed to start: ${error.message}`);
    requestShutdown(1);
  });
  child.once('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    console.error(
      `${child.appLabel} stopped unexpectedly${signal ? ` after ${signal}` : ` with exit code ${code ?? 'unknown'}`}.`,
    );
    requestShutdown(code && code > 0 ? code : 1);
  });
}

spawnChild('Backend API', npmCommand, ['run', productionMode ? 'start' : 'dev', '-w', 'backend'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: productionMode ? 'production' : (process.env.NODE_ENV || 'development'),
    CORS_ORIGINS: corsOrigins,
  },
});

spawnChild(
  'Desktop POS',
  productionMode ? process.execPath : npmCommand,
  productionMode
    ? ['scripts/serve-web.mjs']
    : ['run', 'web:desktop', '-w', 'frontend', '--', '--port', desktopPort, ...expoDevToolsArgs],
  {
  stdio: 'inherit',
  env: {
    ...process.env,
    BROWSER: 'none',
    EXPO_HOME: desktopExpoHome,
    __UNSAFE_EXPO_HOME_DIRECTORY: desktopExpoHome,
    EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
    EXPO_PUBLIC_TPV_SCREEN: 'desktop',
  },
  },
);

if (!productionMode) phoneStartTimer = setTimeout(() => {
  if (shuttingDown) {
    return;
  }

  spawnChild('Phone POS', npmCommand, ['run', 'dev:phone', '-w', 'frontend', '--', '--port', phonePort, ...expoDevToolsArgs], {
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
if (!productionMode) console.log(`Phone Expo TPV: scan the QR code from the Expo server on port ${phonePort}\n`);
printInstalledAppPairingCode(pairingApiBaseUrl);
if (productionMode) {
  console.log('Production mode: compiled backend and exported web app; Expo/tsx watchers and native DevTools are disabled.\n');
} else if (!enableNativeDevTools) {
  console.log('Native React DevTools disabled for the combined POS launcher. Set BAR_TICKETING_ENABLE_NATIVE_DEVTOOLS=1 to enable them.\n');
}
if (runtimeEnv.accessCode && (!productionMode || runtimeEnv.createdAccessCode || process.env.BAR_TICKETING_SHOW_ACCESS_CODE === '1')) {
  console.log(`POS access code: ${runtimeEnv.accessCode}\n`);
}

function childHasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function signalChild(child, signal) {
  if (!child.pid || childHasExited(child)) {
    return;
  }
  try {
    if (process.platform === 'win32') {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch {
    try {
      child.kill(signal);
    } catch {
      // It may have exited between the liveness check and the signal.
    }
  }
}

async function waitForChildren(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childProcesses.every(childHasExited)) {
      return true;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  return childProcesses.every(childHasExited);
}

async function shutdown(exitCode = 0) {
  if (shutdownPromise) {
    return shutdownPromise;
  }
  shuttingDown = true;
  if (phoneStartTimer) {
    clearTimeout(phoneStartTimer);
  }

  shutdownPromise = (async () => {
    for (const child of childProcesses) {
      signalChild(child, 'SIGINT');
    }
    if (!await waitForChildren(3000)) {
      for (const child of childProcesses) {
        signalChild(child, 'SIGTERM');
      }
    }
    if (!await waitForChildren(2000) && process.platform !== 'win32') {
      for (const child of childProcesses) {
        signalChild(child, 'SIGKILL');
      }
      await waitForChildren(1000);
    }
    rmSync(pidFile, { force: true });
    process.exitCode = exitCode;
  })();
  return shutdownPromise;
}

function requestShutdown(exitCode) {
  requestedExitCode = Math.max(requestedExitCode, exitCode);
  void shutdown(requestedExitCode).finally(() => process.exit(requestedExitCode));
}

process.on('SIGINT', () => requestShutdown(0));
process.on('SIGTERM', () => requestShutdown(0));
process.on('uncaughtException', (error) => {
  console.error(`Combined launcher failed: ${error.stack || error.message}`);
  requestShutdown(1);
});
process.on('unhandledRejection', (error) => {
  console.error(`Combined launcher failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  requestShutdown(1);
});
