import crypto from 'node:crypto';
import express from 'express';
import { sql } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const teamsRouter = express.Router();

async function hasAcceptedRegistration(userId, hackathonId) {
  const rows = await sql`
    SELECT id
    FROM registrations
    WHERE user_id = ${userId}
      AND hackathon_id = ${hackathonId}
      AND status = 'accepted'
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

async function generateUniqueTeamCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const rows = await sql`SELECT id FROM teams WHERE team_code = ${code} LIMIT 1`;
    if (!rows[0]) return code;
  }
  throw new Error('Failed to generate unique team code');
}

teamsRouter.post('/create', requireAuth, async (req, res, next) => {
  try {
    const { hackathonId, name, isPublic = false } = req.body || {};
    if (!hackathonId || !name) return res.status(400).json({ error: 'hackathonId and name are required' });

    const accepted = await hasAcceptedRegistration(req.user.id, hackathonId);
    if (!accepted) return res.status(403).json({ error: 'Accepted registration required' });

    const teamCode = await generateUniqueTeamCode();

    const teamRows = await sql`
      INSERT INTO teams (hackathon_id, name, team_code, created_by, is_public)
      VALUES (${hackathonId}, ${name}, ${teamCode}, ${req.user.id}, ${Boolean(isPublic)})
      RETURNING *
    `;

    const team = teamRows[0];

    await sql`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${team.id}, ${req.user.id}, 'leader')
    `;

    return res.status(201).json({ team });
  } catch (err) {
    return next(err);
  }
});

teamsRouter.post('/join', requireAuth, async (req, res, next) => {
  try {
    const { teamCode } = req.body || {};
    if (!teamCode) return res.status(400).json({ error: 'teamCode is required' });

    const teams = await sql`
      SELECT t.id, t.hackathon_id, t.is_locked
      FROM teams t
      WHERE t.team_code = ${String(teamCode).trim().toUpperCase()}
      LIMIT 1
    `;

    const team = teams[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.is_locked) return res.status(400).json({ error: 'Team is locked' });

    const accepted = await hasAcceptedRegistration(req.user.id, team.hackathon_id);
    if (!accepted) return res.status(403).json({ error: 'Accepted registration required' });

    await sql`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${team.id}, ${req.user.id}, 'member')
      ON CONFLICT (team_id, user_id) DO NOTHING
    `;

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

teamsRouter.post('/join-by-id', requireAuth, async (req, res, next) => {
  try {
    const { teamId } = req.body || {};
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const teams = await sql`
      SELECT t.id, t.hackathon_id, t.is_locked, t.is_public
      FROM teams t
      WHERE t.id = ${teamId}
      LIMIT 1
    `;

    const team = teams[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.is_locked) return res.status(400).json({ error: 'Team is locked' });
    if (!team.is_public) return res.status(403).json({ error: 'Team is not public' });

    const accepted = await hasAcceptedRegistration(req.user.id, team.hackathon_id);
    if (!accepted) return res.status(403).json({ error: 'Accepted registration required' });

    await sql`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${team.id}, ${req.user.id}, 'member')
      ON CONFLICT (team_id, user_id) DO NOTHING
    `;

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

teamsRouter.post('/leave', requireAuth, async (req, res, next) => {
  try {
    const { hackathonId } = req.body || {};
    if (!hackathonId) return res.status(400).json({ error: 'hackathonId is required' });

    const rows = await sql`
      SELECT tm.team_id, tm.role
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE tm.user_id = ${req.user.id} AND t.hackathon_id = ${hackathonId}
      LIMIT 1
    `;

    const membership = rows[0];
    if (!membership) return res.status(404).json({ error: 'Not in a team for this hackathon' });

    const memberCountRows = await sql`SELECT COUNT(*)::int AS count FROM team_members WHERE team_id = ${membership.team_id}`;
    const memberCount = memberCountRows[0].count;

    if (membership.role === 'leader' && memberCount > 1) {
      return res.status(400).json({ error: 'Leader cannot leave while other members remain' });
    }

    if (membership.role === 'leader' && memberCount === 1) {
      await sql`DELETE FROM teams WHERE id = ${membership.team_id}`;
      return res.json({ ok: true, disbanded: true });
    }

    await sql`DELETE FROM team_members WHERE team_id = ${membership.team_id} AND user_id = ${req.user.id}`;
    return res.json({ ok: true, disbanded: false });
  } catch (err) {
    return next(err);
  }
});

teamsRouter.post('/invite', requireAuth, async (req, res, next) => {
  try {
    const { teamId, email, expiresInHours = 72 } = req.body || {};
    if (!teamId || !email) return res.status(400).json({ error: 'teamId and email are required' });

    const leaderRows = await sql`
      SELECT tm.user_id
      FROM team_members tm
      WHERE tm.team_id = ${teamId} AND tm.user_id = ${req.user.id} AND tm.role = 'leader'
      LIMIT 1
    `;
    if (!leaderRows[0]) return res.status(403).json({ error: 'Only team leader can invite' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const users = await sql`SELECT id FROM users WHERE email = ${normalizedEmail} LIMIT 1`;
    const invitedUserId = users[0]?.id || null;

    const expiresAt = new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000);

    const inviteRows = await sql`
      INSERT INTO team_invites (team_id, invited_user_id, invited_email, status, invited_by, expires_at)
      VALUES (${teamId}, ${invitedUserId}, ${normalizedEmail}, 'pending', ${req.user.id}, ${expiresAt.toISOString()})
      RETURNING *
    `;

    return res.status(201).json({ invite: inviteRows[0] });
  } catch (err) {
    return next(err);
  }
});

teamsRouter.post('/invite/respond', requireAuth, async (req, res, next) => {
  try {
    const { inviteId, action } = req.body || {};
    if (!inviteId || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'inviteId and action(accept|decline) are required' });
    }

    const rows = await sql`
      SELECT ti.*, t.hackathon_id
      FROM team_invites ti
      JOIN teams t ON t.id = ti.team_id
      WHERE ti.id = ${inviteId}
      LIMIT 1
    `;

    const invite = rows[0];
    if (!invite) return res.status(404).json({ error: 'Invite not found' });

    if (invite.status !== 'pending') return res.status(400).json({ error: 'Invite is not pending' });
    if (new Date(invite.expires_at) < new Date()) {
      await sql`UPDATE team_invites SET status = 'expired', responded_at = NOW() WHERE id = ${invite.id}`;
      return res.status(400).json({ error: 'Invite expired' });
    }

    const emailMatch = invite.invited_email && invite.invited_email === req.user.email;
    const userMatch = invite.invited_user_id && invite.invited_user_id === req.user.id;
    if (!emailMatch && !userMatch) return res.status(403).json({ error: 'Not your invite' });

    if (action === 'decline') {
      await sql`UPDATE team_invites SET status = 'declined', responded_at = NOW() WHERE id = ${invite.id}`;
      return res.json({ ok: true });
    }

    const accepted = await hasAcceptedRegistration(req.user.id, invite.hackathon_id);
    if (!accepted) return res.status(403).json({ error: 'Accepted registration required' });

    await sql`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${invite.team_id}, ${req.user.id}, 'member')
    `;

    await sql`UPDATE team_invites SET status = 'accepted', responded_at = NOW() WHERE id = ${invite.id}`;
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

teamsRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { hackathonId } = req.query;
    if (!hackathonId) return res.status(400).json({ error: 'hackathonId query param is required' });

    const teamRows = await sql`
      SELECT t.*
      FROM teams t
      JOIN team_members tm ON tm.team_id = t.id
      WHERE tm.user_id = ${req.user.id} AND t.hackathon_id = ${hackathonId}
      LIMIT 1
    `;

    const team = teamRows[0];
    if (!team) return res.json({ team: null });

    const members = await sql`
      SELECT tm.user_id, tm.role, tm.joined_at, u.email, p.first_name, p.last_name
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE tm.team_id = ${team.id}
      ORDER BY tm.joined_at ASC
    `;

    const invites = await sql`
      SELECT id, invited_email, invited_user_id, status, invited_at, expires_at
      FROM team_invites
      WHERE team_id = ${team.id}
      ORDER BY invited_at DESC
    `;

    return res.json({ team, members, invites });
  } catch (err) {
    return next(err);
  }
});

teamsRouter.get('/invites/me', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT ti.id, ti.team_id, ti.invited_email, ti.status, ti.invited_at, ti.expires_at,
             t.name AS team_name, t.team_code, t.hackathon_id
      FROM team_invites ti
      JOIN teams t ON t.id = ti.team_id
      WHERE ti.status = 'pending'
        AND (ti.invited_user_id = ${req.user.id} OR ti.invited_email = ${req.user.email})
      ORDER BY ti.invited_at DESC
    `;

    return res.json({ invites: rows });
  } catch (err) {
    return next(err);
  }
});

teamsRouter.post('/toggle-public', requireAuth, async (req, res, next) => {
  try {
    const { teamId, isPublic } = req.body || {};
    if (!teamId || typeof isPublic !== 'boolean') {
      return res.status(400).json({ error: 'teamId and isPublic (boolean) are required' });
    }

    // Verify user is the team leader
    const leaderRows = await sql`
      SELECT tm.user_id
      FROM team_members tm
      WHERE tm.team_id = ${teamId} AND tm.user_id = ${req.user.id} AND tm.role = 'leader'
      LIMIT 1
    `;
    if (!leaderRows[0]) return res.status(403).json({ error: 'Only team leader can change public status' });

    const rows = await sql`
      UPDATE teams
      SET is_public = ${isPublic}
      WHERE id = ${teamId}
      RETURNING *
    `;

    return res.json({ team: rows[0] });
  } catch (err) {
    return next(err);
  }
});

teamsRouter.get('/available', async (req, res, next) => {
  try {
    const { hackathonId } = req.query;
    if (!hackathonId) return res.status(400).json({ error: 'hackathonId query param is required' });

    // Get hackathon details for max team size
    const hackRows = await sql`
      SELECT max_team_size FROM hackathons WHERE id = ${hackathonId} LIMIT 1
    `;
    const maxTeamSize = hackRows[0]?.max_team_size || 4;

    // Get teams that are not locked and not full
    const rows = await sql`
      SELECT 
        t.id, 
        t.name, 
        t.team_code, 
        t.is_locked,
        t.is_public,
        COUNT(tm.user_id)::int AS member_count
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id
      WHERE t.hackathon_id = ${hackathonId}
        AND t.is_locked = FALSE
      GROUP BY t.id, t.name, t.team_code, t.is_locked, t.is_public
      HAVING COUNT(tm.user_id) < ${maxTeamSize}
      ORDER BY t.is_public DESC, t.created_at DESC
    `;

    return res.json({ teams: rows });
  } catch (err) {
    return next(err);
  }
});
