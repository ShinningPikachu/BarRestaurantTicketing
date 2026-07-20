import { Prisma } from '@prisma/client';
import { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../utils/logger.js';

export class ApiError extends Error {
  constructor(
    public statusCode: number = 500,
    public message: string = 'Internal server error',
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestError = Error & {
  code?: string;
  status?: number;
  statusCode?: number;
  type?: string;
};

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return new ApiError(404, 'Requested resource was not found', 'NOT_FOUND');
    if (error.code === 'P2002') return new ApiError(409, 'A resource with that value already exists', 'CONFLICT');
    if (error.code === 'P2003') return new ApiError(409, 'The resource is still in use', 'RESOURCE_IN_USE');
    if (['P2000', 'P2006', 'P2023'].includes(error.code)) {
      return new ApiError(400, 'The request contains an invalid database value', 'VALIDATION_ERROR');
    }
  }

  const requestError = error as RequestError;
  if (requestError?.type === 'entity.parse.failed' || (requestError instanceof SyntaxError && requestError.status === 400)) {
    return new ApiError(400, 'Request body must contain valid JSON', 'INVALID_JSON');
  }
  if (requestError?.type === 'entity.too.large' || requestError?.status === 413) {
    return new ApiError(413, 'Request body is too large', 'PAYLOAD_TOO_LARGE');
  }

  return new ApiError(500, 'Internal server error', 'INTERNAL_ERROR');
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND'));
};

export const errorHandler: ErrorRequestHandler = (err: RequestError, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const apiError = normalizeError(err);
  const errorData: Record<string, unknown> = {
    name: err?.name ?? 'Error',
    message: err?.message ?? String(err),
  };
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    errorData.code = err.code;
    errorData.meta = err.meta;
  }

  logger.error({
    error: errorData,
    path: req.path,
    method: req.method,
    statusCode: apiError.statusCode,
  }, 'Request error');

  res.status(apiError.statusCode).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
};
