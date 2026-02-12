const DEBUG_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEBUG_LOGS === 'true';

export const logger = {
  debug: (...args: unknown[]) => {
    if (DEBUG_ENABLED) {
      console.debug(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (DEBUG_ENABLED) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};


