export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  meta: {
    timestamp: string;
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Helper functions
export function successResponse<T>(data: T, meta?: any): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export function errorResponse(code: string, message: string): ApiResponse {
  return {
    success: false,
    error: { code, message },
    meta: { timestamp: new Date().toISOString() },
  };
}
