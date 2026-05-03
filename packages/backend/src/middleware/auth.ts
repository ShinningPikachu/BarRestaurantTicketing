import { RequestHandler } from 'express';
import { config } from '../config/index.js';
import { errorResponse } from '../types/api.js';

export const requireAuth: RequestHandler = (req, res, next) => {
  const authHeader = req.header('authorization') ?? '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme === 'Bearer' && token === config.auth.sessionToken) {
    next();
    return;
  }

  res.status(401).json(errorResponse('UNAUTHORIZED', 'Login required'));
};

