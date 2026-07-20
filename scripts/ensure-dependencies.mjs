import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = resolve(repoRoot, 'package-lock.json');
const markerPath = resolve(repoRoot, '.cache', 'dependency-lock.sha256');
const recordOnly = process.argv.includes('--record-only');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const requiredPaths = [
  'node_modules/.bin/expo',
  'node_modules/.bin/prisma',
  'node_modules/.bin/tsx',
  'node_modules/@prisma/client',
  'node_modules/expo',
];

function lockDigest() {
  return createHash('sha256').update(readFileSync(lockPath)).digest('hex');
}

function dependencyTreeLooksComplete() {
  return requiredPaths.every((relativePath) => existsSync(resolve(repoRoot, relativePath)));
}

function recordedDigest() {
  if (!existsSync(markerPath)) {
    return '';
  }
  return readFileSync(markerPath, 'utf8').trim();
}

function recordDigest(digest) {
  mkdirSync(dirname(markerPath), { recursive: true });
  const temporaryPath = `${markerPath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, `${digest}\n`, 'utf8');
    renameSync(temporaryPath, markerPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function runNpmCi() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(npmCommand, ['ci', '--include=dev'], {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`npm ci failed${signal ? ` after ${signal}` : ` with exit code ${code ?? 'unknown'}`}`));
    });
  });
}

const digest = lockDigest();

if (recordOnly) {
  if (!dependencyTreeLooksComplete()) {
    throw new Error('The bundled dependency tree is incomplete; refusing to record it as installed.');
  }
  recordDigest(digest);
  console.log('Verified bundled application libraries.');
} else if (recordedDigest() === digest && dependencyTreeLooksComplete()) {
  console.log('Application libraries match package-lock.json.');
} else {
  console.log('Installing exact application libraries from package-lock.json...');
  rmSync(markerPath, { force: true });
  await runNpmCi();
  if (!dependencyTreeLooksComplete()) {
    throw new Error('npm ci completed, but required application libraries are missing.');
  }
  recordDigest(digest);
  console.log('Application libraries are ready.');
}
