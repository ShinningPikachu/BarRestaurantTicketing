import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readlinkSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const appRoot = process.cwd();

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
    const value = line.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

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

function getProcessGroupId(pid) {
  try {
    const value = execFileSync('ps', ['-p', String(pid), '-o', 'pgid='], { encoding: 'utf8' }).trim();
    const processGroupId = Number(value);
    return Number.isInteger(processGroupId) && processGroupId > 1 ? processGroupId : pid;
  } catch {
    return pid;
  }
}

function killPid(pid, signal) {
  try {
    if (process.platform === 'win32') {
      process.kill(pid, signal);
    } else {
      process.kill(-getProcessGroupId(pid), signal);
    }
    return true;
  } catch {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

loadEnvFile(resolve(process.cwd(), '.env'));

const pidFile = resolve(process.cwd(), '.cache', 'bar-restaurant-ticketing.pids');
const ports = [
  process.env.PORT || '3000',
  process.env.DESKTOP_EXPO_PORT || '8081',
  process.env.PHONE_EXPO_PORT || '8082',
];

const pids = new Set();

if (existsSync(pidFile)) {
  for (const pid of parsePids(readFileSync(pidFile, 'utf8'))) {
    if (commandLooksLikeThisApp(pid)) {
      pids.add(pid);
    }
  }
}

for (const port of ports) {
  for (const pid of findPidsByPort(port)) {
    if (commandLooksLikeThisApp(pid)) {
      pids.add(pid);
    }
  }
}

if (pids.size === 0) {
  console.log('No running BarRestaurantTicketing processes were found.');
  process.exit(0);
}

console.log(`Stopping BarRestaurantTicketing processes: ${[...pids].join(', ')}`);

for (const pid of pids) {
  killPid(pid, 'SIGINT');
}

sleep(1500);

for (const pid of pids) {
  killPid(pid, 'SIGTERM');
}

rmSync(pidFile, { force: true });
console.log('Stop command sent.');
