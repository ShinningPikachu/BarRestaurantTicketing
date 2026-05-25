import { resolve } from 'node:path';
import { ensureRuntimeEnv } from './runtime-env.mjs';

const envPath = resolve(process.cwd(), '.env');
const result = ensureRuntimeEnv(envPath);

if (result.accessCode) {
  console.log(`POS access code: ${result.accessCode}`);
}
