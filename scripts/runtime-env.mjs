import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';

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

export function ensureRuntimeEnv(filePath) {
  const existingContent = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const values = parseEnvContent(existingContent);
  const additions = [];

  if (!values.has('POS_ACCESS_CODE') && process.env.POS_ACCESS_CODE === undefined) {
    additions.push(`POS_ACCESS_CODE=${String(randomInt(100000, 1000000))}`);
  }

  if (!values.has('POS_AUTH_TOKEN') && process.env.POS_AUTH_TOKEN === undefined) {
    additions.push(`POS_AUTH_TOKEN=${randomBytes(32).toString('hex')}`);
  }

  if (additions.length > 0) {
    const prefix = existingContent && !existingContent.endsWith('\n') ? '\n' : '';
    const header = existingContent ? '' : '# Local runtime settings. Keep this file private.\n';
    writeFileSync(filePath, `${existingContent}${prefix}${header}${additions.join('\n')}\n`, 'utf8');
    try {
      chmodSync(filePath, 0o600);
    } catch {
      // Best effort only; some filesystems do not support Unix modes.
    }
  }

  const finalValues = loadEnvFile(filePath);
  return {
    accessCode: finalValues.get('POS_ACCESS_CODE') ?? process.env.POS_ACCESS_CODE,
    created: additions.length > 0,
  };
}
