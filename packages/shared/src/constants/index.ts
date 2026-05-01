/**
 * Shared constants for Bar Restaurant Ticketing system
 */

export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  ORDERS: '/api/orders',
  MENU: '/api/menu'
} as const;

export const STORAGE_KEYS = {
  TABLES: 'bar-ticketing-tables',
  PREORDER: 'bar-ticketing-preorder'
} as const;
