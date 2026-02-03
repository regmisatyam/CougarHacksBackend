-- Add active_hackathon_id to user_profiles to track user's selected hackathon
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS active_hackathon_id UUID REFERENCES hackathons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_active_hackathon ON user_profiles(active_hackathon_id);
