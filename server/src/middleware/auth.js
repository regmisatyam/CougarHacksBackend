import { sql } from '../db.js';
import { getNeonSession, verifyNeonJwt } from '../utils/neonAuth.js';

function splitName(fullName) {
  const raw = String(fullName || '').trim();
  if (!raw) return { firstName: null, lastName: null };
  const parts = raw.split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

async function ensureLocalUserFromNeon(payload, token) {
  const tokenEmail = payload?.email ? String(payload.email).toLowerCase() : null;

  let session = await getNeonSession(token);
  const sessionSubject = session?.user?.id ? String(session.user.id) : null;
  const subject = payload?.sub ? String(payload.sub) : sessionSubject;
  let sessionEmail = session?.user?.email ? String(session.user.email).toLowerCase() : null;
  const profileName = session?.user?.name || payload?.name || '';
  const { firstName, lastName } = splitName(profileName);

  const email = sessionEmail || tokenEmail;

  if (!subject && !email) {
    return null;
  }

  let localRows = [];

  if (subject) {
    localRows = await sql`
      SELECT id, email, role, status, blocked_reason, auth_subject
      FROM users
      WHERE auth_subject = ${subject}
      LIMIT 1
    `;
  }

  if (!localRows[0] && email) {
    localRows = await sql`
      SELECT id, email, role, status, blocked_reason, auth_subject
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;
  }

  let localUser = localRows[0];

  if (!localUser && email) {
    const created = await sql`
      INSERT INTO users (email, password_hash, role, status, auth_subject)
      VALUES (${email}, NULL, 'participant', 'active', ${subject})
      RETURNING id, email, role, status, blocked_reason, auth_subject
    `;
    localUser = created[0];
  } else if (localUser && subject && !localUser.auth_subject) {
    const updated = await sql`
      UPDATE users
      SET auth_subject = ${subject}, updated_at = NOW()
      WHERE id = ${localUser.id}
      RETURNING id, email, role, status, blocked_reason, auth_subject
    `;
    localUser = updated[0];
  }

  if (localUser) {
    await sql`
      INSERT INTO user_profiles (user_id, first_name, last_name)
      VALUES (${localUser.id}, ${firstName}, ${lastName})
      ON CONFLICT (user_id) DO UPDATE SET
        first_name = COALESCE(user_profiles.first_name, EXCLUDED.first_name),
        last_name = COALESCE(user_profiles.last_name, EXCLUDED.last_name),
        updated_at = NOW()
    `;
  }

  return localUser || null;
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (bearerToken) {
      try {
        let payload = null;
        try {
          payload = await verifyNeonJwt(bearerToken);
        } catch {
          payload = null;
        }

        const localUser = await ensureLocalUserFromNeon(payload, bearerToken);
        if (localUser) {
          if (localUser.status === 'blocked') {
            return res.status(403).json({ error: 'Account blocked', reason: localUser.blocked_reason || null });
          }

          req.user = {
            id: localUser.id,
            email: localUser.email,
            role: localUser.role,
            status: localUser.status,
          };

          return next();
        }
      } catch {
        // Fall through to local cookie session auth if bearer validation fails.
      }
    }

    const token = req.cookies.session_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const rows = await sql`
      SELECT s.id as session_id, s.expires_at, u.id, u.email, u.role, u.status, u.blocked_reason
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_token = ${token}
      LIMIT 1
    `;

    const session = rows[0];
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    if (new Date(session.expires_at) <= new Date()) {
      await sql`DELETE FROM sessions WHERE id = ${session.session_id}`;
      return res.status(401).json({ error: 'Session expired' });
    }

    if (session.status === 'blocked') {
      return res.status(403).json({ error: 'Account blocked', reason: session.blocked_reason || null });
    }

    req.user = {
      id: session.id,
      email: session.email,
      role: session.role,
      status: session.status,
    };

    req.sessionToken = token;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!['admin', 'organizer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}
