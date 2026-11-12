import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const marker = resolve(root, '.cache/production-build.sha256');
const sources = [
  'package.json', 'package-lock.json', 'tsconfig.base.json',
  'packages/backend/package.json', 'packages/backend/tsconfig.json',
  'packages/backend/src', 'packages/backend/prisma',
  'packages/frontend/package.json', 'packages/frontend/tsconfig.json',
  'packages/frontend/App.tsx', 'packages/frontend/index.js',
  'packages/frontend/app.json', 'packages/frontend/babel.config.js',
  'packages/frontend/metro.config.js', 'packages/frontend/src',
  'scripts/build-production.mjs', 'scripts/production-manifest.mjs',
];

export function productionSourceDigest() {
  const digest = createHash('sha256');
  function visit(path) {
    if (!existsSync(path)) throw new Error(`Missing production source: ${relative(root, path)}`);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) {
        if (['node_modules', 'dist', 'backups', '.cache'].includes(name)) continue;
        if (/\\.db(?:$|[-.])|-(?:journal|wal|shm)$/.test(name)) continue;
        visit(join(path, name));
      }
    } else if (stat.isFile()) {
      digest.update(relative(root, path).replaceAll('\\', '/'));
      digest.update('\0');
      digest.update(readFileSync(path));
      digest.update('\0');
    }
  }
  for (const entry of sources) visit(resolve(root, entry));
  return digest.digest('hex');
}

export function recordProductionBuild() {
  mkdirSync(resolve(root, '.cache'), { recursive: true });
  const temporary = `${marker}.${process.pid}.tmp`;
  writeFileSync(temporary, productionSourceDigest() + '\n', { mode: 0o600 });
  renameSync(temporary, marker);
}

export function assertProductionBuildCurrent() {
  const backend = resolve(root, 'packages/backend/dist/index.js');
  const frontend = resolve(root, 'packages/frontend/dist/index.html');
  if (!existsSync(backend) || !existsSync(frontend) || !existsSync(marker)) {
    throw new Error('Production build is missing. Run the installer before starting the POS.');
  }
  const recorded = readFileSync(marker, 'utf8').trim();
  if (recorded !== productionSourceDigest()) {
    throw new Error('Source files changed after the last production build. Run the installer before starting the POS.');
  }
}
