// Audit log. Append-only: this module has no update or delete function, and the
// database refuses both with a trigger (see db.js). Every sign-in, role change,
// flag change, sign-off, deletion and money decision is written here.
//
// Retention period: to check at ico.org.uk before launch. Nothing is pruned yet.

import { iso } from './context.js';

export function record(ctx, { actorId = null, action, target = null, detail = {} }) {
  if (!action || typeof action !== 'string') {
    throw new TypeError('An audit entry needs an action.');
  }
  ctx.db
    .prepare('INSERT INTO audit_log (at, actor_id, action, target, detail_json) VALUES (?, ?, ?, ?, ?)')
    .run(iso(ctx), actorId, action, target, JSON.stringify(detail));
}

export function list(ctx, { limit = 100, actorId = null, action = null } = {}) {
  const cap = Math.max(1, Math.min(500, Number(limit) || 100));
  const where = [];
  const params = [];
  if (actorId) {
    where.push('actor_id = ?');
    params.push(actorId);
  }
  if (action) {
    where.push('action = ?');
    params.push(action);
  }
  const sql = `SELECT id, at, actor_id, action, target, detail_json FROM audit_log ${
    where.length ? `WHERE ${where.join(' AND ')}` : ''
  } ORDER BY id DESC LIMIT ?`;
  return ctx.db
    .prepare(sql)
    .all(...params, cap)
    .map((r) => ({ id: r.id, at: r.at, actorId: r.actor_id, action: r.action, target: r.target, detail: JSON.parse(r.detail_json) }));
}
