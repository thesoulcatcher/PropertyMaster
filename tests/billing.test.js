import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../src/core/context.js';
import * as auth from '../src/core/auth.js';
import * as billing from '../src/core/billing.js';
import { TIERS, tiersFor } from '../src/config/plans.js';

const PASSWORD = 'correct horse battery';
const DAY = 86400000;

function setup(start = '2026-11-17T09:00:00Z') {
  let now = new Date(start);
  const ctx = createContext({ now: () => now, config: { scryptCost: 2 ** 10 } });
  const user = (email, extra = {}) =>
    auth.signUp(ctx, { email, password: PASSWORD, displayName: 'Example', consents: { terms: true, privacy: true }, ...extra }).userId;
  const admin = auth.createStaff(ctx, { email: 'admin@example.com', password: PASSWORD, displayName: 'Example Admin', role: 'admin' });
  return { ctx, user, admin, advance: (ms) => { now = new Date(now.getTime() + ms); } };
}

function pay(ctx, userId, ref, amountPence = 1000) {
  return billing.recordPayment(ctx, { userId, tier: 'propertymaster', amountPence, providerRef: ref });
}

test('the trial lasts 14 days by default and runs once per account', () => {
  const { ctx, user, advance } = setup();
  const id = user('t@example.com');
  const s = billing.startTrial(ctx, id);
  assert.equal(s.state, 'trialing');
  assert.equal(s.daysLeft, 14);
  advance(5 * DAY);
  assert.equal(billing.startTrial(ctx, id).daysLeft, 9, 'a second start does not reset the trial');
  advance(10 * DAY);
  const ended = billing.subscriptionStatus(ctx, id);
  assert.equal(ended.state, 'trial_ended');
  assert.equal(ended.access, false);
});

test('trial length comes from config', () => {
  let now = new Date('2026-11-17T09:00:00Z');
  const ctx = createContext({ now: () => now, config: { scryptCost: 2 ** 10, trialDays: 7 } });
  const id = auth.signUp(ctx, { email: 'c@example.com', password: PASSWORD, displayName: 'C', consents: { terms: true, privacy: true } }).userId;
  assert.equal(billing.startTrial(ctx, id).daysLeft, 7);
});

test('no plan can be bought while prices are unset and paid plans are gated', () => {
  const { ctx, user } = setup();
  const id = user('buy@example.com');
  for (const t of Object.values(TIERS)) assert.equal(t.pricePenceMonthly, null);
  const a = billing.checkoutAvailability(ctx, id, 'propertymaster');
  assert.equal(a.available, false);
  assert.match(a.reason, /price for this plan has not been set/);
  assert.throws(() => billing.checkoutAvailability(ctx, id, 'gold'), /does not exist/);
});

test('an estate agent cannot buy a developer plan', () => {
  const { ctx, user } = setup();
  const id = user('agent@example.com', { accountType: 'estate_agent' });
  assert.match(billing.checkoutAvailability(ctx, id, 'propertymaster').reason, /other section/);
  assert.equal(tiersFor('estate_agent').length, 2);
});

test('a confirmed payment starts a month, and a repeated event changes nothing', () => {
  const { ctx, user } = setup();
  const id = user('p@example.com');
  billing.startTrial(ctx, id);
  const r = pay(ctx, id, 'example-ref-1');
  assert.equal(r.status.state, 'active');
  assert.equal(r.status.currentPeriodEnd.slice(0, 10), '2026-12-17');
  assert.equal(pay(ctx, id, 'example-ref-1').duplicate, true);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM payments').get().n, 1);
});

test('payments refuse zero, negative, fractional and absurd amounts', () => {
  const { ctx, user } = setup();
  const id = user('bad@example.com');
  for (const amountPence of [0, -100, 10.5, NaN, null, 1e12]) {
    assert.throws(() => billing.recordPayment(ctx, { userId: id, tier: 'propertymaster', amountPence, providerRef: `r-${amountPence}` }), /whole number of pence/);
  }
});

test('recommend a friend: one free month each, once, on the first payment', () => {
  const { ctx, user, advance } = setup();
  const referrer = user('ref@example.com');
  const friend = user('friend@example.com');
  billing.startTrial(ctx, referrer);
  pay(ctx, referrer, 'ref-pay-1');
  const code = ctx.db.prepare('SELECT referral_code FROM users WHERE id = ?').get(referrer).referral_code;

  assert.throws(() => billing.applyReferralCode(ctx, referrer, code), /own code/);
  billing.applyReferralCode(ctx, friend, code.toLowerCase());
  assert.throws(() => billing.applyReferralCode(ctx, friend, code), /already recorded/);

  // Nothing is given until the friend pays.
  assert.equal(billing.subscriptionStatus(ctx, referrer).freeMonthsCredit, 0);
  pay(ctx, friend, 'friend-pay-1');
  assert.equal(billing.subscriptionStatus(ctx, referrer).freeMonthsCredit, 1);
  assert.equal(billing.subscriptionStatus(ctx, friend).freeMonthsCredit, 1);

  // A second payment by the friend gives nothing more.
  advance(31 * DAY);
  pay(ctx, friend, 'friend-pay-2');
  assert.equal(billing.subscriptionStatus(ctx, referrer).freeMonthsCredit, 1);
});

test('a free month is used at the end of a paid period before any payment is due', () => {
  const { ctx, user, advance } = setup();
  const referrer = user('r2@example.com');
  const friend = user('f2@example.com');
  pay(ctx, referrer, 'r2-1');
  billing.applyReferralCode(ctx, friend, ctx.db.prepare('SELECT referral_code FROM users WHERE id = ?').get(referrer).referral_code);
  pay(ctx, friend, 'f2-1');
  advance(31 * DAY);
  assert.equal(billing.settlePeriodEnd(ctx, referrer).result, 'extended');
  assert.equal(billing.subscriptionStatus(ctx, referrer).state, 'active');
  advance(31 * DAY);
  assert.equal(billing.settlePeriodEnd(ctx, referrer).result, 'payment_due');
  assert.equal(billing.subscriptionStatus(ctx, referrer).access, false);
});

test('a code cannot be added after the first payment', () => {
  const { ctx, user } = setup();
  const a = user('a@example.com');
  const b = user('b@example.com');
  pay(ctx, b, 'b-1');
  const code = ctx.db.prepare('SELECT referral_code FROM users WHERE id = ?').get(a).referral_code;
  assert.throws(() => billing.applyReferralCode(ctx, b, code), /before the first payment/);
  assert.throws(() => billing.applyReferralCode(ctx, b, 'NOPE'), /not found/);
});

test('cancel is one step, keeps access to the end of the period, and can be undone', () => {
  const { ctx, user, advance } = setup();
  const id = user('c2@example.com');
  pay(ctx, id, 'c2-1');
  const c = billing.cancel(ctx, id);
  assert.equal(c.state, 'cancelling');
  assert.equal(c.access, true);
  assert.equal(billing.resume(ctx, id).state, 'active');
  billing.cancel(ctx, id);
  advance(31 * DAY);
  assert.equal(billing.settlePeriodEnd(ctx, id).result, 'ended');
  assert.equal(billing.subscriptionStatus(ctx, id).state, 'cancelled');
});

test('cancelling a trial means no charge and access until the trial ends', () => {
  const { ctx, user } = setup();
  const id = user('tc@example.com');
  billing.startTrial(ctx, id);
  const c = billing.cancel(ctx, id);
  assert.equal(c.state, 'trial_cancelled');
  assert.match(c.message, /will not be charged/);
});

test('a refund within the cooling-off period is marked so, later ones are discretionary', () => {
  const { ctx, user, admin, advance } = setup();
  const early = user('early@example.com');
  pay(ctx, early, 'e-1', 1999);
  const r1 = billing.requestRefund(ctx, early, { reason: 'Not for me' });
  assert.equal(r1.basis, 'cooling_off');
  assert.equal(r1.amountPence, 1999);
  assert.throws(() => billing.requestRefund(ctx, early), /already with the team/);

  const late = user('late@example.com');
  pay(ctx, late, 'l-1', 1999);
  advance(15 * DAY);
  assert.equal(billing.requestRefund(ctx, late).basis, 'discretionary');

  const member = auth.signIn(ctx, { email: 'late@example.com', password: PASSWORD }).user;
  assert.throws(() => billing.decideRefund(ctx, member, r1.id, { approve: true }), /does not have access/);
  assert.throws(() => billing.decideRefund(ctx, admin, r1.id, { approve: true, amountPence: 5000 }), /no more than the payment/);
  const done = billing.decideRefund(ctx, admin, r1.id, { approve: true });
  assert.equal(done.status, 'approved');
  assert.equal(billing.subscriptionStatus(ctx, early).access, false);

  const summary = billing.revenueSummary(ctx, admin);
  assert.equal(summary.paymentsPence, 3998);
  assert.equal(summary.refundsPence, 1999);
  assert.equal(summary.netPence, 1999);
});

test('no refund without a payment', () => {
  const { ctx, user } = setup();
  const id = user('np@example.com');
  billing.startTrial(ctx, id);
  assert.throws(() => billing.requestRefund(ctx, id), /No payment/);
});

test('trial reminders are written once, three days before the end, and never sent', () => {
  const { ctx, user, advance } = setup();
  const id = user('rem@example.com');
  billing.startTrial(ctx, id);
  assert.equal(billing.trialReminders(ctx).written, 0);
  advance(11.5 * DAY);
  assert.equal(billing.trialReminders(ctx).written, 1);
  assert.equal(billing.trialReminders(ctx).written, 0);
  const msg = auth.readOutbox(ctx, { toEmail: 'rem@example.com' }).find((m) => m.kind === 'trial_ending');
  assert.match(msg.body, /will not be charged unless you choose a plan/);
});
