import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
}));
app.use(express.json({ limit: '2mb' }));

// Routes
app.use(routes);

// Error handler must be last middleware
app.use(errorHandler);

// Start server
app.listen(config.port, config.host, () => {
  logger.info(
    { host: config.host, port: config.port },
    `Backend listening on http://${config.host}:${config.port}`
  );
});
