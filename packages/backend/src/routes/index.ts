import { Router } from 'express';
import healthRouter from './health.js';
import ordersRouter from './orders.js';
import menuRouter from './menu.js';
import tablesRouter from './tables.js';
import ticketsRouter from './tickets.js';
import printersRouter from './printers.js';
import syncRouter from './sync.js';
import authRouter from './auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/api/auth', authRouter);
router.use('/api', requireAuth);
router.use('/api/orders', ordersRouter);
router.use('/api/menu', menuRouter);
router.use('/api/tables', tablesRouter);
router.use('/api/tickets', ticketsRouter);
router.use('/api/printers', printersRouter);
router.use('/api/sync', syncRouter);

export default router;
