export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
).replace(/\/$/, '');

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && window.location.origin) {
    // In production browser, always use current origin so API calls never hit external services
    if (window.location.hostname === 'thirdeye.colladome.com' || !process.env.NEXT_PUBLIC_API_URL) {
      return cleanPath;
    }
  }
  return `${API_BASE}${cleanPath}`;
}

export function authHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== 'undefined' ? (localStorage.getItem('te_token') || localStorage.getItem('token')) : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}
