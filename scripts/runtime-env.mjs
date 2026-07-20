import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { dirname } from 'node:path';

export function parseEnvContent(content) {
  const values = new Map();

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
    values.set(key, value);
  }

  return values;
}

export function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return new Map();
  }

  const values = parseEnvContent(readFileSync(filePath, 'utf8'));
  for (const [key, value] of values.entries()) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return values;
}

function writePrivateFileAtomically(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;

  try {
    writeFileSync(temporaryPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    renameSync(temporaryPath, filePath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function enforcePrivatePermissions(filePath) {
  try {
    chmodSync(filePath, 0o600);
  } catch (error) {
    if (process.platform !== 'win32') {
      throw new Error(`Could not protect runtime settings at ${filePath}: ${error.message}`);
    }
  }
}

export function ensureRuntimeEnv(filePath) {
  const existingContent = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const values = parseEnvContent(existingContent);
  const additions = [];
  const configuredAccessCode = values.get('POS_ACCESS_CODE')?.trim();
  const environmentAccessCode = process.env.POS_ACCESS_CODE?.trim();
  const configuredAuthToken = values.get('POS_AUTH_TOKEN')?.trim();
  const environmentAuthToken = process.env.POS_AUTH_TOKEN?.trim();

  if (!configuredAccessCode && !environmentAccessCode) {
    additions.push(`POS_ACCESS_CODE=${String(randomInt(100000, 1000000))}`);
  }

  if (!configuredAuthToken && !environmentAuthToken) {
    additions.push(`POS_AUTH_TOKEN=${randomBytes(32).toString('hex')}`);
  }

  if (additions.length > 0) {
    const prefix = existingContent && !existingContent.endsWith('\n') ? '\n' : '';
    const header = existingContent ? '' : '# Local runtime settings. Keep this file private.\n';
    writePrivateFileAtomically(
      filePath,
      `${existingContent}${prefix}${header}${additions.join('\n')}\n`,
    );
  }

  if (existsSync(filePath)) {
    enforcePrivatePermissions(filePath);
  }

  const finalValues = loadEnvFile(filePath);
  const fileAccessCode = finalValues.get('POS_ACCESS_CODE')?.trim();
  const fileAuthToken = finalValues.get('POS_AUTH_TOKEN')?.trim();

  // A blank inherited variable must not force the backend onto its insecure fallback.
  if (!process.env.POS_ACCESS_CODE?.trim() && fileAccessCode) {
    process.env.POS_ACCESS_CODE = fileAccessCode;
  }
  if (!process.env.POS_AUTH_TOKEN?.trim() && fileAuthToken) {
    process.env.POS_AUTH_TOKEN = fileAuthToken;
  }

  return {
    accessCode: process.env.POS_ACCESS_CODE?.trim() || fileAccessCode,
    created: additions.length > 0,
    createdAccessCode: additions.some((line) => line.startsWith('POS_ACCESS_CODE=')),
  };
}
