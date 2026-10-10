export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
).replace(/\/$/, '');

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

export function authHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}
