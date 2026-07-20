import { createHash, timingSafeEqual } from 'node:crypto';
import { RequestHandler } from 'express';
import { config } from '../config/index.js';
import { errorResponse } from '../types/api.js';

export function secureCompare(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const authHeader = req.header('authorization') ?? '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() === 'bearer' && token && secureCompare(token, config.auth.sessionToken)) {
    next();
    return;
  }

  res.status(401).json(errorResponse('UNAUTHORIZED', 'Login required'));
};
