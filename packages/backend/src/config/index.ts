export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  logLevel: process.env.LOG_LEVEL || 'info',
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
} as const;
