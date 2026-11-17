// Roles and what each may do (brief section 3.1). Four roles:
//   member        a developer or investor: sees Propertymaster
//   estate_agent  an agent login: sees Propertymaster Estate Agent
//   admin         staff: members, moderation, refunds, reads the audit log
//   owner         everything, including sign-offs and switching gated features
// Sign-up can only ever create a member or an estate agent.

import { AppError } from './context.js';
import { record } from './audit.js';

export const ROLES = ['member', 'estate_agent', 'admin', 'owner'];
export const SIGN_UP_ROLES = ['member', 'estate_agent'];

const BASE = ['app.use'];
const ADMIN = [
  'section.developer',
  'section.estate_agent',
  'admin.members.read',
  'admin.audit.read',
  'admin.flags.read',
  'admin.moderate',
  'admin.refunds.decide',
  'admin.roles.set_basic',
];

export const PERMISSIONS = {
  member: [...BASE, 'section.developer'],
  estate_agent: [...BASE, 'section.estate_agent'],
  admin: [...BASE, ...ADMIN],
  owner: [...BASE, ...ADMIN, 'owner.roles.set_any', 'owner.flags.set', 'owner.signoff.record'],
};

export function can(user, permission) {
  if (!user || !PERMISSIONS[user.role]) {
    return false;
  }
  return PERMISSIONS[user.role].includes(permission);
}

export function requirePermission(user, permission) {
  if (!user) {
    throw new AppError('not_signed_in', 'Please sign in first.', 401);
  }
  if (!can(user, permission)) {
    throw new AppError('forbidden', 'Your account does not have access to this.', 403);
  }
}

// Which of the two sections a login lands in. Staff can open both.
export function sectionsFor(user) {
  const out = [];
  if (can(user, 'section.developer')) out.push('developer');
  if (can(user, 'section.estate_agent')) out.push('estate_agent');
  return out;
}

export function homeSection(user) {
  return user && user.role === 'estate_agent' ? 'estate_agent' : 'developer';
}

export function setRole(ctx, actor, userId, role) {
  if (!ROLES.includes(role)) {
    throw new AppError('bad_role', `Unknown role "${role}".`);
  }
  const elevated = role === 'admin' || role === 'owner';
  const target = ctx.db.prepare('SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL').get(userId);
  if (!target) {
    throw new AppError('not_found', 'That account was not found.', 404);
  }
  const touchesStaff = elevated || target.role === 'admin' || target.role === 'owner';
  requirePermission(actor, touchesStaff ? 'owner.roles.set_any' : 'admin.roles.set_basic');
  if (target.role === 'owner' && role !== 'owner') {
    const owners = ctx.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND deleted_at IS NULL").get().n;
    if (owners <= 1) {
      throw new AppError('last_owner', 'There must always be at least one owner account.');
    }
  }
  ctx.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  record(ctx, { actorId: actor.id, action: 'role.set', target: userId, detail: { from: target.role, to: role } });
  return { id: userId, role };
}
