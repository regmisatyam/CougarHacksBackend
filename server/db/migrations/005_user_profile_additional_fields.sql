-- Migration 005: Add additional user profile fields (DOB, Gender, Dietary Restrictions)
-- Created: 2026-02-03

-- Add date of birth, gender, and dietary restrictions to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender VARCHAR(50),
ADD COLUMN IF NOT EXISTS dietary_restrictions VARCHAR(100);

-- Add indexes for filtering/reporting
CREATE INDEX IF NOT EXISTS idx_user_profiles_gender ON user_profiles(gender);
CREATE INDEX IF NOT EXISTS idx_user_profiles_dietary ON user_profiles(dietary_restrictions);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.date_of_birth IS 'User date of birth for age verification and demographics';
COMMENT ON COLUMN user_profiles.gender IS 'User gender identity (male, female, non-binary, other, prefer-not-to-say)';
COMMENT ON COLUMN user_profiles.dietary_restrictions IS 'Dietary restrictions for food planning (none, vegetarian, vegan, halal, kosher, gluten-free, etc)';
