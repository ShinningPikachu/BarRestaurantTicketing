import { Router } from 'express';
import healthRouter from './health';
import ordersRouter from './orders';
import menuRouter from './menu';
import tablesRouter from './tables';
import ticketsRouter from './tickets';
import printersRouter from './printers';
import syncRouter from './sync';
import authRouter from './auth';
import { requireAuth } from '../middleware/auth';

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
