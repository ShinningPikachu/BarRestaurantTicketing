export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let justClosedQuote = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      if (inQuotes) {
        inQuotes = false;
        justClosedQuote = true;
      } else if (field.trim().length === 0) {
        inQuotes = true;
        justClosedQuote = false;
      } else {
        throw new CsvParseError(`Unexpected quote at character ${index + 1}`);
      }
      continue;
    }
    if (justClosedQuote && char !== ',' && char !== '\n' && char !== '\r') {
      if (/\s/.test(char)) continue;
      throw new CsvParseError(`Unexpected character after closing quote at character ${index + 1}`);
    }
    if (char === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
      justClosedQuote = false;
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(field.trim());
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
      justClosedQuote = false;
      continue;
    }
    field += char;
  }

  if (inQuotes) {
    throw new CsvParseError('CSV contains an unterminated quoted field');
  }

  row.push(field.trim());
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

export function parseCsvObjects(content: string): Array<Record<string, string>> {
  const [headers, ...rows] = parseCsv(content);
  if (!headers || headers.length === 0) {
    return [];
  }

  const normalizedHeaders = headers.map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim());
  if (normalizedHeaders.some((header) => header.length === 0)) {
    throw new CsvParseError('CSV headers cannot be empty');
  }
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new CsvParseError('CSV headers must be unique');
  }

  return rows.map((row, rowIndex) => {
    if (row.length !== normalizedHeaders.length) {
      throw new CsvParseError(`CSV row ${rowIndex + 2} has ${row.length} columns; expected ${normalizedHeaders.length}`);
    }
    const record: Record<string, string> = {};
    normalizedHeaders.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return record;
  });
}
