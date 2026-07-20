import assert from 'node:assert/strict';
import test from 'node:test';
import { MenuImportValidationError, parseMenuImportCsv } from '../src/services/menu-import.ts';
import { CsvParseError } from '../src/utils/csv.ts';

test('menu CSV rejects malformed, empty, ambiguous, and weakly typed input', () => {
  assert.throws(
    () => parseMenuImportCsv('name,priceCents,category\n"unterminated,100,Food'),
    CsvParseError
  );
  assert.throws(
    () => parseMenuImportCsv('name,priceCents,category\n'),
    MenuImportValidationError
  );
  assert.throws(
    () => parseMenuImportCsv('name,priceCents,price,category\nSoup,500,5.00,Food'),
    /provide either priceCents or price/
  );
  assert.throws(
    () => parseMenuImportCsv('name,priceCents,category,available\nSoup,500,Food,probably'),
    /available must be true or false/
  );
  assert.throws(
    () => parseMenuImportCsv('name,priceCents,category\n"Soup"trailing,500,Food'),
    CsvParseError
  );
  assert.throws(
    () => parseMenuImportCsv('name,priceCents,category,typo\nSoup,500,Food,value'),
    /unsupported column/
  );
  assert.throws(
    () => parseMenuImportCsv('name,priceCents,category,sku\nSoup,500,Food,A1\nOther,600,Food,a1'),
    /duplicate menu item/
  );
  const excessiveRows = Array.from({ length: 5_001 }, (_, index) => `Item ${index},100,Food`).join('\n');
  assert.throws(
    () => parseMenuImportCsv(`name,priceCents,category\n${excessiveRows}`),
    /must not contain more than 5000/
  );
});

test('menu CSV only accepts canonical raster data URLs and retains valid images', () => {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const imageDataUrl = `data:image/png;base64,${pngSignature.toString('base64')}`;
  const [item] = parseMenuImportCsv(
    `name,priceCents,category,imageDataUrl,available\nSoup,500,Food,"${imageDataUrl}",false`
  );

  assert.equal(item.imageDataUrl, imageDataUrl);
  assert.equal(item.available, false);
  assert.throws(
    () => parseMenuImportCsv('name,priceCents,category,imageDataUrl\nSoup,500,Food,"data:image/svg+xml;base64,PHN2Zz4="'),
    /base64 JPEG, PNG, or WebP/
  );
  assert.throws(
    () => parseMenuImportCsv('name,priceCents,category,imageDataUrl\nSoup,500,Food,"data:image/png;base64,iVBORw0KGgo"'),
    /invalid base64/
  );
});
