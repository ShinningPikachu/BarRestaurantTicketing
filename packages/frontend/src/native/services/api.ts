import { Platform } from 'react-native';
import type { MenuItem, Order } from '../types';

function defaultApiBaseUrl(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return 'http://localhost:3000/api';
}

// @ts-ignore - Expo injects environment variables at build time
const API_BASE_URL = (process?.env?.EXPO_PUBLIC_API_BASE_URL || defaultApiBaseUrl()).replace(/\/$/, '');

async function parseOrThrow<T>(response: Response, message: string): Promise<T> {
  if (!response.ok) {
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export class ApiService {
  async fetchOrders(): Promise<Order[]> {
    const response = await fetch(`${API_BASE_URL}/orders`);
    return parseOrThrow<Order[]>(response, 'Failed to fetch orders');
  }

  async createOrder(tableNumber: number, tableZone: string, items: Array<{ name: string; qty: number; unitPriceCents: number }>): Promise<Order> {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, tableZone, items })
    });
    return parseOrThrow<Order>(response, 'Failed to create order');
  }

  async deleteOrder(orderId: string): Promise<{ ok: boolean }> {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' });
    return parseOrThrow<{ ok: boolean }>(response, 'Failed to delete order');
  }

  async deleteOrderItem(orderId: string, itemId: number): Promise<{ ok: boolean; orderDeleted?: boolean }> {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/items/${itemId}`, { method: 'DELETE' });
    return parseOrThrow<{ ok: boolean; orderDeleted?: boolean }>(response, 'Failed to delete order item');
  }

  async fetchMenu(): Promise<MenuItem[]> {
    const response = await fetch(`${API_BASE_URL}/menu`);
    return parseOrThrow<MenuItem[]>(response, 'Failed to fetch menu');
  }
}

export const apiService = new ApiService();
