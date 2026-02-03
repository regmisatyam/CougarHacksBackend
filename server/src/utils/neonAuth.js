import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';

function normalizeAuthBase(url) {
  const trimmed = String(url || '').replace(/\/+$/, '');
  if (trimmed.endsWith('/api/auth') || trimmed.endsWith('/neondb/auth')) return trimmed;
  return `${trimmed}/api/auth`;
}

const authBase = normalizeAuthBase(env.neonAuthUrl);
const jwksUrl = new URL(`${authBase}/.well-known/jwks.json`);
const jwks = createRemoteJWKSet(jwksUrl);

export async function verifyNeonJwt(token) {
  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ['RS256', 'ES256'],
  });
  return payload;
}

export async function getNeonSession(token) {
  const attempts = [
    { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    { Cookie: `__Secure-neon-auth.session_token=${token}`, Accept: 'application/json' },
    { Cookie: `better-auth.session_token=${token}`, Accept: 'application/json' },
    { Cookie: `neon-auth.session_token=${token}`, Accept: 'application/json' },
  ];

  for (const headers of attempts) {
    const response = await fetch(`${authBase}/get-session`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) continue;

    try {
      const body = await response.json();
      if (body?.user && body?.session) return body;
    } catch {
      // Continue with the next attempt.
    }
  }

  return null;
}

export async function getNeonSessionByVerifier(verifier) {
  if (!verifier) return null;
  const url = `${authBase}/get-session?neon_auth_session_verifier=${encodeURIComponent(String(verifier))}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  try {
    const body = await response.json();
    if (body?.user && body?.session) return body;
  } catch {
    return null;
  }
  return null;
}
