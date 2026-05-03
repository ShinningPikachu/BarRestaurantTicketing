import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import { validateBody } from '../middleware/validation.js';
import { errorResponse, successResponse } from '../types/api.js';

const router = Router();

const loginSchema = z.object({
  accessCode: z.string().trim().min(1),
});

router.post('/login', validateBody(loginSchema), (req: Request, res: Response) => {
  if (req.body.accessCode !== config.auth.accessCode) {
    res.status(401).json(errorResponse('INVALID_LOGIN', 'Invalid access code'));
    return;
  }

  res.json(successResponse({ token: config.auth.sessionToken }));
});

export default router;

