import { createApp } from './app.js';
import { config } from './config/index.js';
import prisma from './db.js';
import { logger } from './utils/logger.js';

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  logger.info(
    { host: config.host, port: config.port },
    `Backend listening on http://${config.host}:${config.port}`
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down backend');

  const forceExit = setTimeout(() => {
    logger.error({ signal }, 'Backend shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (error) => {
    try {
      await prisma.$disconnect();
    } finally {
      clearTimeout(forceExit);
      if (error) {
        logger.error({ error: { name: error.name, message: error.message } }, 'Server close failed');
        process.exit(1);
      }
      process.exit(0);
    }
  });
}

server.on('error', (error) => {
  logger.error({ error: { name: error.name, message: error.message } }, 'Backend server failed');
  void prisma.$disconnect().finally(() => process.exit(1));
});

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
