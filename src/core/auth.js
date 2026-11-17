// Sign-up, email verification, sign-in, sessions and passwords.
//
// Passwords are hashed with scrypt and a per-account salt. Session and email
// tokens are random 32-byte values; only their SHA-256 hash is stored, so a copy
// of the database cannot be used to sign in.
//
// No email is sent from here. Each message is written to the outbox table, where
// a mail provider can pick it up once the owner has approved one.

import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { AppError, iso, newId, addDays } from './context.js';
import { tx } from './db.js';
import { record } from './audit.js';
import { recordConsent } from './consent.js';
import { SIGN_UP_ROLES, ROLES } from './roles.js';
import { NATIONS } from '../data/purchase-tax.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGN_IN_FAILED = 'Email or password is incorrect.';

export function normaliseEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function validateEmail(email) {
  const e = normaliseEmail(email);
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) {
    throw new AppError('bad_email', 'Enter a valid email address.');
  }
  return e;
}

export function validatePassword(password, email = '') {
  if (typeof password !== 'string' || password.length < 10) {
    throw new AppError('weak_password', 'Use a password of at least 10 characters.');
  }
  if (password.length > 200) {
    throw new AppError('weak_password', 'Use a password of 200 characters or fewer.');
  }
  if (new Set(password).size < 4) {
    throw new AppError('weak_password', 'Use a password with more variety in it.');
  }
  if (email && password.toLowerCase() === email.toLowerCase()) {
    throw new AppError('weak_password', 'Your password cannot be your email address.');
  }
  return password;
}

export function hashPassword(password, cost) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: cost, r: 8, p: 1, maxmem: 256 * cost * 8 });
  return `scrypt$${cost}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || typeof password !== 'string') {
    return false;
  }
  const [scheme, costText, saltText, hashText] = stored.split('$');
  const cost = Number(costText);
  if (scheme !== 'scrypt' || !Number.isInteger(cost) || !saltText || !hashText) {
    return false;
  }
  const expected = Buffer.from(hashText, 'base64url');
  const actual = scryptSync(password, Buffer.from(saltText, 'base64url'), expected.length, { N: cost, r: 8, p: 1, maxmem: 256 * cost * 8 });
  return timingSafeEqual(expected, actual);
}

function newToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function newReferralCode(ctx) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = randomBytes(8);
    let code = '';
    for (const b of bytes) code += alphabet[b % alphabet.length];
    if (!ctx.db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code)) {
      return code;
    }
  }
  throw new Error('Could not create a referral code.');
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    nation: row.nation,
    emailVerified: Boolean(row.email_verified_at),
    referralCode: row.referral_code,
    settings: JSON.parse(row.settings_json || '{}'),
    createdAt: row.created_at,
  };
}

function writeOutbox(ctx, { userId, to, kind, subject, body }) {
  ctx.db
    .prepare('INSERT INTO outbox (id, user_id, to_email, kind, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(newId(), userId, to, kind, subject, body, iso(ctx));
}

function issueEmailToken(ctx, userId, purpose, hours) {
  const token = newToken();
  const expires = new Date(ctx.now().getTime() + hours * 3600000).toISOString();
  ctx.db.prepare('INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)').run(hashToken(token), userId, purpose, expires);
  return token;
}

function sendVerification(ctx, user) {
  const token = issueEmailToken(ctx, user.id, 'verify', ctx.config.emailTokenHours);
  writeOutbox(ctx, {
    userId: user.id,
    to: user.email,
    kind: 'verify_email',
    subject: 'Confirm your email for Propertymaster',
    body: `Open this link to confirm your email address. It works for ${ctx.config.emailTokenHours} hours.\n${ctx.config.siteUrl}/#/verify?token=${token}\n\nIf you did not sign up, you can ignore this message.`,
  });
  return token;
}

// Creates a member or estate agent account. The reply is the same whether or not
// the email already has an account, so the form cannot be used to find out who
// is a member. `created` and `userId` are for the caller on the server only.
export function signUp(ctx, input = {}) {
  const email = validateEmail(input.email);
  validatePassword(input.password, email);
  const role = input.accountType || 'member';
  if (!SIGN_UP_ROLES.includes(role)) {
    throw new AppError('bad_account_type', 'Choose developer and investor, or estate agent.');
  }
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim().slice(0, 80) : '';
  if (!displayName) {
    throw new AppError('bad_name', 'Tell us the name to show on your account.');
  }
  const nation = input.nation || null;
  if (nation && !NATIONS.includes(nation)) {
    throw new AppError('bad_nation', 'Choose Scotland, England, Wales or Northern Ireland.');
  }
  const consents = input.consents || {};
  if (consents.terms !== true || consents.privacy !== true) {
    throw new AppError('consent_needed', 'Please agree to the terms and the privacy notice to open an account.');
  }

  const existing = ctx.db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
  if (existing) {
    writeOutbox(ctx, {
      userId: existing.id,
      to: email,
      kind: 'account_exists',
      subject: 'You already have a Propertymaster account',
      body: `Someone tried to sign up with this email address. You already have an account: sign in at ${ctx.config.siteUrl}/#/sign-in, or reset your password there if you have forgotten it.`,
    });
    return { status: 'check_email', created: false, userId: null };
  }

  const id = newId();
  tx(ctx.db, () => {
    ctx.db
      .prepare('INSERT INTO users (id, email, password_hash, display_name, role, nation, referral_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, email, hashPassword(input.password, ctx.config.scryptCost), displayName, role, nation, newReferralCode(ctx), iso(ctx));
    const source = input.source || 'sign-up form';
    recordConsent(ctx, id, 'terms', true, source);
    recordConsent(ctx, id, 'privacy', true, source);
    recordConsent(ctx, id, 'marketing_email', consents.marketing_email === true, source);
    sendVerification(ctx, { id, email });
    record(ctx, { actorId: id, action: 'account.created', target: id, detail: { role } });
  });
  return { status: 'check_email', created: true, userId: id };
}

function useEmailToken(ctx, token, purpose) {
  const row = ctx.db.prepare('SELECT token_hash, user_id, expires_at, used_at FROM email_tokens WHERE token_hash = ? AND purpose = ?').get(hashToken(token), purpose);
  if (!row || row.used_at || row.expires_at <= iso(ctx)) {
    throw new AppError('bad_token', 'This link has expired or has already been used. Ask for a new one.');
  }
  ctx.db.prepare('UPDATE email_tokens SET used_at = ? WHERE token_hash = ?').run(iso(ctx), row.token_hash);
  return row.user_id;
}

export function verifyEmail(ctx, token) {
  return tx(ctx.db, () => {
    const userId = useEmailToken(ctx, token, 'verify');
    ctx.db.prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').run(iso(ctx), userId);
    record(ctx, { actorId: userId, action: 'account.email_verified', target: userId });
    return { userId };
  });
}

export function resendVerification(ctx, emailInput) {
  const email = normaliseEmail(emailInput);
  const user = ctx.db.prepare('SELECT id, email, email_verified_at FROM users WHERE email = ? AND deleted_at IS NULL').get(email);
  if (user && !user.email_verified_at) {
    sendVerification(ctx, user);
  }
  return { status: 'check_email' };
}

function recentFailures(ctx, email) {
  const since = new Date(ctx.now().getTime() - ctx.config.lockout.windowMinutes * 60000).toISOString();
  return ctx.db.prepare('SELECT COUNT(*) AS n FROM login_failures WHERE email = ? AND at > ?').get(email, since).n;
}

function createSession(ctx, userId) {
  const token = newToken();
  ctx.db
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), userId, iso(ctx), addDays(ctx.now(), ctx.config.sessionDays).toISOString());
  return token;
}

let dummyHash = null;

export function signIn(ctx, { email: emailInput, password } = {}) {
  const email = normaliseEmail(emailInput);
  if (!email || typeof password !== 'string' || !password) {
    throw new AppError('sign_in_failed', SIGN_IN_FAILED, 401);
  }
  if (recentFailures(ctx, email) >= ctx.config.lockout.maxFailures) {
    throw new AppError('locked', `Too many attempts. Please wait ${ctx.config.lockout.windowMinutes} minutes and try again.`, 429);
  }
  const row = ctx.db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(email);
  let ok = false;
  if (row) {
    ok = verifyPassword(password, row.password_hash);
  } else {
    // Spend the same effort when the account does not exist, so timing tells nothing.
    dummyHash = dummyHash && dummyHash.startsWith(`scrypt$${ctx.config.scryptCost}$`) ? dummyHash : hashPassword('not-a-real-password', ctx.config.scryptCost);
    verifyPassword(password, dummyHash);
  }
  if (!ok) {
    ctx.db.prepare('INSERT INTO login_failures (email, at) VALUES (?, ?)').run(email, iso(ctx));
    record(ctx, { actorId: row ? row.id : null, action: 'auth.sign_in_failed', detail: { emailHash: hashToken(email).slice(0, 16) } });
    throw new AppError('sign_in_failed', SIGN_IN_FAILED, 401);
  }
  ctx.db.prepare('DELETE FROM login_failures WHERE email = ?').run(email);
  const token = createSession(ctx, row.id);
  record(ctx, { actorId: row.id, action: 'auth.signed_in', target: row.id });
  return { token, user: publicUser(row) };
}

export function getSessionUser(ctx, token) {
  if (!token) return null;
  const row = ctx.db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.deleted_at IS NULL`,
    )
    .get(hashToken(token), iso(ctx));
  return publicUser(row);
}

export function signOut(ctx, token) {
  if (!token) return;
  ctx.db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').run(iso(ctx), hashToken(token));
}

export function signOutEverywhere(ctx, userId) {
  ctx.db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(iso(ctx), userId);
}

export function requestPasswordReset(ctx, emailInput) {
  const email = normaliseEmail(emailInput);
  const user = ctx.db.prepare('SELECT id, email FROM users WHERE email = ? AND deleted_at IS NULL').get(email);
  if (user) {
    const token = issueEmailToken(ctx, user.id, 'reset', 1);
    writeOutbox(ctx, {
      userId: user.id,
      to: user.email,
      kind: 'reset_password',
      subject: 'Reset your Propertymaster password',
      body: `Open this link to choose a new password. It works for 1 hour.\n${ctx.config.siteUrl}/#/reset?token=${token}\n\nIf you did not ask for this, you can ignore this message.`,
    });
    record(ctx, { actorId: user.id, action: 'auth.reset_requested', target: user.id });
  }
  return { status: 'check_email' };
}

export function resetPassword(ctx, token, newPassword) {
  return tx(ctx.db, () => {
    const userId = useEmailToken(ctx, token, 'reset');
    const user = ctx.db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    validatePassword(newPassword, user ? user.email : '');
    ctx.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword, ctx.config.scryptCost), userId);
    signOutEverywhere(ctx, userId);
    record(ctx, { actorId: userId, action: 'auth.password_reset', target: userId });
    return { userId };
  });
}

export function changePassword(ctx, userId, currentPassword, newPassword) {
  const row = ctx.db.prepare('SELECT email, password_hash FROM users WHERE id = ? AND deleted_at IS NULL').get(userId);
  if (!row || !verifyPassword(currentPassword, row.password_hash)) {
    throw new AppError('wrong_password', 'Your current password is incorrect.', 403);
  }
  validatePassword(newPassword, row.email);
  ctx.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword, ctx.config.scryptCost), userId);
  record(ctx, { actorId: userId, action: 'auth.password_changed', target: userId });
}

// Creates a staff account (admin or owner). Used by the set-up script and by
// tests, never by the sign-up form.
export function createStaff(ctx, { email: emailInput, password, displayName, role }) {
  if (!ROLES.includes(role)) {
    throw new AppError('bad_role', `Unknown role "${role}".`);
  }
  const email = validateEmail(emailInput);
  validatePassword(password, email);
  if (ctx.db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw new AppError('email_taken', 'An account with this email already exists.');
  }
  const id = newId();
  ctx.db
    .prepare('INSERT INTO users (id, email, email_verified_at, password_hash, display_name, role, referral_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, email, iso(ctx), hashPassword(password, ctx.config.scryptCost), displayName || role, role, newReferralCode(ctx), iso(ctx));
  record(ctx, { actorId: id, action: 'account.created', target: id, detail: { role, by: 'set-up' } });
  return publicUser(ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function readOutbox(ctx, { toEmail = null, limit = 20 } = {}) {
  const rows = toEmail
    ? ctx.db.prepare('SELECT * FROM outbox WHERE to_email = ? ORDER BY created_at DESC, rowid DESC LIMIT ?').all(normaliseEmail(toEmail), limit)
    : ctx.db.prepare('SELECT * FROM outbox ORDER BY created_at DESC, rowid DESC LIMIT ?').all(limit);
  return rows.map((r) => ({ id: r.id, to: r.to_email, kind: r.kind, subject: r.subject, body: r.body, createdAt: r.created_at }));
}
