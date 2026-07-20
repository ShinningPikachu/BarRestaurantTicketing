import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { loadEnvFile } from './runtime-env.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
loadEnvFile(resolve(repoRoot, '.env'));

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const backendPort = process.env.PORT || '3000';
const frontendApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || `http://localhost:${backendPort}/api`;

function run(args, label, environment = process.env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(npmCommand, args, { cwd: repoRoot, env: environment, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${label} failed${signal ? ` after ${signal}` : ` with exit code ${code ?? 'unknown'}`}`));
    });
  });
}

await run(['run', '-w', 'backend', 'build'], 'Backend production build', {
  ...process.env,
  NODE_ENV: 'production',
});
await run(['run', '-w', 'frontend', 'build'], 'Frontend production export', {
  ...process.env,
  NODE_ENV: 'production',
  EXPO_PUBLIC_API_BASE_URL: frontendApiBaseUrl,
  EXPO_PUBLIC_TPV_SCREEN: 'desktop',
});

console.log(`Production build uses backend API ${frontendApiBaseUrl}`);
