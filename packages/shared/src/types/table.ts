/**
 * Table management type definitions
 */

export type TableZone = 'outside' | 'floor1' | 'floor2';

export interface Table {
  number: number;
  zone: TableZone;
  id?: number;
  name?: string;
  seats?: number;
}
