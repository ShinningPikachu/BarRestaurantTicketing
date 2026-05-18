import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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

function getProcessList() {
  try {
    return execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function isAppWindowRunning(profileDir, url) {
  const processes = getProcessList();
  return processes
    .split('\n')
    .some((line) => line.includes(`--user-data-dir=${profileDir}`) && line.includes(`--app=${url}`));
}

function focusExistingWindow() {
  if (!commandExists('wmctrl')) {
    return false;
  }

  for (const target of [
    'BarRestaurantTicketingPOS',
    'Bar Restaurant Ticketing',
    'BarRestaurantTicketing',
    'localhost:8081',
  ]) {
    const result = spawnSync('wmctrl', ['-x', '-a', target], { stdio: 'ignore' });
    if (result.status === 0) {
      return true;
    }

    const titleResult = spawnSync('wmctrl', ['-a', target], { stdio: 'ignore' });
    if (titleResult.status === 0) {
      return true;
    }
  }

  return false;
}

function launchDetached(command, args) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

loadEnvFile(resolve(process.cwd(), '.env'));

const desktopPort = process.env.DESKTOP_EXPO_PORT || '8081';
const url = process.env.DESKTOP_URL || `http://localhost:${desktopPort}`;
const profileDir = resolve(process.cwd(), '.cache', 'browser-profile');
const browserClass = 'BarRestaurantTicketingPOS';

mkdirSync(profileDir, { recursive: true });

if (isAppWindowRunning(profileDir, url) || focusExistingWindow()) {
  console.log('The POS window is already open.');
  process.exit(0);
}

const chromiumBrowsers = [
  'chromium',
  'chromium-browser',
  'google-chrome',
  'google-chrome-stable',
  'microsoft-edge',
  'brave-browser',
];

for (const browser of chromiumBrowsers) {
  if (!commandExists(browser)) {
    continue;
  }

  launchDetached(browser, [
    `--user-data-dir=${profileDir}`,
    `--class=${browserClass}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--app=${url}`,
  ]);
  console.log(`Opened POS window: ${url}`);
  process.exit(0);
}

if (commandExists('xdg-open')) {
  launchDetached('xdg-open', [url]);
  console.log(`Opened POS in the default browser: ${url}`);
  process.exit(0);
}

if (commandExists('gio')) {
  launchDetached('gio', ['open', url]);
  console.log(`Opened POS in the default browser: ${url}`);
  process.exit(0);
}

console.log(`Open this address in a browser: ${url}`);
