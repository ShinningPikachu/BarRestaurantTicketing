import cors from 'cors';
import express from 'express';
import { config } from './config/index.js';
import { ApiError, errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, 'CORS origin not allowed', 'CORS_ORIGIN_DENIED'));
    },
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
