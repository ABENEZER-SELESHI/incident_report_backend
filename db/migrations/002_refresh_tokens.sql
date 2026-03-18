-- =============================================================================
-- Migration: 002_refresh_tokens.sql
-- Refresh token blacklist + account lockout columns on users
-- =============================================================================

-- Refresh token store: used for blacklisting and per-user revocation
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hex of the raw token
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE refresh_tokens IS
  'Issued refresh tokens. Blacklisted by setting revoked=TRUE. '
  'All rows for a user can be revoked to force re-login everywhere.';

CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Account lockout support on users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_token_version INT         NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.failed_login_attempts IS 'Incremented on each bad password; reset on success.';
COMMENT ON COLUMN users.locked_until          IS 'Account locked until this timestamp after 5 failed attempts.';
COMMENT ON COLUMN users.refresh_token_version IS 'Increment to invalidate all existing refresh tokens for this user.';
