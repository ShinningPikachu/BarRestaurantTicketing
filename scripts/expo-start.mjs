import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const knownTargets = new Set(['desktop', 'phone', 'default']);
const [maybeTarget, ...remainingArgs] = process.argv.slice(2);
const target = knownTargets.has(maybeTarget) ? maybeTarget : 'default';
const wrapperArgs = knownTargets.has(maybeTarget) ? remainingArgs : process.argv.slice(2);
const disableNativeDevTools = wrapperArgs.includes('--without-native-devtools');
const expoArgs = wrapperArgs.filter((arg) => arg !== '--without-native-devtools');
const shouldRunOffline = process.env.BAR_TICKETING_EXPO_ONLINE !== '1';
const shouldClearCache = process.env.BAR_TICKETING_EXPO_REUSE_CACHE !== '1'
  && !expoArgs.includes('--clear')
  && !expoArgs.includes('-c');
const startArgs = shouldClearCache ? [...expoArgs, '--clear'] : expoArgs;
const expoHome = resolve(repoRoot, '.cache', 'expo', target);
const shouldEnableWebSetup = disableNativeDevTools
  && expoArgs.includes('--web')
  && process.env.EXPO_NO_WEB_SETUP === undefined;

mkdirSync(resolve(expoHome, 'versions-cache'), { recursive: true });

const expoCommand = resolve(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'expo.cmd' : 'expo',
);
const child = spawn(expoCommand, ['start', ...startArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...(shouldRunOffline ? {
      EXPO_OFFLINE: '1',
      EXPO_NO_DEPENDENCY_VALIDATION: '1',
    } : {}),
    // Expo SDK 56 only skips its optional Electron DevTools setup in headless mode.
    ...(disableNativeDevTools ? { EXPO_UNSTABLE_HEADLESS: '1' } : {}),
    ...(shouldEnableWebSetup ? { EXPO_NO_WEB_SETUP: '0' } : {}),
    __UNSAFE_EXPO_HOME_DIRECTORY: expoHome,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
