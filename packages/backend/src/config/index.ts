const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const insecureProductionValues = new Set([
  '1234',
  'changethiscode',
  'changethislongrandomtoken',
  'replacewithatleast32randomcharacters',
  'your bar name',
  'your legal business name',
  'your tax id',
  'your business address',
]);

function rejectInsecureProductionValue(name: string, value: string): void {
  if (isProduction && insecureProductionValues.has(value.trim().toLowerCase())) {
    throw new Error(`${name} still contains an example/insecure value and must be configured for production`);
  }
}

function boundedInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw.trim() === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function requiredCredential(name: 'POS_ACCESS_CODE' | 'POS_AUTH_TOKEN', testValue: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (isTest) return testValue;
  throw new Error(`${name} must be configured before starting the backend`);
}

function ticketIdentity(name: string, value: string | undefined, developmentFallback: string): string {
  const normalized = value?.trim();
  if (normalized) return normalized;
  if (isProduction) {
    throw new Error(`${name} must be configured in production`);
  }
  return developmentFallback;
}

function ticketVatRate(): number {
  const raw = process.env.TICKET_VAT_RATE || process.env.EXPO_PUBLIC_TICKET_VAT_RATE;
  if (raw === undefined || raw.trim() === '') return 10;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error('TICKET_VAT_RATE must be an integer between 0 and 100');
  }
  return value;
}

const accessCode = requiredCredential('POS_ACCESS_CODE', 'test-access-code');
const sessionToken = requiredCredential(
  'POS_AUTH_TOKEN',
  'test-session-token-that-is-long-enough-for-authentication'
);

if (accessCode.length < 4 || accessCode.length > 128) {
  throw new Error('POS_ACCESS_CODE must contain between 4 and 128 characters');
}
if (sessionToken.length < 32 || sessionToken.length > 512) {
  throw new Error('POS_AUTH_TOKEN must contain between 32 and 512 characters');
}
rejectInsecureProductionValue('POS_ACCESS_CODE', accessCode);
rejectInsecureProductionValue('POS_AUTH_TOKEN', sessionToken);

const businessName = ticketIdentity(
  'TICKET_BUSINESS_NAME',
  process.env.TICKET_BUSINESS_NAME || process.env.EXPO_PUBLIC_TICKET_BUSINESS_NAME || process.env.EXPO_PUBLIC_TICKET_ISSUER_NAME,
  'Restaurant Legal Name'
);
const tradeName = ticketIdentity(
  'TICKET_TRADE_NAME',
  process.env.TICKET_TRADE_NAME || process.env.EXPO_PUBLIC_TICKET_TRADE_NAME,
  'Restaurant'
);
const businessTaxId = ticketIdentity(
  'TICKET_BUSINESS_NIF',
  process.env.TICKET_BUSINESS_NIF || process.env.EXPO_PUBLIC_TICKET_BUSINESS_NIF || process.env.EXPO_PUBLIC_TICKET_ISSUER_NIF,
  'TAX-ID-NOT-CONFIGURED'
);
const businessAddress = ticketIdentity(
  'TICKET_BUSINESS_ADDRESS',
  process.env.TICKET_BUSINESS_ADDRESS || process.env.EXPO_PUBLIC_TICKET_BUSINESS_ADDRESS || process.env.EXPO_PUBLIC_TICKET_ISSUER_ADDRESS,
  'Address not configured'
);
rejectInsecureProductionValue('TICKET_BUSINESS_NAME', businessName);
rejectInsecureProductionValue('TICKET_TRADE_NAME', tradeName);
rejectInsecureProductionValue('TICKET_BUSINESS_NIF', businessTaxId);
rejectInsecureProductionValue('TICKET_BUSINESS_ADDRESS', businessAddress);

export const config = {
  port: boundedInteger('PORT', 3000, 1, 65_535),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv,
  isDev: !isProduction,
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  xprinter: {
    host: process.env.XPRINTER_HOST || '',
    port: boundedInteger('XPRINTER_PORT', 9100, 1, 65_535),
    printerName: process.env.XPRINTER_PRINTER_NAME || '',
    // Preserve the historical raw CUPS behavior unless an administrator
    // explicitly opts into driver-formatted text output.
    systemPrinterRaw: process.env.XPRINTER_SYSTEM_PRINTER_RAW !== 'false',
    usbDevice: process.env.XPRINTER_USB_DEVICE || '',
    timeoutMs: boundedInteger('XPRINTER_TIMEOUT_MS', 10_000, 1_000, 60_000),
  },
  auth: {
    accessCode,
    sessionToken,
  },
  ticket: {
    businessName,
    tradeName,
    businessTaxId,
    businessAddress,
    businessCity: process.env.TICKET_BUSINESS_CITY || process.env.EXPO_PUBLIC_TICKET_BUSINESS_CITY || '',
    businessPhone: process.env.TICKET_BUSINESS_PHONE || process.env.EXPO_PUBLIC_TICKET_BUSINESS_PHONE || '',
    terminalId: process.env.POS_TERMINAL_ID || process.env.EXPO_PUBLIC_POS_TERMINAL_ID || 'TPV-1',
    cashierName: process.env.POS_CASHIER_NAME || process.env.EXPO_PUBLIC_POS_CASHIER_NAME || '',
    vatRatePercent: ticketVatRate(),
  },
} as const;
