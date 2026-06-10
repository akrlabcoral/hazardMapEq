const DEBUG_LOGS = import.meta.env.VITE_DEBUG_LOGS === 'true';

export function debugLog(...args) {
  if (DEBUG_LOGS) {
    console.log(...args);
  }
}
