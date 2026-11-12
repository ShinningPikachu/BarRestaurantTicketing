import { createHash, timingSafeEqual } from 'node:crypto';
import { RequestHandler } from 'express';
import { config } from '../config/index.js';
import { errorResponse } from '../types/api.js';

export function secureCompare(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function bearerToken(req: Parameters<RequestHandler>[0]): string | null {
  const [scheme, token] = (req.header('authorization') ?? '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = bearerToken(req);
  if (token && (
    secureCompare(token, config.auth.sessionToken)
    || secureCompare(token, config.auth.managerSessionToken)
  )) {
    next();
    return;
  }
  res.status(401).json(errorResponse('UNAUTHORIZED', 'Login required'));
};

export const requireManager: RequestHandler = (req, res, next) => {
  const token = bearerToken(req);
  if (token && secureCompare(token, config.auth.managerSessionToken)) {
    next();
    return;
  }
  res.status(403).json(errorResponse('MANAGER_REQUIRED', 'This operation requires a manager login'));
};
