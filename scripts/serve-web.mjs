import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, isAbsolute, relative, resolve } from 'node:path';

const webRoot = resolve(process.cwd(), 'packages/frontend/dist');
const port = Number(process.env.DESKTOP_EXPO_PORT || '8081');
const host = process.env.DESKTOP_HOST || '127.0.0.1';

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('DESKTOP_EXPO_PORT must be an integer between 1 and 65535');
}
if (!existsSync(resolve(webRoot, 'index.html'))) {
  throw new Error('Production frontend export is missing; run npm run build:production first');
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function safeFilePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const requestedPath = resolve(webRoot, `.${pathname}`);
  const fromRoot = relative(webRoot, requestedPath);
  if (isAbsolute(fromRoot) || fromRoot.startsWith('..') || fromRoot.includes('\0')) return null;
  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) return requestedPath;
  return resolve(webRoot, 'index.html');
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  let filePath;
  try {
    filePath = safeFilePath(request.url || '/');
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }
  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': extname(filePath) === '.html' ? 'no-store' : 'public, max-age=3600',
    'Content-Type': contentTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.once('error', () => response.destroy());
  stream.pipe(response);
});

server.listen(port, host, () => {
  console.log(`Production desktop POS listening on http://${host}:${port}`);
});

function shutdown() {
  server.close((error) => process.exit(error ? 1 : 0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
server.once('error', (error) => {
  console.error(`Production web server failed: ${error.message}`);
  process.exit(1);
});
