import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.env.BAR_TICKETING_STATIC_ROOT || 'packages/frontend/dist');
const port = Number(process.env.DESKTOP_EXPO_PORT || '8081');
const host = process.env.DESKTOP_STATIC_HOST || '0.0.0.0';

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function getFilePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0] || '/');
  const relativePath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const candidate = resolve(root, relativePath);

  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    const indexPath = join(candidate, 'index.html');
    if (existsSync(indexPath)) {
      return indexPath;
    }
  }

  return join(root, 'index.html');
}

const server = createServer((request, response) => {
  try {
    const filePath = getFilePath(request.url || '/');

    if (!filePath || !existsSync(filePath)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes.get(extname(filePath)) || 'application/octet-stream',
      'Cache-Control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : 'Server error');
  }
});

server.listen(port, host, () => {
  console.log(`Desktop POS static server listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
