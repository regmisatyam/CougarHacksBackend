import express from 'express';
import { sql } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const hackathonsRouter = express.Router();

hackathonsRouter.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const {
      name,
      startAt,
      endAt,
      registrationOpenAt,
      registrationCloseAt,
      minTeamSize = 1,
      maxTeamSize = 4,
      isActive = true,
    } = req.body || {};

    if (!name || !startAt || !endAt || !registrationOpenAt || !registrationCloseAt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const rows = await sql`
      INSERT INTO hackathons (
        name, start_at, end_at, registration_open_at, registration_close_at, min_team_size, max_team_size, is_active
      ) VALUES (
        ${name}, ${startAt}, ${endAt}, ${registrationOpenAt}, ${registrationCloseAt}, ${minTeamSize}, ${maxTeamSize}, ${Boolean(isActive)}
      )
      RETURNING *
    `;

    return res.status(201).json({ hackathon: rows[0] });
  } catch (err) {
    return next(err);
  }
});

hackathonsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await sql`
      SELECT *
      FROM hackathons
      WHERE is_active = TRUE
      ORDER BY start_at ASC
    `;
    return res.json({ hackathons: rows });
  } catch (err) {
    return next(err);
  }
});
