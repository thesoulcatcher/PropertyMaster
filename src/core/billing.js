// Module 2: pay and trial.
//
//   Trial       one free trial per account, length set in config (default 14 days)
//   Tiers       defined in src/config/plans.js; prices are null until the owner sets them
//   Paying      off: the paidSubscriptions flag is gated (compliance row 9), and no
//               payment provider is connected. The provider's confirmed payment event
//               calls recordPayment(); nothing here takes money.
//   Referral    the referrer and the friend each get one free month, once per
//               referred account, when the friend makes their first payment
//   Cancel      one step, any time; access runs to the end of the paid period or trial
//   Refunds     a full refund can be asked for within the cooling-off period after
//               the first payment; any other refund is an admin's decision
//
// Every money decision is written to the audit log.

import { AppError, iso, newId, addDays, addMonths } from './context.js';
import { tx } from './db.js';
import { record } from './audit.js';
import { requirePermission } from './roles.js';
import { flagOn, GATE_MESSAGE } from './compliance.js';
import { TIERS, REFERRAL } from '../config/plans.js';

function sub(ctx, userId) {
  return ctx.db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) || null;
}

function userExists(ctx, userId) {
  return Boolean(ctx.db.prepare('SELECT 1 FROM users WHERE id = ? AND deleted_at IS NULL').get(userId));
}

// Starts the free trial. Once per account: a second call returns the existing one.
export function startTrial(ctx, userId) {
  if (!userExists(ctx, userId)) {
    throw new AppError('not_found', 'That account was not found.', 404);
  }
  const existing = sub(ctx, userId);
  if (existing) {
    return subscriptionStatus(ctx, userId);
  }
  const now = iso(ctx);
  const ends = addDays(ctx.now(), ctx.config.trialDays).toISOString();
  ctx.db
    .prepare("INSERT INTO subscriptions (user_id, status, trial_ends_at, created_at, updated_at) VALUES (?, 'trialing', ?, ?, ?)")
    .run(userId, ends, now, now);
  record(ctx, { actorId: userId, action: 'billing.trial_started', target: userId, detail: { trialEndsAt: ends, days: ctx.config.trialDays } });
  return subscriptionStatus(ctx, userId);
}

// What the member has right now, worked out from the dates. The stored status is
// what the provider last confirmed; access depends on the dates as well.
export function subscriptionStatus(ctx, userId) {
  const s = sub(ctx, userId);
  const now = iso(ctx);
  if (!s) {
    return { state: 'none', access: false, message: 'No trial or plan yet.' };
  }
  const base = {
    tier: s.tier,
    trialEndsAt: s.trial_ends_at,
    currentPeriodEnd: s.current_period_end,
    cancelAtPeriodEnd: s.cancel_at_period_end === 1,
    freeMonthsCredit: s.free_months_credit,
  };
  if (!s.first_paid_at) {
    const inTrial = s.trial_ends_at > now && s.status !== 'cancelled';
    if (s.status === 'cancelled' && s.trial_ends_at > now) {
      return { ...base, state: 'trial_cancelled', access: true, message: `Your trial is cancelled. You keep access until ${s.trial_ends_at.slice(0, 10)} and you will not be charged.` };
    }
    return inTrial
      ? { ...base, state: 'trialing', access: true, daysLeft: Math.ceil((Date.parse(s.trial_ends_at) - ctx.now().getTime()) / 86400000), message: `Free trial until ${s.trial_ends_at.slice(0, 10)}.` }
      : { ...base, state: 'trial_ended', access: false, message: 'Your free trial has ended. Choose a plan to carry on.' };
  }
  if (s.current_period_end > now) {
    return s.cancel_at_period_end === 1
      ? { ...base, state: 'cancelling', access: true, message: `Cancelled. You keep access until ${s.current_period_end.slice(0, 10)} and will not be charged again.` }
      : { ...base, state: 'active', access: true, message: `Active until ${s.current_period_end.slice(0, 10)}, then renews.` };
  }
  if (s.cancel_at_period_end === 1 || s.status === 'cancelled') {
    return { ...base, state: 'cancelled', access: false, message: 'Your plan has ended.' };
  }
  return { ...base, state: 'payment_due', access: false, message: 'Your renewal payment is due.' };
}

// Can this member buy this tier today? Returns the reason in plain words when not.
export function checkoutAvailability(ctx, userId, tierId) {
  const tier = TIERS[tierId];
  if (!tier) {
    throw new AppError('bad_tier', 'That plan does not exist.');
  }
  const user = ctx.db.prepare('SELECT role FROM users WHERE id = ? AND deleted_at IS NULL').get(userId);
  if (!user) {
    throw new AppError('not_found', 'That account was not found.', 404);
  }
  const audience = user.role === 'estate_agent' ? 'estate_agent' : 'member';
  if (tier.audience !== audience && user.role !== 'owner' && user.role !== 'admin') {
    return { available: false, reason: 'This plan is for the other section of Propertymaster.' };
  }
  if (tier.pricePenceMonthly === null) {
    return { available: false, reason: 'The price for this plan has not been set yet.' };
  }
  if (!flagOn(ctx, 'paidSubscriptions')) {
    return { available: false, reason: GATE_MESSAGE };
  }
  return { available: true, tier: tierId, pricePenceMonthly: tier.pricePenceMonthly };
}

// Called only by the payment provider's confirmed payment event (once connected).
// Idempotent on the provider reference, so a repeated event changes nothing.
export function recordPayment(ctx, { userId, tier: tierId, amountPence, providerRef }) {
  if (!TIERS[tierId]) {
    throw new AppError('bad_tier', 'That plan does not exist.');
  }
  if (!Number.isInteger(amountPence) || amountPence <= 0 || amountPence > 10_000_000) {
    throw new AppError('bad_amount', 'A payment must be a whole number of pence above zero.');
  }
  if (!providerRef) {
    throw new AppError('bad_payment', 'A payment needs the provider reference.');
  }
  if (ctx.db.prepare('SELECT 1 FROM payments WHERE provider_ref = ?').get(providerRef)) {
    return { duplicate: true, status: subscriptionStatus(ctx, userId) };
  }
  if (!sub(ctx, userId)) {
    startTrial(ctx, userId);
  }
  return tx(ctx.db, () => {
    const s = sub(ctx, userId);
    const now = iso(ctx);
    const firstPayment = !s.first_paid_at;
    const from = s.current_period_end && s.current_period_end > now ? new Date(s.current_period_end) : ctx.now();
    const periodEnd = addMonths(from, 1).toISOString();
    ctx.db.prepare('INSERT INTO payments (id, user_id, tier, amount_pence, provider_ref, at) VALUES (?, ?, ?, ?, ?, ?)').run(newId(), userId, tierId, amountPence, providerRef, now);
    ctx.db
      .prepare("UPDATE subscriptions SET tier = ?, status = 'active', first_paid_at = COALESCE(first_paid_at, ?), current_period_end = ?, cancel_at_period_end = 0, cancelled_at = NULL, updated_at = ? WHERE user_id = ?")
      .run(tierId, now, periodEnd, now, userId);
    record(ctx, { actorId: userId, action: 'billing.payment_recorded', target: userId, detail: { tier: tierId, amountPence, providerRef, periodEnd } });
    if (firstPayment) {
      rewardReferral(ctx, userId);
    }
    return { duplicate: false, status: subscriptionStatus(ctx, userId) };
  });
}

// At the end of a paid period: a free month is used first, if there is one.
// Returns 'extended' when a free month was used, otherwise 'payment_due'.
export function settlePeriodEnd(ctx, userId) {
  const s = sub(ctx, userId);
  if (!s || !s.first_paid_at || s.current_period_end > iso(ctx)) {
    return { result: 'not_due' };
  }
  if (s.cancel_at_period_end === 1) {
    ctx.db.prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE user_id = ?").run(iso(ctx), userId);
    return { result: 'ended' };
  }
  if (s.free_months_credit > 0) {
    const periodEnd = addMonths(new Date(s.current_period_end), 1).toISOString();
    ctx.db
      .prepare('UPDATE subscriptions SET free_months_credit = free_months_credit - 1, current_period_end = ?, updated_at = ? WHERE user_id = ?')
      .run(periodEnd, iso(ctx), userId);
    record(ctx, { actorId: null, action: 'billing.free_month_used', target: userId, detail: { periodEnd } });
    return { result: 'extended', currentPeriodEnd: periodEnd };
  }
  return { result: 'payment_due' };
}

// One step, at any time. Nothing more is charged; access runs to the end of what
// was already paid for, or to the end of the trial.
export function cancel(ctx, userId) {
  const s = sub(ctx, userId);
  if (!s) {
    throw new AppError('no_plan', 'There is no trial or plan to cancel.');
  }
  const now = iso(ctx);
  if (!s.first_paid_at) {
    ctx.db.prepare("UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE user_id = ?").run(now, now, userId);
  } else {
    ctx.db.prepare('UPDATE subscriptions SET cancel_at_period_end = 1, cancelled_at = ?, updated_at = ? WHERE user_id = ?').run(now, now, userId);
  }
  record(ctx, { actorId: userId, action: 'billing.cancelled', target: userId });
  return subscriptionStatus(ctx, userId);
}

// Undo a cancellation before the period ends.
export function resume(ctx, userId) {
  const s = sub(ctx, userId);
  const status = subscriptionStatus(ctx, userId);
  if (!s || !['cancelling', 'trial_cancelled'].includes(status.state)) {
    throw new AppError('cannot_resume', 'There is nothing to resume.');
  }
  ctx.db
    .prepare("UPDATE subscriptions SET cancel_at_period_end = 0, cancelled_at = NULL, status = CASE WHEN first_paid_at IS NULL THEN 'trialing' ELSE 'active' END, updated_at = ? WHERE user_id = ?")
    .run(iso(ctx), userId);
  record(ctx, { actorId: userId, action: 'billing.resumed', target: userId });
  return subscriptionStatus(ctx, userId);
}

// Writes a reminder to the outbox (never sent from here) three days before a trial
// ends, once per trial, so no member is charged without notice.
export function trialReminders(ctx, { daysBefore = 3 } = {}) {
  const now = iso(ctx);
  const horizon = addDays(ctx.now(), daysBefore).toISOString();
  const due = ctx.db
    .prepare(
      `SELECT s.user_id, s.trial_ends_at, u.email FROM subscriptions s JOIN users u ON u.id = s.user_id
       WHERE s.first_paid_at IS NULL AND s.status = 'trialing' AND s.trial_ends_at > ? AND s.trial_ends_at <= ? AND u.deleted_at IS NULL`,
    )
    .all(now, horizon);
  let written = 0;
  for (const row of due) {
    const key = row.trial_ends_at.slice(0, 10);
    const already = ctx.db.prepare("SELECT 1 FROM notices_sent WHERE user_id = ? AND kind = 'trial_ending' AND period_key = ?").get(row.user_id, key);
    if (already) continue;
    tx(ctx.db, () => {
      ctx.db.prepare("INSERT INTO notices_sent (user_id, kind, period_key, at) VALUES (?, 'trial_ending', ?, ?)").run(row.user_id, key, now);
      ctx.db
        .prepare("INSERT INTO outbox (id, user_id, to_email, kind, subject, body, created_at) VALUES (?, ?, ?, 'trial_ending', ?, ?, ?)")
        .run(
          newId(),
          row.user_id,
          row.email,
          'Your Propertymaster free trial ends soon',
          `Your free trial ends on ${key}. You will not be charged unless you choose a plan. You can cancel in one step in Settings, Plan.`,
          now,
        );
    });
    written += 1;
  }
  return { written };
}

// ---------- Recommend a friend ----------

// The friend enters the code at sign-up or before their first payment.
export function applyReferralCode(ctx, friendId, code) {
  const clean = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!clean) {
    throw new AppError('bad_code', 'Enter the code your friend gave you.');
  }
  const referrer = ctx.db.prepare('SELECT id FROM users WHERE referral_code = ? AND deleted_at IS NULL').get(clean);
  if (!referrer) {
    throw new AppError('bad_code', 'That code was not found. Check it with your friend.');
  }
  if (referrer.id === friendId) {
    throw new AppError('own_code', 'You cannot use your own code.');
  }
  if (ctx.db.prepare('SELECT 1 FROM referrals WHERE referred_id = ?').get(friendId)) {
    throw new AppError('already_referred', 'A recommendation is already recorded for this account.');
  }
  const s = sub(ctx, friendId);
  if (s && s.first_paid_at) {
    throw new AppError('too_late', 'A code can only be added before the first payment.');
  }
  ctx.db.prepare('INSERT INTO referrals (id, referrer_id, referred_id, created_at) VALUES (?, ?, ?, ?)').run(newId(), referrer.id, friendId, iso(ctx));
  record(ctx, { actorId: friendId, action: 'referral.recorded', target: referrer.id });
  return { recorded: true, reward: `You and your friend each get ${REFERRAL.freeMonthsEach} free month when you make your first payment.` };
}

function rewardReferral(ctx, friendId) {
  const ref = ctx.db.prepare('SELECT * FROM referrals WHERE referred_id = ? AND rewarded_at IS NULL').get(friendId);
  if (!ref) return false;
  const referrerActive = ctx.db.prepare('SELECT 1 FROM users WHERE id = ? AND deleted_at IS NULL').get(ref.referrer_id);
  const now = iso(ctx);
  ctx.db.prepare('UPDATE referrals SET rewarded_at = ? WHERE id = ?').run(now, ref.id);
  const add = (uid) => {
    if (!sub(ctx, uid)) startTrial(ctx, uid);
    ctx.db.prepare('UPDATE subscriptions SET free_months_credit = free_months_credit + ?, updated_at = ? WHERE user_id = ?').run(REFERRAL.freeMonthsEach, now, uid);
  };
  add(friendId);
  if (referrerActive) add(ref.referrer_id);
  record(ctx, { actorId: null, action: 'referral.rewarded', target: ref.id, detail: { friendId, referrerId: ref.referrer_id, months: REFERRAL.freeMonthsEach } });
  return true;
}

// ---------- Refunds ----------

export function requestRefund(ctx, userId, { reason = '' } = {}) {
  const s = sub(ctx, userId);
  if (!s || !s.first_paid_at) {
    throw new AppError('nothing_to_refund', 'No payment has been made on this account.');
  }
  if (ctx.db.prepare("SELECT 1 FROM refunds WHERE user_id = ? AND status = 'pending'").get(userId)) {
    throw new AppError('already_pending', 'A refund request is already with the team.');
  }
  const last = ctx.db.prepare('SELECT amount_pence, at FROM payments WHERE user_id = ? ORDER BY at DESC, rowid DESC LIMIT 1').get(userId);
  const coolingOffEnds = addDays(new Date(s.first_paid_at), ctx.config.coolingOffDays).toISOString();
  const inCoolingOff = iso(ctx) <= coolingOffEnds;
  const id = newId();
  ctx.db
    .prepare("INSERT INTO refunds (id, user_id, amount_pence, basis, reason, status, requested_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)")
    .run(id, userId, last ? last.amount_pence : null, inCoolingOff ? 'cooling_off' : 'discretionary', String(reason).slice(0, 1000), iso(ctx));
  record(ctx, { actorId: userId, action: 'billing.refund_requested', target: id, detail: { basis: inCoolingOff ? 'cooling_off' : 'discretionary' } });
  return {
    id,
    basis: inCoolingOff ? 'cooling_off' : 'discretionary',
    amountPence: last ? last.amount_pence : null,
    message: inCoolingOff
      ? 'You asked within the cooling-off period. The team will review and confirm your refund.'
      : 'The cooling-off period has passed, so the team will look at your request and reply.',
  };
}

// An admin approves or declines. Approving cancels the plan at once. The money
// itself is returned through the payment provider by hand until one is connected.
export function decideRefund(ctx, admin, refundId, { approve, amountPence = null }) {
  requirePermission(admin, 'admin.refunds.decide');
  const r = ctx.db.prepare("SELECT * FROM refunds WHERE id = ? AND status = 'pending'").get(refundId);
  if (!r) {
    throw new AppError('not_found', 'No pending refund with that reference.', 404);
  }
  const amount = amountPence === null ? r.amount_pence : amountPence;
  if (approve && (!Number.isInteger(amount) || amount <= 0 || (r.amount_pence !== null && amount > r.amount_pence))) {
    throw new AppError('bad_amount', 'A refund must be a whole number of pence, above zero and no more than the payment.');
  }
  return tx(ctx.db, () => {
    const now = iso(ctx);
    ctx.db.prepare('UPDATE refunds SET status = ?, amount_pence = ?, decided_at = ?, decided_by = ? WHERE id = ?').run(approve ? 'approved' : 'declined', approve ? amount : r.amount_pence, now, admin.id, refundId);
    if (approve) {
      ctx.db.prepare("UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = 1, cancelled_at = COALESCE(cancelled_at, ?), current_period_end = ?, updated_at = ? WHERE user_id = ?").run(now, now, now, r.user_id);
    }
    record(ctx, { actorId: admin.id, action: approve ? 'billing.refund_approved' : 'billing.refund_declined', target: refundId, detail: { amountPence: approve ? amount : null } });
    return { id: refundId, status: approve ? 'approved' : 'declined', amountPence: approve ? amount : null };
  });
}

// For the admin revenue summary: money in, refunds approved, net. Pence.
export function revenueSummary(ctx, admin) {
  requirePermission(admin, 'admin.members.read');
  const paid = ctx.db.prepare('SELECT COALESCE(SUM(amount_pence), 0) AS p, COUNT(*) AS n FROM payments').get();
  const refunded = ctx.db.prepare("SELECT COALESCE(SUM(amount_pence), 0) AS p FROM refunds WHERE status = 'approved'").get();
  const counts = Object.fromEntries(
    ctx.db.prepare("SELECT status, COUNT(*) AS n FROM subscriptions GROUP BY status").all().map((r) => [r.status, r.n]),
  );
  const referrals = ctx.db.prepare('SELECT COUNT(*) AS made, COUNT(rewarded_at) AS rewarded FROM referrals').get();
  return {
    paymentsPence: paid.p,
    paymentCount: paid.n,
    refundsPence: refunded.p,
    netPence: paid.p - refunded.p,
    subscriptions: counts,
    referrals,
    note: 'Figures from payments recorded in Propertymaster. The payment provider is the record of money actually received.',
  };
}
