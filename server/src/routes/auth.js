import express from 'express';
import argon2 from 'argon2';
import { env } from '../config/env.js';
import { sql } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { createSession, destroySession, buildSessionCookieOptions } from '../utils/session.js';
import { normalizeEmail } from '../utils/oauth.js';
import { getNeonSessionByVerifier } from '../utils/neonAuth.js';

export const authRouter = express.Router();

function neonAuthBase() {
  const trimmed = String(env.neonAuthUrl || '').replace(/\/+$/, '');
  if (trimmed.endsWith('/api/auth') || trimmed.endsWith('/neondb/auth')) return trimmed;
  return `${trimmed}/api/auth`;
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie('session_token', token, {
    ...buildSessionCookieOptions(),
    expires: expiresAt,
  });
}

function splitName(fullName) {
  const raw = String(fullName || '').trim();
  if (!raw) return { firstName: null, lastName: null };
  const parts = raw.split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

async function upsertLocalUserFromNeon({ email, subject = null, fullName = '' }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const { firstName, lastName } = splitName(fullName);

  const rows = await sql`
    INSERT INTO users (email, password_hash, role, status, auth_subject)
    VALUES (${normalizedEmail}, NULL, 'participant', 'active', ${subject})
    ON CONFLICT (email) DO UPDATE SET
      auth_subject = COALESCE(users.auth_subject, EXCLUDED.auth_subject),
      updated_at = NOW()
    RETURNING id, email, role, status, blocked_reason
  `;
  const user = rows[0] || null;
  if (!user) return null;

  await sql`
    INSERT INTO user_profiles (user_id, first_name, last_name)
    VALUES (${user.id}, ${firstName}, ${lastName})
    ON CONFLICT (user_id) DO UPDATE SET
      first_name = COALESCE(user_profiles.first_name, EXCLUDED.first_name),
      last_name = COALESCE(user_profiles.last_name, EXCLUDED.last_name),
      updated_at = NOW()
  `;

  return user;
}

authRouter.post('/sync-signup', async (req, res, next) => {
  try {
    const { email, firstName = null, lastName = null, password = null } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'email is required' });
    }

    let passwordHash = null;
    if (password && String(password).length >= 8) {
      passwordHash = await argon2.hash(String(password));
    }

    const userRows = await sql`
      INSERT INTO users (email, password_hash, role, status)
      VALUES (${normalizedEmail}, ${passwordHash}, 'participant', 'active')
      ON CONFLICT (email) DO UPDATE SET
        password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash),
        updated_at = NOW()
      RETURNING id, email, role, status
    `;

    const user = userRows[0];

    await sql`
      INSERT INTO user_profiles (user_id, first_name, last_name)
      VALUES (${user.id}, ${firstName}, ${lastName})
      ON CONFLICT (user_id) DO UPDATE SET
        first_name = COALESCE(user_profiles.first_name, EXCLUDED.first_name),
        last_name = COALESCE(user_profiles.last_name, EXCLUDED.last_name),
        updated_at = NOW()
    `;

    return res.json({ user, synced: true });
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/exchange-verifier', async (req, res, next) => {
  try {
    const { verifier } = req.body || {};
    if (!verifier) return res.status(400).json({ error: 'verifier is required' });

    console.log('[AUTH] exchange-verifier start', { hasVerifier: Boolean(verifier) });
    const neonSession = await getNeonSessionByVerifier(verifier);
    console.log('[AUTH] exchange-verifier neon-session', {
      hasUser: Boolean(neonSession?.user?.email),
      email: neonSession?.user?.email || null,
      userId: neonSession?.user?.id || null,
    });
    if (!neonSession?.user?.email) {
      return res.status(401).json({ error: 'Invalid or expired verifier' });
    }

    const localUser = await upsertLocalUserFromNeon({
      email: neonSession.user.email,
      subject: neonSession.user.id || null,
      fullName: neonSession.user.name || '',
    });
    console.log('[AUTH] exchange-verifier local-user', {
      hasLocalUser: Boolean(localUser?.id),
      id: localUser?.id || null,
      status: localUser?.status || null,
    });
    if (!localUser) return res.status(401).json({ error: 'Unable to sync user' });
    if (localUser.status === 'blocked') {
      return res.status(403).json({ error: 'Account blocked', reason: localUser.blocked_reason || null });
    }

    const { token, expiresAt } = await createSession(localUser.id);
    setSessionCookie(res, token, expiresAt);

    const profileRows = await sql`
      SELECT first_name, last_name, university, major, graduation_year, country, city
      FROM user_profiles
      WHERE user_id = ${localUser.id}
      LIMIT 1
    `;
    const p = profileRows[0] || {};
    const profileComplete = Boolean(
      p.first_name &&
      p.last_name &&
      p.university &&
      p.major &&
      p.graduation_year &&
      p.country &&
      p.city
    );

    return res.json({
      user: {
        id: localUser.id,
        email: localUser.email,
        role: localUser.role,
        status: localUser.status,
      },
      profileComplete,
    });
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/sync-oauth', async (req, res, next) => {
  try {
    const { email, name = '', subject = null } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });

    const localUser = await upsertLocalUserFromNeon({
      email,
      subject,
      fullName: name,
    });
    if (!localUser) return res.status(401).json({ error: 'Unable to sync user' });
    if (localUser.status === 'blocked') {
      return res.status(403).json({ error: 'Account blocked', reason: localUser.blocked_reason || null });
    }

    const { token, expiresAt } = await createSession(localUser.id);
    setSessionCookie(res, token, expiresAt);

    const profileRows = await sql`
      SELECT first_name, last_name, university
      FROM user_profiles
      WHERE user_id = ${localUser.id}
      LIMIT 1
    `;
    const p = profileRows[0] || {};
    const profileComplete = Boolean(p.first_name && p.last_name && p.university);

    return res.json({
      user: {
        id: localUser.id,
        email: localUser.email,
        role: localUser.role,
        status: localUser.status,
      },
      profileComplete,
    });
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'email, password, firstName, lastName are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail} LIMIT 1`;
    if (existing[0]) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await argon2.hash(password);

    const rows = await sql`
      INSERT INTO users (email, password_hash, role, status)
      VALUES (${normalizedEmail}, ${passwordHash}, 'participant', 'active')
      RETURNING id, email, role, status
    `;

    const user = rows[0];

    await sql`
      INSERT INTO user_profiles (user_id, first_name, last_name)
      VALUES (${user.id}, ${firstName}, ${lastName})
    `;

    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(res, token, expiresAt);

    return res.status(201).json({ user });
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const rows = await sql`
      SELECT id, email, password_hash, role, status, blocked_reason
      FROM users
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;

    let user = rows[0] || null;
    let localPasswordOk = false;

    if (user?.password_hash) {
      localPasswordOk = await argon2.verify(user.password_hash, password);
    }

    // Fallback for Neon-auth-created users that don't yet have local password_hash
    // (or have stale local hashes): validate credentials against Neon Auth and sync local row.
    if (!user || !localPasswordOk) {
      const neonResp = await fetch(`${neonAuthBase()}/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      if (!neonResp.ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const neonData = await neonResp.json();
      const neonUser = neonData?.user || null;
      const hashed = await argon2.hash(password);
      const syncedRows = await sql`
        INSERT INTO users (email, password_hash, role, status, auth_subject)
        VALUES (${normalizedEmail}, ${hashed}, 'participant', 'active', ${neonUser?.id || null})
        ON CONFLICT (email) DO UPDATE SET
          password_hash = ${hashed},
          auth_subject = COALESCE(users.auth_subject, ${neonUser?.id || null}),
          updated_at = NOW()
        RETURNING id, email, role, status, blocked_reason
      `;
      user = syncedRows[0];

      const { firstName, lastName } = splitName(neonUser?.name || '');
      await sql`
        INSERT INTO user_profiles (user_id, first_name, last_name)
        VALUES (${user.id}, ${firstName}, ${lastName})
        ON CONFLICT (user_id) DO UPDATE SET
          first_name = COALESCE(user_profiles.first_name, EXCLUDED.first_name),
          last_name = COALESCE(user_profiles.last_name, EXCLUDED.last_name),
          updated_at = NOW()
      `;
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Account blocked', reason: user.blocked_reason || null });
    }

    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(res, token, expiresAt);

    return res.json({ user: { id: user.id, email: user.email, role: user.role, status: user.status } });
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await destroySession(req.sessionToken);
    res.clearCookie('session_token', { ...buildSessionCookieOptions() });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT u.id, u.email, u.role, u.status, u.blocked_reason,
             p.first_name, p.last_name, p.phone, p.dob, p.gender,
             p.university, p.major, p.graduation_year, p.country, p.city,
             p.dietary_restrictions, p.github_url, p.linkedin_url, p.portfolio_url,
             p.active_hackathon_id
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = ${req.user.id}
      LIMIT 1
    `;
    const user = rows[0] || null;
    const profileComplete = Boolean(
      user?.first_name &&
      user?.last_name &&
      user?.phone &&
      user?.dob &&
      user?.gender &&
      user?.university &&
      user?.major &&
      user?.graduation_year &&
      user?.country &&
      user?.city &&
      user?.dietary_restrictions &&
      user?.github_url &&
      user?.linkedin_url &&
      user?.portfolio_url
    );
    return res.json({ user, profileComplete });
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/set-password', requireAuth, async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const rows = await sql`SELECT password_hash FROM users WHERE id = ${req.user.id} LIMIT 1`;
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    if (rows[0].password_hash) {
      return res.status(400).json({ error: 'Password already set' });
    }

    const passwordHash = await argon2.hash(password);
    await sql`UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW() WHERE id = ${req.user.id}`;

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

authRouter.get('/google/start', (req, res) => {
  const url = new URL(`${neonAuthBase()}/sign-in/social`);
  url.searchParams.set('provider', 'google');
  url.searchParams.set('callbackURL', `${env.frontendUrl}/dashboard`);
  return res.redirect(url.toString());
});

authRouter.get('/google/callback', async (req, res, next) => {
  return res.redirect(`${env.frontendUrl}/dashboard`);
});

authRouter.get('/github/start', (req, res) => {
  const url = new URL(`${neonAuthBase()}/sign-in/social`);
  url.searchParams.set('provider', 'github');
  url.searchParams.set('callbackURL', `${env.frontendUrl}/dashboard`);
  return res.redirect(url.toString());
});

authRouter.get('/github/callback', async (req, res, next) => {
  return res.redirect(`${env.frontendUrl}/dashboard`);
});
