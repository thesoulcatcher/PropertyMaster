import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../src/core/context.js';
import * as auth from '../src/core/auth.js';
import * as account from '../src/core/account.js';
import * as audit from '../src/core/audit.js';
import * as consent from '../src/core/consent.js';
import * as roles from '../src/core/roles.js';
import * as compliance from '../src/core/compliance.js';
import { FLAGS } from '../src/config/flags.js';

// A controllable clock and a low scrypt cost keep the tests fast and repeatable.
function setup(start = '2026-11-17T09:00:00Z') {
  let now = new Date(start);
  const ctx = createContext({ now: () => now, config: { scryptCost: 2 ** 10 } });
  return { ctx, advance: (ms) => { now = new Date(now.getTime() + ms); } };
}

const PASSWORD = 'correct horse battery';
const CONSENTS = { terms: true, privacy: true };

function tokenFrom(ctx, email, kind) {
  const msg = auth.readOutbox(ctx, { toEmail: email }).find((m) => m.kind === kind);
  return msg.body.match(/token=([A-Za-z0-9_-]+)/)[1];
}

function member(ctx, email = 'example.member@example.com', extra = {}) {
  const r = auth.signUp(ctx, { email, password: PASSWORD, displayName: 'Example Member', consents: CONSENTS, ...extra });
  return r.userId;
}

test('sign-up needs terms and privacy consent, a valid email and a decent password', () => {
  const { ctx } = setup();
  assert.throws(() => auth.signUp(ctx, { email: 'a@example.com', password: PASSWORD, displayName: 'A', consents: { terms: true } }), /terms and the privacy notice/);
  assert.throws(() => auth.signUp(ctx, { email: 'not-an-email', password: PASSWORD, displayName: 'A', consents: CONSENTS }), /valid email/);
  assert.throws(() => auth.signUp(ctx, { email: 'a@example.com', password: 'short', displayName: 'A', consents: CONSENTS }), /at least 10/);
  assert.throws(() => auth.signUp(ctx, { email: 'a@example.com', password: 'aaaaaaaaaaaa', displayName: 'A', consents: CONSENTS }), /variety/);
  assert.throws(() => auth.signUp(ctx, { email: 'a@example.com', password: PASSWORD, displayName: '  ', consents: CONSENTS }), /name/);
});

test('sign-up cannot create staff accounts', () => {
  const { ctx } = setup();
  assert.throws(() => auth.signUp(ctx, { email: 'x@example.com', password: PASSWORD, displayName: 'X', consents: CONSENTS, accountType: 'owner' }), /Choose developer/);
  assert.throws(() => auth.signUp(ctx, { email: 'x@example.com', password: PASSWORD, displayName: 'X', consents: CONSENTS, accountType: 'admin' }), /Choose developer/);
});

test('a second sign-up with the same email gives the same reply and creates nothing', () => {
  const { ctx } = setup();
  const first = auth.signUp(ctx, { email: 'dup@example.com', password: PASSWORD, displayName: 'D', consents: CONSENTS });
  const second = auth.signUp(ctx, { email: ' DUP@example.com ', password: 'another password 1', displayName: 'E', consents: CONSENTS });
  assert.equal(first.status, second.status);
  assert.equal(second.created, false);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
});

test('passwords and tokens are never stored in plain text', () => {
  const { ctx } = setup();
  const id = member(ctx);
  const row = ctx.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id);
  assert.ok(!row.password_hash.includes(PASSWORD));
  assert.match(row.password_hash, /^scrypt\$/);
  const token = tokenFrom(ctx, 'example.member@example.com', 'verify_email');
  const stored = ctx.db.prepare('SELECT token_hash FROM email_tokens').all().map((r) => r.token_hash);
  assert.ok(!stored.includes(token));
});

test('email verification works once and expires after 24 hours', () => {
  const { ctx, advance } = setup();
  member(ctx, 'v1@example.com');
  const t1 = tokenFrom(ctx, 'v1@example.com', 'verify_email');
  auth.verifyEmail(ctx, t1);
  assert.throws(() => auth.verifyEmail(ctx, t1), /expired or has already been used/);

  member(ctx, 'v2@example.com');
  const t2 = tokenFrom(ctx, 'v2@example.com', 'verify_email');
  advance(25 * 3600000);
  assert.throws(() => auth.verifyEmail(ctx, t2), /expired/);
});

test('sign-in, session lookup and sign-out', () => {
  const { ctx } = setup();
  const id = member(ctx);
  const { token, user } = auth.signIn(ctx, { email: 'EXAMPLE.member@example.com', password: PASSWORD });
  assert.equal(user.id, id);
  assert.equal(auth.getSessionUser(ctx, token).id, id);
  auth.signOut(ctx, token);
  assert.equal(auth.getSessionUser(ctx, token), null);
});

test('a wrong password and an unknown email give the same message', () => {
  const { ctx } = setup();
  member(ctx);
  const a = assert.throws(() => auth.signIn(ctx, { email: 'example.member@example.com', password: 'wrong password here' }), /Email or password is incorrect/);
  assert.throws(() => auth.signIn(ctx, { email: 'nobody@example.com', password: PASSWORD }), /Email or password is incorrect/);
  return a;
});

test('five failures lock sign-in for 15 minutes, then it opens again', () => {
  const { ctx, advance } = setup();
  member(ctx);
  for (let i = 0; i < 5; i += 1) {
    assert.throws(() => auth.signIn(ctx, { email: 'example.member@example.com', password: 'wrong password here' }));
  }
  assert.throws(() => auth.signIn(ctx, { email: 'example.member@example.com', password: PASSWORD }), /Too many attempts/);
  advance(16 * 60000);
  assert.ok(auth.signIn(ctx, { email: 'example.member@example.com', password: PASSWORD }).token);
});

test('sessions expire after 30 days', () => {
  const { ctx, advance } = setup();
  member(ctx);
  const { token } = auth.signIn(ctx, { email: 'example.member@example.com', password: PASSWORD });
  advance(31 * 86400000);
  assert.equal(auth.getSessionUser(ctx, token), null);
});

test('password reset changes the password and signs out every session', () => {
  const { ctx } = setup();
  member(ctx);
  const { token: session } = auth.signIn(ctx, { email: 'example.member@example.com', password: PASSWORD });
  auth.requestPasswordReset(ctx, 'example.member@example.com');
  const reset = tokenFrom(ctx, 'example.member@example.com', 'reset_password');
  auth.resetPassword(ctx, reset, 'a brand new password');
  assert.equal(auth.getSessionUser(ctx, session), null);
  assert.ok(auth.signIn(ctx, { email: 'example.member@example.com', password: 'a brand new password' }).token);
  assert.throws(() => auth.signIn(ctx, { email: 'example.member@example.com', password: PASSWORD }));
  // A reset request for an unknown email says the same and writes nothing.
  const before = auth.readOutbox(ctx).length;
  assert.equal(auth.requestPasswordReset(ctx, 'nobody@example.com').status, 'check_email');
  assert.equal(auth.readOutbox(ctx).length, before);
});

test('roles: members and agents land in their own sections', () => {
  const { ctx } = setup();
  member(ctx, 'dev@example.com');
  member(ctx, 'agent@example.com', { accountType: 'estate_agent' });
  const dev = auth.signIn(ctx, { email: 'dev@example.com', password: PASSWORD }).user;
  const agent = auth.signIn(ctx, { email: 'agent@example.com', password: PASSWORD }).user;
  assert.deepEqual(roles.sectionsFor(dev), ['developer']);
  assert.deepEqual(roles.sectionsFor(agent), ['estate_agent']);
  assert.equal(roles.homeSection(agent), 'estate_agent');
  assert.equal(roles.can(dev, 'admin.audit.read'), false);
});

test('roles: only an owner can make staff, and the last owner cannot be removed', () => {
  const { ctx } = setup();
  const owner = auth.createStaff(ctx, { email: 'owner@example.com', password: PASSWORD, displayName: 'Example Owner', role: 'owner' });
  const admin = auth.createStaff(ctx, { email: 'admin@example.com', password: PASSWORD, displayName: 'Example Admin', role: 'admin' });
  const id = member(ctx);
  assert.throws(() => roles.setRole(ctx, admin, id, 'admin'), /does not have access/);
  roles.setRole(ctx, admin, id, 'estate_agent');
  roles.setRole(ctx, owner, id, 'admin');
  assert.throws(() => roles.setRole(ctx, owner, owner.id, 'member'), /at least one owner/);
  const entries = audit.list(ctx, { action: 'role.set' });
  assert.equal(entries.length, 2);
});

test('the audit log is append-only', () => {
  const { ctx } = setup();
  member(ctx);
  assert.throws(() => ctx.db.exec("UPDATE audit_log SET action = 'x'"), /append-only/);
  assert.throws(() => ctx.db.exec('DELETE FROM audit_log'), /append-only/);
});

test('consent: optional consents default to off and every change is a new dated row', () => {
  const { ctx, advance } = setup();
  const id = member(ctx);
  let c = consent.currentConsents(ctx, id);
  assert.equal(c.terms.granted, true);
  assert.equal(c.marketing_email.granted, false);
  assert.equal(c.analytics.granted, false);
  advance(1000);
  consent.setOptionalConsent(ctx, id, 'marketing_email', true);
  advance(1000);
  c = consent.setOptionalConsent(ctx, id, 'marketing_email', false);
  assert.equal(c.marketing_email.granted, false);
  assert.equal(consent.consentHistory(ctx, id).filter((r) => r.kind === 'marketing_email').length, 3);
  assert.throws(() => consent.setOptionalConsent(ctx, id, 'terms', false), /delete your account/);
});

test('profile and settings accept only known values', () => {
  const { ctx } = setup();
  const id = member(ctx);
  assert.equal(account.updateProfile(ctx, id, { nation: 'scotland' }).nation, 'scotland');
  assert.throws(() => account.updateProfile(ctx, id, { nation: 'france' }), /Choose Scotland/);
  assert.equal(account.updateSettings(ctx, id, { theme: 'dark' }).theme, 'dark');
  assert.throws(() => account.updateSettings(ctx, id, { theme: 'purple' }), /not a choice/);
  assert.throws(() => account.updateSettings(ctx, id, { tracking: true }), /Unknown setting/);
});

test('data export holds the profile, consents and activity, and no password', () => {
  const { ctx } = setup();
  const id = member(ctx);
  const data = account.exportData(ctx, id);
  assert.equal(data.profile.email, 'example.member@example.com');
  assert.ok(data.consents.length >= 3);
  assert.ok(data.activity.some((a) => a.action === 'account.created'));
  assert.ok(!JSON.stringify(data).includes('scrypt$'));
});

test('account deletion needs the password and erases personal data', () => {
  const { ctx } = setup();
  const id = member(ctx);
  const { token } = auth.signIn(ctx, { email: 'example.member@example.com', password: PASSWORD });
  assert.throws(() => account.deleteAccount(ctx, id, { password: 'wrong password here' }), /not deleted/);
  account.deleteAccount(ctx, id, { password: PASSWORD });
  const row = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  assert.equal(row.email, null);
  assert.equal(row.display_name, null);
  assert.equal(row.password_hash, null);
  assert.ok(row.deleted_at);
  assert.equal(auth.getSessionUser(ctx, token), null);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM outbox WHERE user_id = ?').get(id).n, 0);
  // The email can be used again for a fresh account.
  assert.equal(auth.signUp(ctx, { email: 'example.member@example.com', password: PASSWORD, displayName: 'New', consents: CONSENTS }).created, true);
});

test('every flag starts off and carries a plain gate message', () => {
  const { ctx } = setup();
  for (const f of compliance.listFlags(ctx)) {
    assert.equal(f.on, false, f.name);
    assert.equal(f.message, compliance.GATE_MESSAGE);
    assert.ok(f.label.startsWith('Gated: '));
  }
  assert.equal(compliance.listFlags(ctx).length, Object.keys(FLAGS).length);
});

test('a flag cannot be switched on without its recorded sign-off', () => {
  const { ctx } = setup();
  const owner = auth.createStaff(ctx, { email: 'owner@example.com', password: PASSWORD, displayName: 'Example Owner', role: 'owner' });
  const admin = auth.createStaff(ctx, { email: 'admin@example.com', password: PASSWORD, displayName: 'Example Admin', role: 'admin' });
  assert.throws(() => compliance.setFlag(ctx, admin, 'lettingsModule', true), /does not have access/);
  assert.throws(() => compliance.setFlag(ctx, owner, 'lettingsModule', true), /cannot be switched on until its sign-off/);
  // A sign-off for the wrong row does not open it.
  const wrong = compliance.recordSignoff(ctx, owner, { row: 2, flag: 'lettingsModule', professionalName: 'Example Solicitor', professionalRole: 'Solicitor', reference: 'EXAMPLE-1', signedOn: '2026-11-16' });
  assert.throws(() => compliance.setFlag(ctx, owner, 'lettingsModule', true, { signoffId: wrong.id }), /sign-off/);
  const right = compliance.recordSignoff(ctx, owner, { row: 7, flag: 'lettingsModule', professionalName: 'Example Adviser', professionalRole: 'Compliance adviser', reference: 'EXAMPLE-2', signedOn: '2026-11-16' });
  compliance.setFlag(ctx, owner, 'lettingsModule', true, { signoffId: right.id });
  assert.equal(compliance.flagOn(ctx, 'lettingsModule'), true);
  compliance.setFlag(ctx, owner, 'lettingsModule', false);
  assert.throws(() => compliance.requireFlag(ctx, 'lettingsModule'), /needs sign-off before it opens/);
});

test('a sign-off needs the professional, a reference and a past date', () => {
  const { ctx } = setup();
  const owner = auth.createStaff(ctx, { email: 'owner@example.com', password: PASSWORD, displayName: 'Example Owner', role: 'owner' });
  assert.throws(() => compliance.recordSignoff(ctx, owner, { row: 7, professionalName: '', professionalRole: 'x', reference: 'y', signedOn: '2026-11-16' }), /needs the professional/);
  assert.throws(() => compliance.recordSignoff(ctx, owner, { row: 7, professionalName: 'a', professionalRole: 'b', reference: 'c', signedOn: '2027-01-01' }), /today or earlier/);
  assert.throws(() => compliance.recordSignoff(ctx, owner, { row: 99, professionalName: 'a', professionalRole: 'b', reference: 'c', signedOn: '2026-11-16' }), /register/);
});

test('the compliance register has all fourteen rows', () => {
  assert.deepEqual(compliance.COMPLIANCE_ROWS.map((r) => r.row), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  for (const name of Object.keys(FLAGS)) {
    assert.ok(name in compliance.FLAG_ROWS, `${name} has a register row (or null)`);
  }
});
