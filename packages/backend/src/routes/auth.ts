import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import { secureCompare } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { errorResponse, successResponse } from '../types/api.js';

const router = Router();

const loginSchema = z.object({
  accessCode: z.string().trim().min(4).max(128),
});

const LOGIN_WINDOW_MS = 5 * 60_000;
const MAX_LOGIN_FAILURES = 5;
const MAX_TRACKED_CLIENTS = 5_000;
const loginFailures = new Map<string, { count: number; windowStartedAt: number }>();

function pruneLoginFailures(now: number): void {
  for (const [key, value] of loginFailures) {
    if (now - value.windowStartedAt >= LOGIN_WINDOW_MS) loginFailures.delete(key);
  }
  while (loginFailures.size > MAX_TRACKED_CLIENTS) {
    const oldestKey = loginFailures.keys().next().value as string | undefined;
    if (!oldestKey) break;
    loginFailures.delete(oldestKey);
  }
}

router.post('/login', validateBody(loginSchema), (req: Request, res: Response) => {
  const now = Date.now();
  const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
  pruneLoginFailures(now);
  const previous = loginFailures.get(clientKey);
  if (previous && now - previous.windowStartedAt < LOGIN_WINDOW_MS && previous.count >= MAX_LOGIN_FAILURES) {
    const retryAfterSeconds = Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (now - previous.windowStartedAt)) / 1_000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json(errorResponse('LOGIN_RATE_LIMITED', 'Too many login attempts; try again later'));
    return;
  }

  if (!secureCompare(req.body.accessCode, config.auth.accessCode)) {
    const next = previous && now - previous.windowStartedAt < LOGIN_WINDOW_MS
      ? { ...previous, count: previous.count + 1 }
      : { count: 1, windowStartedAt: now };
    loginFailures.set(clientKey, next);
    res.status(401).json(errorResponse('INVALID_LOGIN', 'Invalid access code'));
    return;
  }

  loginFailures.delete(clientKey);
  res.setHeader('Cache-Control', 'no-store');
  res.json(successResponse({ token: config.auth.sessionToken }));
});

export default router;
