import { resolve } from 'node:path';
import { loadEnvFile } from './runtime-env.mjs';

loadEnvFile(resolve(process.cwd(), '.env'));
process.env.NODE_ENV = 'production';

await import('../packages/backend/dist/config/index.js');
console.log('Production environment validation passed.');
