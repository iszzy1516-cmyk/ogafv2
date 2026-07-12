-- Tracks failed login attempts per username for brute-force protection.
CREATE TABLE IF NOT EXISTS login_attempts (
    username TEXT PRIMARY KEY,
    failed_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_locked ON login_attempts(locked_until);
