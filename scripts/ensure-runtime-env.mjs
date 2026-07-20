import { resolve } from 'node:path';
import { ensureRuntimeEnv } from './runtime-env.mjs';

const envPath = resolve(process.cwd(), '.env');
const result = ensureRuntimeEnv(envPath);

if (result.accessCode && (result.createdAccessCode || process.env.BAR_TICKETING_SHOW_ACCESS_CODE === '1')) {
  console.log(`POS access code: ${result.accessCode}`);
}
