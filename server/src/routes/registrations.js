import express from 'express';
import { sql } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const registrationsRouter = express.Router();

registrationsRouter.post('/apply', requireAuth, async (req, res, next) => {
  try {
    const { hackathonId } = req.body || {};
    if (!hackathonId) return res.status(400).json({ error: 'hackathonId is required' });

    const hackRows = await sql`
      SELECT id, registration_open_at, registration_close_at, is_active
      FROM hackathons
      WHERE id = ${hackathonId}
      LIMIT 1
    `;

    const hackathon = hackRows[0];
    if (!hackathon || !hackathon.is_active) {
      return res.status(404).json({ error: 'Hackathon not found/active' });
    }

    const now = new Date();
    if (now < new Date(hackathon.registration_open_at) || now > new Date(hackathon.registration_close_at)) {
      return res.status(400).json({ error: 'Registration is closed for this hackathon' });
    }

    const rows = await sql`
      INSERT INTO registrations (hackathon_id, user_id, status)
      VALUES (${hackathonId}, ${req.user.id}, 'pending')
      ON CONFLICT (hackathon_id, user_id) DO UPDATE SET status = 'pending', applied_at = NOW()
      RETURNING *
    `;

    return res.status(201).json({ registration: rows[0] });
  } catch (err) {
    return next(err);
  }
});

registrationsRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { hackathonId } = req.query;
    if (!hackathonId) return res.status(400).json({ error: 'hackathonId query param is required' });

    const rows = await sql`
      SELECT *
      FROM registrations
      WHERE hackathon_id = ${hackathonId} AND user_id = ${req.user.id}
      LIMIT 1
    `;

    return res.json({ registration: rows[0] || null });
  } catch (err) {
    return next(err);
  }
});
