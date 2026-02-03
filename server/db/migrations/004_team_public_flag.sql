-- Add is_public column to teams table to allow teams to be publicly joinable
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_teams_public ON teams(hackathon_id, is_public) WHERE is_public = TRUE;
