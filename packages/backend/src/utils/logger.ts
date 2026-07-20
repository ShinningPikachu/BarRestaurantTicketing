export interface Logger {
  info(data: unknown, message?: string): void;
  debug(data: unknown, message?: string): void;
  warn(data: unknown, message?: string): void;
  error(data: unknown, message?: string): void;
}

// Simple logger - can be replaced with pino later
export const logger: Logger = {
  info: (data: unknown, message?: string) => {
    console.log(JSON.stringify({ level: 'INFO', message, data, timestamp: new Date().toISOString() }));
  },
  debug: (data: unknown, message?: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify({ level: 'DEBUG', message, data, timestamp: new Date().toISOString() }));
    }
  },
  warn: (data: unknown, message?: string) => {
    console.warn(JSON.stringify({ level: 'WARN', message, data, timestamp: new Date().toISOString() }));
  },
  error: (data: unknown, message?: string) => {
    console.error(JSON.stringify({ level: 'ERROR', message, data, timestamp: new Date().toISOString() }));
  },
};
