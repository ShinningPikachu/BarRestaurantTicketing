import { execFileSync, spawnSync } from 'node:child_process';
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

function commandExists(command) {
  return spawnSync('command', ['-v', command], { shell: true, stdio: 'ignore' }).status === 0;
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
    return true;
  } catch {
    return false;
  }
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
  process.env.PORT || '3000',
  process.env.DESKTOP_EXPO_PORT || '8081',
  process.env.PHONE_EXPO_PORT || '8082',
];

if (existsSync(pidFile)) {
  const livePids = parsePids(readFileSync(pidFile, 'utf8')).filter(pidIsAlive);
  if (livePids.length > 0) {
    process.exit(0);
  }
}

for (const port of ports) {
  if (findPidsByPort(port).length > 0) {
    process.exit(0);
  }
}

process.exit(1);
