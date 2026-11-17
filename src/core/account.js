// Profile, settings, data export and account deletion.

import { AppError, iso } from './context.js';
import { tx } from './db.js';
import { record } from './audit.js';
import { publicUser, verifyPassword, signOutEverywhere } from './auth.js';
import { consentHistory } from './consent.js';
import { NATIONS } from '../data/purchase-tax.js';

// Every setting a member can change, with the values it accepts.
export const SETTINGS = {
  theme: { values: ['system', 'light', 'dark'], fallback: 'system' },
  textSize: { values: ['normal', 'large'], fallback: 'normal' },
  reduceMotion: { values: [true, false], fallback: false },
  emailNotifications: { values: [true, false], fallback: true },
};

export function defaultSettings() {
  return Object.fromEntries(Object.entries(SETTINGS).map(([k, v]) => [k, v.fallback]));
}

function getRow(ctx, userId) {
  const row = ctx.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(userId);
  if (!row) {
    throw new AppError('not_found', 'That account was not found.', 404);
  }
  return row;
}

export function getUser(ctx, userId) {
  const user = publicUser(getRow(ctx, userId));
  user.settings = { ...defaultSettings(), ...user.settings };
  return user;
}

export function updateProfile(ctx, userId, changes = {}) {
  const row = getRow(ctx, userId);
  let displayName = row.display_name;
  let nation = row.nation;
  if (changes.displayName !== undefined) {
    displayName = typeof changes.displayName === 'string' ? changes.displayName.trim().slice(0, 80) : '';
    if (!displayName) {
      throw new AppError('bad_name', 'Tell us the name to show on your account.');
    }
  }
  if (changes.nation !== undefined) {
    if (changes.nation !== null && !NATIONS.includes(changes.nation)) {
      throw new AppError('bad_nation', 'Choose Scotland, England, Wales or Northern Ireland.');
    }
    nation = changes.nation;
  }
  ctx.db.prepare('UPDATE users SET display_name = ?, nation = ? WHERE id = ?').run(displayName, nation, userId);
  record(ctx, { actorId: userId, action: 'account.profile_updated', target: userId });
  return getUser(ctx, userId);
}

export function updateSettings(ctx, userId, changes = {}) {
  const row = getRow(ctx, userId);
  const next = { ...defaultSettings(), ...JSON.parse(row.settings_json || '{}') };
  for (const [key, value] of Object.entries(changes)) {
    const def = SETTINGS[key];
    if (!def) {
      throw new AppError('bad_setting', `Unknown setting "${key}".`);
    }
    if (!def.values.includes(value)) {
      throw new AppError('bad_setting', `"${value}" is not a choice for ${key}.`);
    }
    next[key] = value;
  }
  ctx.db.prepare('UPDATE users SET settings_json = ? WHERE id = ?').run(JSON.stringify(next), userId);
  return next;
}

// Everything held about one member, as one JSON object they can download.
export function exportData(ctx, userId) {
  const user = getUser(ctx, userId);
  const all = (sql) => ctx.db.prepare(sql).all(userId);
  const one = (sql) => ctx.db.prepare(sql).get(userId) || null;
  record(ctx, { actorId: userId, action: 'account.data_exported', target: userId });
  return {
    exportedAt: iso(ctx),
    note: 'This is all the personal data Propertymaster holds for this account.',
    profile: user,
    consents: consentHistory(ctx, userId),
    subscription: one('SELECT tier, status, trial_ends_at, first_paid_at, current_period_end, cancel_at_period_end, cancelled_at, free_months_credit, created_at FROM subscriptions WHERE user_id = ?'),
    referralsMade: all('SELECT created_at, rewarded_at FROM referrals WHERE referrer_id = ?'),
    referredBy: one('SELECT created_at, rewarded_at FROM referrals WHERE referred_id = ?'),
    refunds: all('SELECT amount_pence, basis, reason, status, requested_at, decided_at FROM refunds WHERE user_id = ?'),
    lessonProgress: all('SELECT course_id, lesson_id, completed_at FROM lesson_progress WHERE user_id = ?'),
    quizAttempts: all('SELECT course_id, score, total, passed, at FROM quiz_attempts WHERE user_id = ?'),
    studioProjects: all('SELECT id, type, title, nation, inputs_json, created_at FROM studio_projects WHERE user_id = ?').map((p) => ({ ...p, inputs: JSON.parse(p.inputs_json), inputs_json: undefined })),
    activity: ctx.db.prepare('SELECT at, action, target FROM audit_log WHERE actor_id = ? ORDER BY id').all(userId),
    messagesAddressedToYou: all('SELECT kind, subject, created_at FROM outbox WHERE user_id = ?'),
  };
}

// Deletes the account. Personal data is erased: the email, name, password and
// settings are cleared, and sessions, tokens, messages, progress and projects are
// removed. What stays is a row with no personal data in it, so that the dated
// consent and audit records still point at something. Whether those records may
// be kept, and for how long, is to check at ico.org.uk before launch.
export function deleteAccount(ctx, userId, { password } = {}) {
  const row = getRow(ctx, userId);
  if (!verifyPassword(password, row.password_hash)) {
    throw new AppError('wrong_password', 'Your password is incorrect, so the account was not deleted.', 403);
  }
  if (row.role === 'owner') {
    const owners = ctx.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND deleted_at IS NULL").get().n;
    if (owners <= 1) {
      throw new AppError('last_owner', 'This is the only owner account. Make another owner first.');
    }
  }
  tx(ctx.db, () => {
    const now = iso(ctx);
    signOutEverywhere(ctx, userId);
    for (const table of ['sessions', 'email_tokens', 'outbox', 'lesson_progress', 'quiz_attempts', 'studio_projects']) {
      ctx.db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    }
    ctx.db.prepare('DELETE FROM login_failures WHERE email = ?').run(row.email);
    ctx.db
      .prepare("UPDATE subscriptions SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, ?), cancel_at_period_end = 1, updated_at = ? WHERE user_id = ?")
      .run(now, now, userId);
    ctx.db
      .prepare("UPDATE users SET email = NULL, password_hash = NULL, display_name = NULL, nation = NULL, settings_json = '{}', referral_code = NULL, email_verified_at = NULL, deleted_at = ? WHERE id = ?")
      .run(now, userId);
    record(ctx, { actorId: userId, action: 'account.deleted', target: userId });
  });
  return { deleted: true };
}

export function listMembers(ctx, { limit = 100 } = {}) {
  return ctx.db
    .prepare('SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?')
    .all(Math.max(1, Math.min(500, limit)))
    .map(publicUser);
}
