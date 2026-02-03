import express from 'express';
import { sql } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const adminRouter = express.Router();

adminRouter.use(requireAuth, requireAdmin);

async function createAudit({ actorUserId, targetUserId = null, hackathonId = null, action, details = {} }) {
  await sql`
    INSERT INTO audit_logs (actor_user_id, target_user_id, hackathon_id, action, details)
    VALUES (${actorUserId}, ${targetUserId}, ${hackathonId}, ${action}, ${JSON.stringify(details)}::jsonb)
  `;
}

adminRouter.get('/registrations', async (req, res, next) => {
  try {
    const { hackathonId, status = 'pending' } = req.query;
    if (!hackathonId) return res.status(400).json({ error: 'hackathonId query param is required' });

    const rows = await sql`
      SELECT r.*, u.email, p.first_name, p.last_name
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE r.hackathon_id = ${hackathonId}
        AND r.status = ${status}
      ORDER BY r.applied_at ASC
    `;

    return res.json({ registrations: rows });
  } catch (err) {
    return next(err);
  }
});

adminRouter.post('/registrations/decision', async (req, res, next) => {
  try {
    const { registrationId, decision, reason = null } = req.body || {};
    const allowed = ['accepted', 'rejected', 'waitlisted'];

    if (!registrationId || !allowed.includes(decision)) {
      return res.status(400).json({ error: 'registrationId and decision are required' });
    }

    const rows = await sql`
      UPDATE registrations
      SET status = ${decision},
          reviewed_by = ${req.user.id},
          reviewed_at = NOW(),
          decision_reason = ${reason}
      WHERE id = ${registrationId}
      RETURNING *
    `;

    const registration = rows[0];
    if (!registration) return res.status(404).json({ error: 'Registration not found' });

    await createAudit({
      actorUserId: req.user.id,
      targetUserId: registration.user_id,
      hackathonId: registration.hackathon_id,
      action: 'registration.decision',
      details: { decision, reason },
    });

    return res.json({ registration });
  } catch (err) {
    return next(err);
  }
});

adminRouter.post('/users/block', async (req, res, next) => {
  try {
    const { userId, reason } = req.body || {};
    if (!userId || !reason) return res.status(400).json({ error: 'userId and reason are required' });

    const rows = await sql`
      UPDATE users
      SET status = 'blocked',
          blocked_reason = ${reason},
          blocked_at = NOW(),
          blocked_by = ${req.user.id},
          updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, email, status, blocked_reason
    `;

    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    await sql`DELETE FROM sessions WHERE user_id = ${userId}`;

    await createAudit({
      actorUserId: req.user.id,
      targetUserId: userId,
      action: 'user.block',
      details: { reason },
    });

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

adminRouter.post('/users/unblock', async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const rows = await sql`
      UPDATE users
      SET status = 'active',
          blocked_reason = NULL,
          blocked_at = NULL,
          blocked_by = NULL,
          updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, email, status
    `;

    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    await createAudit({
      actorUserId: req.user.id,
      targetUserId: userId,
      action: 'user.unblock',
    });

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

adminRouter.get('/users', async (req, res, next) => {
  try {
    const status = req.query.status || 'active';
    if (!['active', 'blocked', 'deleted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }

    const rows = await sql`
      SELECT u.id, u.email, u.role, u.status, u.blocked_reason, u.blocked_at,
             p.first_name, p.last_name
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.status = ${status}
      ORDER BY u.created_at DESC
    `;

    return res.json({ users: rows });
  } catch (err) {
    return next(err);
  }
});

adminRouter.post('/notes', async (req, res, next) => {
  try {
    const { userId = null, hackathonId = null, note } = req.body || {};
    if (!note) return res.status(400).json({ error: 'note is required' });

    const rows = await sql`
      INSERT INTO admin_notes (hackathon_id, user_id, note, created_by)
      VALUES (${hackathonId}, ${userId}, ${note}, ${req.user.id})
      RETURNING *
    `;

    const created = rows[0];

    await createAudit({
      actorUserId: req.user.id,
      targetUserId: userId,
      hackathonId,
      action: 'admin.note.create',
      details: { note },
    });

    return res.status(201).json({ note: created });
  } catch (err) {
    return next(err);
  }
});

adminRouter.get('/audit', async (req, res, next) => {
  try {
    const { targetUserId } = req.query;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId query param is required' });

    const rows = await sql`
      SELECT *
      FROM audit_logs
      WHERE target_user_id = ${targetUserId}
      ORDER BY created_at DESC
      LIMIT 200
    `;

    return res.json({ logs: rows });
  } catch (err) {
    return next(err);
  }
});
