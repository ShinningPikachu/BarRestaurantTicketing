import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from './runtime-env.mjs';

const appRoot = process.cwd();

function commandExists(command) {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(lookupCommand, [command], { stdio: 'ignore' }).status === 0;
}

function parsePids(text) {
  return text
    .split(/\s+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 1);
}

function pidIsAlive(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform !== 'win32') {
      const state = execFileSync('ps', ['-p', String(pid), '-o', 'stat='], { encoding: 'utf8' }).trim();
      if (state.startsWith('Z')) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function getCommandLine(pid) {
  try {
    return execFileSync('ps', ['-p', String(pid), '-o', 'args='], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function workingDirectoryLooksLikeThisApp(pid) {
  if (process.platform !== 'linux') {
    return false;
  }

  try {
    const workingDirectory = resolve(readlinkSync(`/proc/${pid}/cwd`));
    return workingDirectory === appRoot || workingDirectory.startsWith(`${appRoot}/`);
  } catch {
    return false;
  }
}

function commandLooksLikeThisApp(pid) {
  const commandLine = getCommandLine(pid);
  return commandLine.includes(appRoot)
    || commandLine.includes('BarRestaurantTicketing')
    || commandLine.includes('bar-restaurant-ticketing')
    || workingDirectoryLooksLikeThisApp(pid);
}

function findPidsByPort(port) {
  if (commandExists('lsof')) {
    try {
      return parsePids(execFileSync('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }));
    } catch {
      return [];
    }
  }

  if (commandExists('fuser')) {
    try {
      return parsePids(execFileSync('fuser', [`${port}/tcp`], { encoding: 'utf8' }));
    } catch {
      return [];
    }
  }

  return [];
}

loadEnvFile(resolve(process.cwd(), '.env'));

const pidFile = resolve(process.cwd(), '.cache', 'bar-restaurant-ticketing.pids');
const ports = [
  { label: 'backend API', port: process.env.PORT || '3000' },
  { label: 'desktop POS', port: process.env.DESKTOP_EXPO_PORT || '8081' },
  { label: 'phone POS', port: process.env.PHONE_EXPO_PORT || '8082' },
];

const pidFileHasAppProcess = existsSync(pidFile) && parsePids(readFileSync(pidFile, 'utf8')).some((pid) => (
  pidIsAlive(pid) && commandLooksLikeThisApp(pid)
));

const portOwners = ports.map(({ label, port }) => {
  const pids = findPidsByPort(port);
  return {
    label,
    port,
    pids,
    hasAppProcess: pids.some(commandLooksLikeThisApp),
  };
});

if (portOwners.every(({ hasAppProcess }) => hasAppProcess)) {
  process.exit(0);
}

if (pidFileHasAppProcess || portOwners.some(({ hasAppProcess }) => hasAppProcess)) {
  console.error('A previous BarRestaurantTicketing start is incomplete and needs to be restarted.');
  process.exit(2);
}

const occupiedPorts = portOwners.filter(({ pids }) => pids.length > 0);
if (occupiedPorts.length > 0) {
  const details = occupiedPorts
    .map(({ label, port }) => `${label} port ${port}`)
    .join(', ');
  console.error(`Cannot start BarRestaurantTicketing because another program is using ${details}.`);
  process.exit(3);
}

process.exit(1);
