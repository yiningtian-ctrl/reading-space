// Idempotent bootstrap: a new D1 binding can be used without a manual SQL import.
export const ACCOUNT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS rs_users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rs_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES rs_users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS rs_session_expiry ON rs_sessions(expires_at)`,
  `CREATE TABLE IF NOT EXISTS rs_study (user_id TEXT PRIMARY KEY REFERENCES rs_users(id) ON DELETE CASCADE, revision INTEGER NOT NULL DEFAULT 0, data TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS rs_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
];
