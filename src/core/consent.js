// Consent record. Every grant and every withdrawal is a new dated row with the
// wording version the member saw and where they gave it. Rows are never edited,
// so the history shows exactly what was agreed and when.
//
// Marketing and analytics are opt-in and default to off (brief section 12: no
// analytics or telemetry to a third party without recorded opt-in).

import { AppError, iso, newId } from './context.js';
import { record } from './audit.js';

export const CONSENT_KINDS = {
  terms: { label: 'Terms of use', required: true, version: '2026-11-draft' },
  privacy: { label: 'Privacy notice', required: true, version: '2026-11-draft' },
  marketing_email: { label: 'Emails about offers and news', required: false, version: '2026-11-draft' },
  analytics: { label: 'Usage analytics shared with a third party', required: false, version: '2026-11-draft' },
  ai_processing: { label: 'AI chat and roleplay may process what I type', required: false, version: '2026-11-draft' },
};

export function recordConsent(ctx, userId, kind, granted, source) {
  const def = CONSENT_KINDS[kind];
  if (!def) {
    throw new AppError('bad_consent', `Unknown consent "${kind}".`);
  }
  if (typeof granted !== 'boolean') {
    throw new AppError('bad_consent', 'Consent must be a clear yes or no.');
  }
  if (!source) {
    throw new AppError('bad_consent', 'A consent record needs to say where it was given.');
  }
  ctx.db
    .prepare('INSERT INTO consents (id, user_id, kind, granted, wording_version, source, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(newId(), userId, kind, granted ? 1 : 0, def.version, source, iso(ctx));
  record(ctx, { actorId: userId, action: granted ? 'consent.granted' : 'consent.withdrawn', target: kind, detail: { version: def.version, source } });
}

// The latest answer per kind. A kind never answered counts as not granted.
export function currentConsents(ctx, userId) {
  const out = {};
  for (const kind of Object.keys(CONSENT_KINDS)) {
    const row = ctx.db
      .prepare('SELECT granted, wording_version, source, at FROM consents WHERE user_id = ? AND kind = ? ORDER BY at DESC, rowid DESC LIMIT 1')
      .get(userId, kind);
    out[kind] = row
      ? { granted: row.granted === 1, version: row.wording_version, source: row.source, at: row.at }
      : { granted: false, version: null, source: null, at: null };
  }
  return out;
}

export function consentHistory(ctx, userId) {
  return ctx.db
    .prepare('SELECT kind, granted, wording_version AS version, source, at FROM consents WHERE user_id = ? ORDER BY at, rowid')
    .all(userId)
    .map((r) => ({ ...r, granted: r.granted === 1 }));
}

export function hasConsent(ctx, userId, kind) {
  return currentConsents(ctx, userId)[kind]?.granted === true;
}

// A member can withdraw any optional consent at any time. Terms and privacy are
// needed to hold an account, so withdrawing them is done by deleting the account.
export function setOptionalConsent(ctx, userId, kind, granted, source = 'settings') {
  const def = CONSENT_KINDS[kind];
  if (!def) {
    throw new AppError('bad_consent', `Unknown consent "${kind}".`);
  }
  if (def.required) {
    throw new AppError('required_consent', 'This one is needed to hold an account. To withdraw it, delete your account in Settings.');
  }
  recordConsent(ctx, userId, kind, granted, source);
  return currentConsents(ctx, userId);
}
