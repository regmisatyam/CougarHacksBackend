import crypto from 'node:crypto';
import { Google, GitHub } from 'arctic';
import { env } from '../config/env.js';

// Initialize OAuth providers
export const google = env.googleClientId && env.googleClientSecret
  ? new Google(
      env.googleClientId,
      env.googleClientSecret,
      `${env.backendUrl}/auth/google/callback`
    )
  : null;

export const github = env.githubClientId && env.githubClientSecret
  ? new GitHub(
      env.githubClientId,
      env.githubClientSecret,
      `${env.backendUrl}/auth/github/callback`
    )
  : null;

export function oauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: 1000 * 60 * 10,
    path: '/',
  };
}

export function clearOauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
  };
}

export function randomState() {
  return crypto.randomBytes(24).toString('hex');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
