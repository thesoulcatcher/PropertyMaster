// The context every module function receives first: the database, a clock that
// tests can control, and the configuration. No globals.

import { randomUUID } from 'node:crypto';
import { openDb } from './db.js';
import { TRIAL_DAYS, COOLING_OFF_DAYS } from '../config/plans.js';

export const DEFAULT_CONFIG = {
  // Password hashing cost for scrypt (N). Tests lower it to stay fast.
  scryptCost: 2 ** 15,
  sessionDays: 30,
  emailTokenHours: 24,
  lockout: { maxFailures: 5, windowMinutes: 15 },
  trialDays: TRIAL_DAYS,
  coolingOffDays: COOLING_OFF_DAYS,
  // Base address used in the links written into outbox messages.
  siteUrl: 'http://localhost:5173',
};

export function createContext({ dbPath = ':memory:', now = () => new Date(), config = {} } = {}) {
  return {
    db: openDb(dbPath),
    now,
    config: { ...DEFAULT_CONFIG, ...config },
  };
}

export function iso(ctx) {
  return ctx.now().toISOString();
}

export function newId() {
  return randomUUID();
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

// Calendar month added in UTC, clamped to the last day of a shorter month.
export function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

// An error with a plain message that is safe to show to a member, a machine code
// and an HTTP status for the API layer.
export class AppError extends Error {
  constructor(code, message, status = 400, extra = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    Object.assign(this, extra);
  }
}
