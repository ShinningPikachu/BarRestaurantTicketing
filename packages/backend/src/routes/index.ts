import { Router } from 'express';
import healthRouter from './health';
import ordersRouter from './orders';
import menuRouter from './menu';
import tablesRouter from './tables';
import ticketsRouter from './tickets';
import printersRouter from './printers';

const router = Router();

router.use('/health', healthRouter);
router.use('/api/orders', ordersRouter);
router.use('/api/menu', menuRouter);
router.use('/api/tables', tablesRouter);
router.use('/api/tickets', ticketsRouter);
router.use('/api/printers', printersRouter);

export default router;
