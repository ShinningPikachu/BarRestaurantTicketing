import { ErrorRequestHandler } from 'express';
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

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Log the error with more details
  const errorData: any = {
    name: err.name,
    message: err.message,
  };
  
  // Handle Prisma errors
  if (err.name && err.name.includes('Prisma')) {
    errorData.code = (err as any).code;
    errorData.clientVersion = (err as any).clientVersion;
    if ((err as any).meta) {
      errorData.meta = (err as any).meta;
    }
  }
  
  logger.error({
    error: errorData,
    path: req.path,
    method: req.method,
    statusCode: err.statusCode || 500,
  }, 'Request error');

  // Handle ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Handle unknown errors
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
};
