import { TableId } from '../types';

export type SelectedTable = TableId;

export interface ConfirmOrderItem {
  name: string;
  qty: number;
  unitPriceCents: number;
}
