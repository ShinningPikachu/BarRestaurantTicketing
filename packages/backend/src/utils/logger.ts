export interface Logger {
  info(data: any, message?: string): void;
  debug(data: any, message?: string): void;
  warn(data: any, message?: string): void;
  error(data: any, message?: string): void;
}

// Simple logger - can be replaced with pino later
export const logger: Logger = {
  info: (data: any, message?: string) => {
    console.log(JSON.stringify({ level: 'INFO', message, data, timestamp: new Date().toISOString() }));
  },
  debug: (data: any, message?: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify({ level: 'DEBUG', message, data, timestamp: new Date().toISOString() }));
    }
  },
  warn: (data: any, message?: string) => {
    console.warn(JSON.stringify({ level: 'WARN', message, data, timestamp: new Date().toISOString() }));
  },
  error: (data: any, message?: string) => {
    console.error(JSON.stringify({ level: 'ERROR', message, data, timestamp: new Date().toISOString() }));
  },
};
