import { clearSessionToken, readSessionToken } from '../lib/neonAuth';
const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export async function api(path, options = {}) {
  const sessionToken = readSessionToken() || null;

  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    if (response.status === 401) {
      clearSessionToken();
      sessionStorage.removeItem('local_session_hint');
    }
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export function backendUrl(path = '') {
  return `${BASE_URL}${path}`;
}
