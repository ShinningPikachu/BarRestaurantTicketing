import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db';
import { errorResponse, successResponse } from '../types/api';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tickets = await prisma.paidTicket.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true },
      take: 200,
    });
    res.json(successResponse(tickets));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch paid tickets');
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticket = await prisma.paidTicket.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (!ticket) {
      res.status(404).json(errorResponse('PAID_TICKET_NOT_FOUND', 'Paid ticket not found'));
      return;
    }

    res.json(successResponse(ticket));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch paid ticket');
    next(error);
  }
});

export default router;
