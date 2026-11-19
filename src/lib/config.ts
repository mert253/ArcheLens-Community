/** Same-origin API in production; Vite proxies this path in development. */
export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
