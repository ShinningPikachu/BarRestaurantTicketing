export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
  xprinter: {
    host: process.env.XPRINTER_HOST || '',
    port: parseInt(process.env.XPRINTER_PORT || '9100', 10),
    printerName: process.env.XPRINTER_PRINTER_NAME || '',
    usbDevice: process.env.XPRINTER_USB_DEVICE || '',
    openDrawer: process.env.XPRINTER_OPEN_DRAWER === 'true',
  },
  auth: {
    accessCode: process.env.POS_ACCESS_CODE || '1234',
    sessionToken: process.env.POS_AUTH_TOKEN || `pos-token-${process.env.POS_ACCESS_CODE || '1234'}`,
  },
  ticket: {
    businessName: process.env.TICKET_BUSINESS_NAME
      || process.env.EXPO_PUBLIC_TICKET_BUSINESS_NAME
      || process.env.EXPO_PUBLIC_TICKET_ISSUER_NAME
      || 'YUYE CHEN',
    tradeName: process.env.TICKET_TRADE_NAME
      || process.env.EXPO_PUBLIC_TICKET_TRADE_NAME
      || 'Star Bar',
    businessTaxId: process.env.TICKET_BUSINESS_NIF
      || process.env.EXPO_PUBLIC_TICKET_BUSINESS_NIF
      || process.env.EXPO_PUBLIC_TICKET_ISSUER_NIF
      || 'X5126994-H',
    businessAddress: process.env.TICKET_BUSINESS_ADDRESS
      || process.env.EXPO_PUBLIC_TICKET_BUSINESS_ADDRESS
      || process.env.EXPO_PUBLIC_TICKET_ISSUER_ADDRESS
      || 'Gran Via de les Corts Catalanes 669. Bis',
    businessCity: process.env.TICKET_BUSINESS_CITY
      || process.env.EXPO_PUBLIC_TICKET_BUSINESS_CITY
      || '08013 Barcelona',
    businessPhone: process.env.TICKET_BUSINESS_PHONE
      || process.env.EXPO_PUBLIC_TICKET_BUSINESS_PHONE
      || '672295395',
    terminalId: process.env.POS_TERMINAL_ID || process.env.EXPO_PUBLIC_POS_TERMINAL_ID || 'TPV-1',
    cashierName: process.env.POS_CASHIER_NAME || process.env.EXPO_PUBLIC_POS_CASHIER_NAME || '',
    vatRatePercent: Number.isFinite(Number(process.env.TICKET_VAT_RATE || process.env.EXPO_PUBLIC_TICKET_VAT_RATE))
      ? Number(process.env.TICKET_VAT_RATE || process.env.EXPO_PUBLIC_TICKET_VAT_RATE)
      : 10,
  },
} as const;
