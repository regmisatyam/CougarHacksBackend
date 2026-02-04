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
    const { hackathonId, status } = req.query;
    if (!hackathonId) return res.status(400).json({ error: 'hackathonId query param is required' });

    let rows;
    if (status && status !== 'all') {
      rows = await sql`
        SELECT r.*, u.email, p.first_name, p.last_name
        FROM registrations r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE r.hackathon_id = ${hackathonId}
          AND r.status = ${status}
        ORDER BY r.applied_at ASC
      `;
    } else {
      rows = await sql`
        SELECT r.*, u.email, p.first_name, p.last_name
        FROM registrations r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE r.hackathon_id = ${hackathonId}
        ORDER BY r.applied_at ASC
      `;
    }

    return res.json({ registrations: rows });
  } catch (err) {
    return next(err);
  }
});

adminRouter.post('/registrations/decision', async (req, res, next) => {
  try {
    const { registrationId, decision, reason = null } = req.body || {};
    const allowed = ['accepted', 'rejected', 'waitlisted', 'pending', 'cancelled'];

    if (!registrationId || !decision || !allowed.includes(decision)) {
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

    // Check if user is an organizer
    const userCheck = await sql`
      SELECT id, email, role
      FROM users
      WHERE id = ${userId}
    `;
    
    if (userCheck.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (userCheck[0].role === 'organizer') {
      return res.status(403).json({ error: 'Cannot block organizers' });
    }

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

// Get full user details with profile and teams
adminRouter.get('/users/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Get user with profile
    const userRows = await sql`
      SELECT u.*, p.*
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = ${userId}
    `;
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    
    // Get user's registrations
    const registrations = await sql`
      SELECT r.*, h.name as hackathon_name
      FROM registrations r
      JOIN hackathons h ON h.id = r.hackathon_id
      WHERE r.user_id = ${userId}
      ORDER BY r.applied_at DESC
    `;
    
    // Get user's teams
    const teams = await sql`
      SELECT tm.*, t.name as team_name, t.hackathon_id, 
             h.name as hackathon_name, h.max_team_size, t.is_public
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      JOIN hackathons h ON h.id = t.hackathon_id
      WHERE tm.user_id = ${userId}
      ORDER BY tm.joined_at DESC
    `;
    
    return res.json({ 
      user,
      registrations,
      teams 
    });
  } catch (err) {
    return next(err);
  }
});

// Remove user from team
adminRouter.post('/teams/remove-member', async (req, res, next) => {
  try {
    const { teamId, userId, reason } = req.body || {};
    if (!teamId || !userId) {
      return res.status(400).json({ error: 'teamId and userId are required' });
    }
    
    // Get team info
    const teamRows = await sql`
      SELECT t.*, h.name as hackathon_name
      FROM teams t
      JOIN hackathons h ON h.id = t.hackathon_id
      WHERE t.id = ${teamId}
    `;
    
    if (teamRows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Remove from team
    await sql`
      DELETE FROM team_members
      WHERE team_id = ${teamId} AND user_id = ${userId}
    `;
    
    // Create audit log
    await createAudit({
      actorUserId: req.user.id,
      targetUserId: userId,
      hackathonId: teamRows[0].hackathon_id,
      action: 'admin.team.remove_member',
      details: { teamId, reason: reason || 'Removed by admin' },
    });
    
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// Add user to team
adminRouter.post('/teams/add-member', async (req, res, next) => {
  try {
    const { teamId, userId } = req.body || {};
    if (!teamId || !userId) {
      return res.status(400).json({ error: 'teamId and userId are required' });
    }
    
    // Get team info
    const teamRows = await sql`
      SELECT t.*, h.name as hackathon_name, h.max_team_size,
             (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as current_members
      FROM teams t
      JOIN hackathons h ON h.id = t.hackathon_id
      WHERE t.id = ${teamId}
    `;
    
    if (teamRows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const team = teamRows[0];
    
    // Check if team is full
    if (team.current_members >= team.max_team_size) {
      return res.status(400).json({ error: 'Team is full' });
    }
    
    // Check if user is already in a team for this hackathon
    const existingTeam = await sql`
      SELECT tm.team_id
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE tm.user_id = ${userId} AND t.hackathon_id = ${team.hackathon_id}
    `;
    
    if (existingTeam.length > 0) {
      return res.status(400).json({ error: 'User is already in a team for this hackathon' });
    }
    
    // Add to team
    await sql`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${teamId}, ${userId}, 'member')
    `;
    
    // Create audit log
    await createAudit({
      actorUserId: req.user.id,
      targetUserId: userId,
      hackathonId: team.hackathon_id,
      action: 'admin.team.add_member',
      details: { teamId },
    });
    
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// Change user role
adminRouter.post('/users/change-role', async (req, res, next) => {
  try {
    const { userId, role } = req.body || {};
    if (!userId || !role) {
      return res.status(400).json({ error: 'userId and role are required' });
    }
    
    if (!['participant', 'organizer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const rows = await sql`
      UPDATE users
      SET role = ${role}, updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, email, role
    `;
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await createAudit({
      actorUserId: req.user.id,
      targetUserId: userId,
      action: 'admin.user.change_role',
      details: { newRole: role },
    });
    
    return res.json({ user: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// Get available teams for a hackathon
adminRouter.get('/teams/available/:hackathonId', async (req, res, next) => {
  try {
    const { hackathonId } = req.params;
    
    const teams = await sql`
      SELECT t.id, t.name, h.max_team_size, t.is_public,
             (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as current_members
      FROM teams t
      JOIN hackathons h ON h.id = t.hackathon_id
      WHERE t.hackathon_id = ${hackathonId}
      ORDER BY t.name ASC
    `;
    
    return res.json({ teams });
  } catch (err) {
    return next(err);
  }
});

// Get all teams for a hackathon (with full details)
adminRouter.get('/teams/all/:hackathonId', async (req, res, next) => {
  try {
    const { hackathonId } = req.params;
    
    const teams = await sql`
      SELECT t.*, h.name as hackathon_name, h.max_team_size,
             (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
             u.email as creator_email, u.id as creator_id
      FROM teams t
      JOIN hackathons h ON h.id = t.hackathon_id
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.hackathon_id = ${hackathonId}
      ORDER BY t.created_at DESC
    `;
    
    return res.json({ teams });
  } catch (err) {
    return next(err);
  }
});

// Get team details with members
adminRouter.get('/teams/details/:teamId', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    
    // Get team info
    const teamRows = await sql`
      SELECT t.*, h.name as hackathon_name, h.max_team_size,
             u.email as creator_email
      FROM teams t
      JOIN hackathons h ON h.id = t.hackathon_id
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.id = ${teamId}
    `;
    
    if (teamRows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const team = teamRows[0];
    
    // Get team members
    const members = await sql`
      SELECT tm.*, u.email, u.id as user_id,
             p.first_name, p.last_name, p.university, p.major
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE tm.team_id = ${teamId}
      ORDER BY tm.role DESC, tm.joined_at ASC
    `;
    
    return res.json({ team, members });
  } catch (err) {
    return next(err);
  }
});
