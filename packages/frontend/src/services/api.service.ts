/**
 * API service for backend communication
 */
export class ApiService {
  async fetchOrders() {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  }

  async createOrder(tableId: number, items: any[]) {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, items })
    });
    if (!res.ok) throw new Error('Failed to create order');
    return res.json();
  }

  async deleteOrder(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete order');
    return res.json();
  }

  async fetchMenu() {
    const res = await fetch('/api/menu');
    if (!res.ok) throw new Error('Failed to fetch menu');
    return res.json();
  }

  async getMenuItemById(id: number) {
    const res = await fetch(`/api/menu/${id}`);
    if (!res.ok) throw new Error('Menu item not found');
    return res.json();
  }

  async getMenuItemsByCategory(category: string) {
    const res = await fetch(`/api/menu/category/${category}`);
    if (!res.ok) throw new Error('Failed to fetch menu items by category');
    return res.json();
  }
}

export const apiService = new ApiService();
