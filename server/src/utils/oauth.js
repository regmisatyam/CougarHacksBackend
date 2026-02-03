import crypto from 'node:crypto';
import { env } from '../config/env.js';

export function oauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: 1000 * 60 * 10,
    path: '/',
  };
}

export function randomState() {
  return crypto.randomBytes(24).toString('hex');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
