import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use(routes);

// Error handler must be last middleware
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  logger.info({ port: config.port }, `Backend listening on http://localhost:${config.port}`);
});
