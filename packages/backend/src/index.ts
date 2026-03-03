import express from 'express';
import cors from 'cors';
import routes from './routes';
import { DEFAULT_PORT } from './utils/constants';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use(routes);

// Start server
const port = process.env.PORT || DEFAULT_PORT;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});
