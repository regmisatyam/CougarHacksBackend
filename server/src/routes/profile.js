import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sql } from '../db.js';

export const profileRouter = express.Router();

profileRouter.post('/me', requireAuth, async (req, res, next) => {
  try {
    const {
      firstName = null,
      lastName = null,
      phone = null,
      dob = null,
      gender = null,
      university = null,
      major = null,
      graduationYear = null,
      country = null,
      city = null,
      dietaryRestrictions = null,
      githubUrl = null,
      linkedinUrl = null,
      portfolioUrl = null,
      activeHackathonId = null,
    } = req.body || {};

    const rows = await sql`
      INSERT INTO user_profiles (
        user_id, first_name, last_name, phone, date_of_birth, gender, university, major,
        graduation_year, country, city, dietary_restrictions, github_url, linkedin_url, portfolio_url, active_hackathon_id
      ) VALUES (
        ${req.user.id}, ${firstName}, ${lastName}, ${phone}, ${dob}, ${gender}, ${university}, ${major},
        ${graduationYear}, ${country}, ${city}, ${dietaryRestrictions}, ${githubUrl}, ${linkedinUrl}, ${portfolioUrl}, ${activeHackathonId}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        date_of_birth = EXCLUDED.date_of_birth,
        gender = EXCLUDED.gender,
        university = EXCLUDED.university,
        major = EXCLUDED.major,
        graduation_year = EXCLUDED.graduation_year,
        country = EXCLUDED.country,
        city = EXCLUDED.city,
        dietary_restrictions = EXCLUDED.dietary_restrictions,
        github_url = EXCLUDED.github_url,
        linkedin_url = EXCLUDED.linkedin_url,
        portfolio_url = EXCLUDED.portfolio_url,
        active_hackathon_id = COALESCE(EXCLUDED.active_hackathon_id, user_profiles.active_hackathon_id),
        updated_at = NOW()
      RETURNING *
    `;

    return res.json({ profile: rows[0] });
  } catch (err) {
    return next(err);
  }
});

profileRouter.post('/set-active-hackathon', requireAuth, async (req, res, next) => {
  try {
    const { hackathonId } = req.body || {};
    
    if (!hackathonId) {
      return res.status(400).json({ error: 'hackathonId is required' });
    }

    // Verify hackathon exists and is active
    const hackRows = await sql`
      SELECT id FROM hackathons
      WHERE id = ${hackathonId} AND is_active = TRUE
      LIMIT 1
    `;

    if (!hackRows[0]) {
      return res.status(404).json({ error: 'Hackathon not found or inactive' });
    }

    const rows = await sql`
      UPDATE user_profiles
      SET active_hackathon_id = ${hackathonId}, updated_at = NOW()
      WHERE user_id = ${req.user.id}
      RETURNING *
    `;

    return res.json({ profile: rows[0] });
  } catch (err) {
    return next(err);
  }
});
