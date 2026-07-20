export interface Logger {
  info(data: unknown, message?: string): void;
  debug(data: unknown, message?: string): void;
  warn(data: unknown, message?: string): void;
  error(data: unknown, message?: string): void;
}

// Simple logger for React Native
export const logger: Logger = {
  info: (data: unknown, message?: string) => {
    if (__DEV__) {
      console.log(`[INFO] ${message || ''}`, data);
    }
  },
  debug: (data: unknown, message?: string) => {
    if (__DEV__) {
      console.log(`[DEBUG] ${message || ''}`, data);
    }
  },
  warn: (data: unknown, message?: string) => {
    console.warn(`[WARN] ${message || ''}`, data);
  },
  error: (data: unknown, message?: string) => {
    console.error(`[ERROR] ${message || ''}`, data);
  },
};
