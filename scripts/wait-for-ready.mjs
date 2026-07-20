import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getReadinessConfig } from './readiness.mjs';
import { loadEnvFile } from './runtime-env.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnvFile(resolve(repoRoot, '.env'));

const { backendHealthUrl, desktopUrl, timeoutMs } = getReadinessConfig(process.env);
const deadline = Date.now() + timeoutMs;

async function endpointIsReady(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

console.log('Waiting for backend and desktop POS readiness...');
while (Date.now() < deadline) {
  const [backendReady, desktopReady] = await Promise.all([
    endpointIsReady(backendHealthUrl),
    endpointIsReady(desktopUrl),
  ]);
  if (backendReady && desktopReady) {
    console.log('Backend and desktop POS are ready.');
    process.exit(0);
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
}

console.error(`Application readiness timed out. Backend: ${backendHealthUrl}; desktop: ${desktopUrl}`);
process.exit(1);
