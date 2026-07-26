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
  let glibcVersion = '';
  try {
    glibcVersion = process.report?.getReport()?.header?.glibcVersionRuntime || '';
  } catch {
    // Runtime reports are optional; platform/architecture/ABI still prevent
    // cross-platform dependency markers from being reused.
  }
  const runtimeIdentity = JSON.stringify({
    platform: process.platform,
    architecture: process.arch,
    nodeModulesAbi: process.versions.modules,
    nodeApi: process.versions.napi,
    glibcVersion,
  });
  return createHash('sha256')
    .update(readFileSync(lockPath))
    .update('\0')
    .update(runtimeIdentity)
    .digest('hex');
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

function verifyDependencyTree() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(npmCommand, ['ls', '--all', '--include=dev'], {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 12_000) stderr += chunk.slice(0, 12_000 - stderr.length);
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(
        `Installed dependency tree does not match package-lock.json${signal ? ` after ${signal}` : ` (npm exited ${code ?? 'unknown'})`}`
        + (stderr.trim() ? `:\n${stderr.trim()}` : ''),
      ));
    });
  });
}

const digest = lockDigest();

if (recordOnly) {
  if (!dependencyTreeLooksComplete()) {
    throw new Error('The bundled dependency tree is incomplete; refusing to record it as installed.');
  }
  await verifyDependencyTree();
  recordDigest(digest);
  console.log('Verified bundled application libraries.');
} else if (recordedDigest() === digest && dependencyTreeLooksComplete()) {
  await verifyDependencyTree();
  console.log('Application libraries match package-lock.json.');
} else {
  console.log('Installing exact application libraries from package-lock.json...');
  rmSync(markerPath, { force: true });
  await runNpmCi();
  if (!dependencyTreeLooksComplete()) {
    throw new Error('npm ci completed, but required application libraries are missing.');
  }
  await verifyDependencyTree();
  recordDigest(digest);
  console.log('Application libraries are ready.');
}
