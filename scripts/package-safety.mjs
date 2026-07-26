import { lstatSync, readlinkSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const RELEASE_ROOT_ENTRIES = new Set([
  '.env.example',
  '.nvmrc',
  'CHANGESET_PRODUCTION_REVIEW.md',
  'Install_BarRestaurantTicketing.sh',
  'PRODUCTION_FIRST_RUN.md',
  'README.md',
  'Start_BarRestaurantTicketing.sh',
  'Stop_BarRestaurantTicketing.sh',
  'package-lock.json',
  'package.json',
  'packages',
  'scripts',
  'tsconfig.base.json',
  'tsconfig.json',
]);

const PROJECT_GENERATED_DIRECTORIES = new Set([
  '.agents',
  '.cache',
  '.codex',
  '.dist',
  '.expo',
  '.expo-shared',
  '.expo-target',
  '.git',
  '.gradle',
  'android',
  'build',
  'coverage',
  'dist',
]);

const PRIVATE_FILE_PATTERN = /(?:^|\/)(?:\.env(?:\.(?!example$).*)?|\.npmrc|\.yarnrc|credentials?(?:\..*)?|secrets?(?:\..*)?|id_rsa(?:\..*)?|[^/]+\.(?:key|p12|pfx))$/i;
const DATABASE_FILE_PATTERN = /(?:^|\/)[^/]*(?:\.db(?:$|[.-])|\.sqlite(?:3)?(?:$|[.-])|-(?:journal|wal|shm)$)/i;
const GENERATED_FILE_PATTERN = /(?:^|\/)(?:[^/]+\.tsbuildinfo|\.DS_Store|Thumbs\.db|npm-debug\.log|yarn-debug\.log|yarn-error\.log)$/i;
const RELEASE_WORKSPACES = new Set(['backend', 'frontend']);

function portablePath(filePath) {
  return filePath.split(sep).join('/');
}

export function pathIsInsideNodeModules(relativePath) {
  return portablePath(relativePath).split('/').includes('node_modules');
}

export function packagedPathViolation(relativePath, options = {}) {
  const normalized = portablePath(relativePath).replace(/^\.\//, '');
  if (!normalized) {
    return undefined;
  }

  const parts = normalized.split('/');
  const insideNodeModules = pathIsInsideNodeModules(normalized);
  if (insideNodeModules && !options.includeNodeModules) {
    return 'node_modules is not allowed in the online package';
  }
  if (!RELEASE_ROOT_ENTRIES.has(parts[0]) && parts[0] !== 'node_modules') {
    return `unexpected top-level release entry: ${parts[0]}`;
  }
  if (parts[0] === 'packages' && parts.length > 1 && !RELEASE_WORKSPACES.has(parts[1])) {
    return `unexpected package workspace: ${parts[1]}`;
  }
  if (!insideNodeModules && parts.some((part) => PROJECT_GENERATED_DIRECTORIES.has(part))) {
    return 'generated project directory is not allowed';
  }
  if (!insideNodeModules && GENERATED_FILE_PATTERN.test(`/${normalized}`)) {
    return 'generated project file is not allowed';
  }
  if (!insideNodeModules && DATABASE_FILE_PATTERN.test(`/${normalized}`)) {
    return 'runtime database, journal, WAL, or database backup is not allowed';
  }
  if (!insideNodeModules && parts.includes('prisma') && parts.includes('backups')) {
    return 'runtime database backup directory is not allowed';
  }
  if (!insideNodeModules && PRIVATE_FILE_PATTERN.test(`/${normalized}`)) {
    return 'private environment or credential file is not allowed';
  }
  return undefined;
}

export function createReleaseCopyFilter(repoRoot, options = {}) {
  return (source) => {
    const relativePath = relative(repoRoot, source);
    return packagedPathViolation(relativePath, options) === undefined;
  };
}

export function assertSafeReleaseTree(appDir, options = {}) {
  const violations = [];
  const pending = [resolve(appDir)];
  const seen = [];

  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = resolve(current, entry.name);
      const relativePath = relative(appDir, entryPath);
      seen.push(portablePath(relativePath));
      const violation = packagedPathViolation(relativePath, options);
      if (violation) {
        violations.push(`${portablePath(relativePath)}: ${violation}`);
      }
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        pending.push(entryPath);
      } else if (entry.isSymbolicLink()) {
        lstatSync(entryPath);
        const target = readlinkSync(entryPath);
        const resolvedTarget = resolve(dirname(entryPath), target);
        const targetRelativeToPackage = relative(appDir, resolvedTarget);
        if (
          isAbsolute(target)
          || targetRelativeToPackage === '..'
          || targetRelativeToPackage.startsWith(`..${sep}`)
        ) {
          violations.push(`${portablePath(relativePath)}: symlink escapes the release tree (${target})`);
        }
      }
    }
  }

  for (const required of ['package.json', 'package-lock.json', '.nvmrc', 'scripts', 'packages']) {
    if (!seen.includes(required)) {
      violations.push(`${required}: required release entry is missing`);
    }
  }

  if (violations.length > 0) {
    throw new Error(`Unsafe Linux package contents:\n${violations.map((item) => `  - ${item}`).join('\n')}`);
  }
}
