// Database: SQLite through Node's built-in node:sqlite module (no native add-on,
// nothing downloaded). Every table the Phase 1 modules need is created here by
// numbered migrations. Dates are ISO strings in UTC. Booleans are 0 or 1.

import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS = [
  // 1: foundation, billing, Property Mentor progress, Developer Studio projects
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    email_verified_at TEXT,
    password_hash TEXT,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    nation TEXT,
    settings_json TEXT NOT NULL DEFAULT '{}',
    referral_code TEXT UNIQUE,
    created_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT
  );
  CREATE TABLE email_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    purpose TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );
  CREATE TABLE login_failures (
    email TEXT NOT NULL,
    at TEXT NOT NULL
  );
  CREATE INDEX login_failures_email ON login_failures(email, at);
  -- Outbox: messages the app WOULD send. Nothing here is sent to anyone. A mail
  -- provider is connected later, with the owner's approval.
  CREATE TABLE outbox (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    to_email TEXT NOT NULL,
    kind TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    target TEXT,
    detail_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
    BEGIN SELECT RAISE(ABORT, 'The audit log is append-only.'); END;
  CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
    BEGIN SELECT RAISE(ABORT, 'The audit log is append-only.'); END;
  CREATE TABLE consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    granted INTEGER NOT NULL,
    wording_version TEXT NOT NULL,
    source TEXT NOT NULL,
    at TEXT NOT NULL
  );
  CREATE INDEX consents_user ON consents(user_id, kind, at);
  CREATE TABLE signoffs (
    id TEXT PRIMARY KEY,
    compliance_row INTEGER NOT NULL,
    flag TEXT,
    project_id TEXT,
    professional_name TEXT NOT NULL,
    professional_role TEXT NOT NULL,
    reference TEXT NOT NULL,
    signed_on TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    recorded_at TEXT NOT NULL
  );
  CREATE TABLE flag_overrides (
    name TEXT PRIMARY KEY,
    is_on INTEGER NOT NULL,
    signoff_id TEXT,
    set_by TEXT NOT NULL,
    set_at TEXT NOT NULL
  );
  CREATE TABLE subscriptions (
    user_id TEXT PRIMARY KEY,
    tier TEXT,
    status TEXT NOT NULL,
    trial_ends_at TEXT,
    first_paid_at TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    cancelled_at TEXT,
    free_months_credit INTEGER NOT NULL DEFAULT 0,
    provider TEXT,
    provider_ref TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE referrals (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL,
    referred_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    rewarded_at TEXT
  );
  CREATE TABLE refunds (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount_pence INTEGER,
    basis TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL,
    requested_at TEXT NOT NULL,
    decided_at TEXT,
    decided_by TEXT
  );
  CREATE TABLE lesson_progress (
    user_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (user_id, lesson_id)
  );
  CREATE TABLE quiz_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    at TEXT NOT NULL
  );
  CREATE TABLE studio_projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    nation TEXT NOT NULL,
    inputs_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
];

export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);');
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get();
  const current = row && row.v ? row.v : 0;
  for (let i = current; i < MIGRATIONS.length; i += 1) {
    tx(db, () => {
      db.exec(MIGRATIONS[i]);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(i + 1);
    });
  }
  return db;
}

// Runs fn inside a transaction. Rolls back and rethrows on any error.
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
