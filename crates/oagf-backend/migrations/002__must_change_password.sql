-- Add must_change_password column safely for both fresh and existing databases.
-- Fresh installs already have the column from the initial schema; this migration is idempotent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;
