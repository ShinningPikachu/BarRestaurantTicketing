export interface Logger {
  info(data: any, message?: string): void;
  debug(data: any, message?: string): void;
  warn(data: any, message?: string): void;
  error(data: any, message?: string): void;
}

// Simple logger for React Native
export const logger: Logger = {
  info: (data: any, message?: string) => {
    if (__DEV__) {
      console.log(`[INFO] ${message || ''}`, data);
    }
  },
  debug: (data: any, message?: string) => {
    if (__DEV__) {
      console.log(`[DEBUG] ${message || ''}`, data);
    }
  },
  warn: (data: any, message?: string) => {
    console.warn(`[WARN] ${message || ''}`, data);
  },
  error: (data: any, message?: string) => {
    console.error(`[ERROR] ${message || ''}`, data);
  },
};
