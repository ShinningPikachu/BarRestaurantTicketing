import { z } from 'zod';
import { parseCsvObjects } from '../utils/csv.js';

const MAX_CENTS = 2_000_000_000;
const MAX_IMAGE_BYTES = 1_000_000;
const MAX_IMPORT_ROWS = 5_000;
const DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const ALLOWED_COLUMNS = new Set([
  'name',
  'primaryName',
  'secondaryName',
  'priceCents',
  'price',
  'costCents',
  'cost',
  'category',
  'sku',
  'description',
  'imageDataUrl',
  'available',
]);

function hasExpectedSignature(mime: string, bytes: Buffer): boolean {
  if (mime === 'jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}

export const imageDataUrlSchema = z.string().trim().max(1_400_000).superRefine((value, context) => {
  const match = DATA_URL_PATTERN.exec(value);
  if (!match) {
    context.addIssue({ code: 'custom', message: 'Image must be a base64 JPEG, PNG, or WebP data URL' });
    return;
  }
  if (match[2].length % 4 !== 0) {
    context.addIssue({ code: 'custom', message: 'Image contains invalid base64 data' });
    return;
  }
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    context.addIssue({ code: 'custom', message: `Decoded image must not exceed ${MAX_IMAGE_BYTES} bytes` });
    return;
  }
  if (bytes.toString('base64') !== match[2]) {
    context.addIssue({ code: 'custom', message: 'Image contains invalid base64 data' });
    return;
  }
  if (!hasExpectedSignature(match[1], bytes)) {
    context.addIssue({ code: 'custom', message: 'Image content does not match its MIME type' });
  }
});

export interface MenuImportItem {
  name: string;
  primaryName?: string | null;
  secondaryName?: string | null;
  priceCents: number;
  costCents?: number | null;
  category: string;
  sku?: string | null;
  description?: string | null;
  imageDataUrl?: string | null;
  available?: boolean;
}

export class MenuImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MenuImportValidationError';
  }
}

function parseBoolean(value: string | undefined, rowNumber: number): boolean | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'si', 'sí'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  throw new MenuImportValidationError(`Invalid CSV row ${rowNumber}: available must be true or false`);
}

function parseCents(
  record: Record<string, string>,
  centsKey: string,
  euroKey: string,
  rowNumber: number,
  required: boolean
): number | null {
  const centsValue = record[centsKey]?.trim();
  const euroValue = record[euroKey]?.trim();
  if (!centsValue && !euroValue) {
    if (required) throw new MenuImportValidationError(`Invalid CSV row ${rowNumber}: ${centsKey} or ${euroKey} is required`);
    return null;
  }
  if (centsValue && euroValue) {
    throw new MenuImportValidationError(
      `Invalid CSV row ${rowNumber}: provide either ${centsKey} or ${euroKey}, not both`
    );
  }

  const parsed = centsValue ? Number(centsValue) : Number(euroValue.replace(',', '.')) * 100;
  const rounded = centsValue ? parsed : Math.round(parsed);
  if (!Number.isSafeInteger(rounded) || rounded < 0 || rounded > MAX_CENTS) {
    throw new MenuImportValidationError(`Invalid CSV row ${rowNumber}: ${centsKey || euroKey} is invalid`);
  }
  return rounded;
}

export function parseMenuImportCsv(csv: string): MenuImportItem[] {
  const records = parseCsvObjects(csv);
  if (records.length === 0) {
    throw new MenuImportValidationError('CSV must contain at least one data row');
  }
  if (records.length > MAX_IMPORT_ROWS) {
    throw new MenuImportValidationError(`CSV must not contain more than ${MAX_IMPORT_ROWS} data rows`);
  }

  const unknownColumn = Object.keys(records[0]).find((column) => !ALLOWED_COLUMNS.has(column));
  if (unknownColumn) {
    throw new MenuImportValidationError(`CSV contains an unsupported column: ${unknownColumn}`);
  }

  const items = records.map((record, index) => {
    const rowNumber = index + 2;
    const name = record.name?.trim();
    const category = record.category?.trim();
    if (!name || name.length > 200 || !category || category.length > 100) {
      throw new MenuImportValidationError(`Invalid CSV row ${rowNumber}: name and category are required and bounded`);
    }

    const imageDataUrl = record.imageDataUrl?.trim() || null;
    if (imageDataUrl) {
      const parsedImage = imageDataUrlSchema.safeParse(imageDataUrl);
      if (!parsedImage.success) {
        throw new MenuImportValidationError(`Invalid CSV row ${rowNumber}: ${parsedImage.error.issues[0]?.message ?? 'invalid image'}`);
      }
    }

    const boundedOptional = (key: string, max: number): string | null => {
      const value = record[key]?.trim() || null;
      if (value && value.length > max) throw new MenuImportValidationError(`Invalid CSV row ${rowNumber}: ${key} is too long`);
      return value;
    };

    return {
      name,
      primaryName: boundedOptional('primaryName', 200),
      secondaryName: boundedOptional('secondaryName', 200),
      category,
      priceCents: parseCents(record, 'priceCents', 'price', rowNumber, true)!,
      costCents: parseCents(record, 'costCents', 'cost', rowNumber, false),
      sku: boundedOptional('sku', 100),
      description: boundedOptional('description', 2_000),
      imageDataUrl,
      available: parseBoolean(record.available, rowNumber),
    };
  });

  const seenKeys = new Set<string>();
  for (const [index, item] of items.entries()) {
    const key = item.sku
      ? `sku:${item.sku.toLowerCase()}`
      : `name:${item.name.toLowerCase()}\u0000${item.category.toLowerCase()}`;
    if (seenKeys.has(key)) {
      throw new MenuImportValidationError(`Invalid CSV row ${index + 2}: duplicate menu item in the same import`);
    }
    seenKeys.add(key);
  }

  return items;
}
