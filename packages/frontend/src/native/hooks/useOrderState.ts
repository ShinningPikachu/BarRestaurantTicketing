import { useState } from 'react';
import { PreOrderItem, Order } from '../types';

export function useOrderState() {
  const [preorderItems, setPreorderItems] = useState<PreOrderItem[]>([]);
  const [tableConfirmedOrders, setTableConfirmedOrders] = useState<
    Map<string, Order[]>
  >(new Map());
  const [priceDraftByItemId, setPriceDraftByItemId] = useState<Map<number, number>>(
    new Map()
  );

  return {
    preorderItems,
    setPreorderItems,
    tableConfirmedOrders,
    setTableConfirmedOrders,
    priceDraftByItemId,
    setPriceDraftByItemId,
  };
}
