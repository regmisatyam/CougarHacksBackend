import { createAuthClient } from '@neondatabase/auth';

function normalizeAuthUrl(raw) {
  const trimmed = String(raw || '').replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/api/auth') || trimmed.endsWith('/neondb/auth')) return trimmed;
  return `${trimmed}/api/auth`;
}

const neonAuthUrl = normalizeAuthUrl(import.meta.env.VITE_NEON_AUTH_URL);

if (!neonAuthUrl) {
  throw new Error('Missing VITE_NEON_AUTH_URL in client/.env');
}

export const neonAuth = createAuthClient(neonAuthUrl);

export function extractSessionToken(resultOrSession) {
  if (!resultOrSession) return null;
  const data = resultOrSession.data || resultOrSession;
  return (
    data?.session?.token ||
    data?.session?.sessionToken ||
    data?.session?.session_token ||
    data?.token?.token ||
    data?.token ||
    data?.sessionToken ||
    null
  );
}

export function storeSessionToken(token) {
  if (!token) return;
  sessionStorage.setItem('neon_session_token', token);
}

export function readSessionToken() {
  return sessionStorage.getItem('neon_session_token');
}

export function clearSessionToken() {
  sessionStorage.removeItem('neon_session_token');
}
