import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { sql } from '../db.js';

const SESSION_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export function buildSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
  };
}

export async function createSession(userId) {
  const raw = crypto.randomBytes(48).toString('hex');
  const token = crypto
    .createHmac('sha256', env.sessionSecret)
    .update(raw)
    .digest('hex');

  const expiresAt = new Date(Date.now() + SESSION_AGE_MS);

  await sql`
    INSERT INTO sessions (user_id, session_token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt.toISOString()})
  `;

  return { token, expiresAt };
}

export async function destroySession(token) {
  if (!token) return;
  await sql`DELETE FROM sessions WHERE session_token = ${token}`;
}
