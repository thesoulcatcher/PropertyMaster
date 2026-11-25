// The Propertymaster API: one small HTTP server over every module, using only
// Node's built-in http module. The website and the desktop app both talk to it.
//
// Sign-in: the session token travels in the Authorization header as
// "Bearer <token>". Every route checks the role and section it needs.
// Errors come back as { error: { code, message } } with a plain message.
// Nothing here sends email, takes money or calls an outside service.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { AppError } from '../core/context.js';
import * as auth from '../core/auth.js';
import * as account from '../core/account.js';
import * as consent from '../core/consent.js';
import * as roles from '../core/roles.js';
import * as audit from '../core/audit.js';
import * as compliance from '../core/compliance.js';
import * as billing from '../core/billing.js';
import * as mentor from '../core/mentor.js';
import * as studio from '../core/studio.js';
import { lawTable, lawTopics, TO_CHECK } from '../data/law-by-nation.js';
import { purchaseTax } from '../calc/purchase-tax.js';
import { dealCalculator, refinanceTest, auctionCalculator } from '../calc/investment.js';
import { hmoRoomCheck } from '../calc/hmo.js';
import { AREA_SOURCES, AREA_DISCLAIMER, GEOGRAPHY_LEVELS, BLOCKED_SOURCES } from '../data/area-sources.js';
import { floodResult } from '../area/flood.js';
import { OFF_MARKET_MENU, OUTREACH_MENU, menuView } from '../outreach/menus.js';
import { tiersFor } from '../config/plans.js';

const MAX_BODY = 1_000_000;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new AppError('too_large', 'That request is too large.', 413));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new AppError('bad_json', 'The request body must be JSON.'));
      }
    });
    req.on('error', reject);
  });
}

// Calculators throw TypeError or RangeError for bad input; show those as 400s.
function wrapCalc(fn) {
  return (body) => {
    try {
      return fn(body);
    } catch (e) {
      if (e instanceof TypeError || e instanceof RangeError) throw new AppError('bad_input', e.message);
      throw e;
    }
  };
}

function needUser(r) {
  if (!r.user) throw new AppError('not_signed_in', 'Please sign in first.', 401);
  return r.user;
}

function section(r, name) {
  const user = needUser(r);
  roles.requirePermission(user, `section.${name}`);
  return user;
}

// [method, pattern, handler(r)] where r = { ctx, user, token, body, params, query }
export const ROUTES = [
  // Health
  ['GET', '/api/health', () => ({ ok: true })],

  // Module 1: accounts
  ['POST', '/api/auth/sign-up', (r) => {
    const out = auth.signUp(r.ctx, r.body);
    if (out.created) billing.startTrial(r.ctx, out.userId);
    if (out.created && r.body.referralCode) {
      try { billing.applyReferralCode(r.ctx, out.userId, r.body.referralCode); } catch { /* a bad code never blocks sign-up */ }
    }
    return { status: out.status, message: 'Check your email to confirm your address.' };
  }],
  ['POST', '/api/auth/verify', (r) => (auth.verifyEmail(r.ctx, r.body.token), { verified: true })],
  ['POST', '/api/auth/resend', (r) => auth.resendVerification(r.ctx, r.body.email)],
  ['POST', '/api/auth/sign-in', (r) => {
    const { token, user } = auth.signIn(r.ctx, r.body);
    return { token, user, sections: roles.sectionsFor(user), home: roles.homeSection(user) };
  }],
  ['POST', '/api/auth/sign-out', (r) => (auth.signOut(r.ctx, r.token), { signedOut: true })],
  ['POST', '/api/auth/reset-request', (r) => auth.requestPasswordReset(r.ctx, r.body.email)],
  ['POST', '/api/auth/reset', (r) => (auth.resetPassword(r.ctx, r.body.token, r.body.password), { reset: true })],
  ['GET', '/api/me', (r) => {
    const u = needUser(r);
    return { user: account.getUser(r.ctx, u.id), sections: roles.sectionsFor(u), home: roles.homeSection(u), plan: billing.subscriptionStatus(r.ctx, u.id), consents: consent.currentConsents(r.ctx, u.id) };
  }],
  ['PATCH', '/api/me/profile', (r) => account.updateProfile(r.ctx, needUser(r).id, r.body)],
  ['PATCH', '/api/me/settings', (r) => account.updateSettings(r.ctx, needUser(r).id, r.body)],
  ['POST', '/api/me/password', (r) => (auth.changePassword(r.ctx, needUser(r).id, r.body.currentPassword, r.body.newPassword), { changed: true })],
  ['POST', '/api/me/consents', (r) => consent.setOptionalConsent(r.ctx, needUser(r).id, r.body.kind, r.body.granted, 'settings')],
  ['GET', '/api/me/export', (r) => account.exportData(r.ctx, needUser(r).id)],
  ['POST', '/api/me/delete', (r) => account.deleteAccount(r.ctx, needUser(r).id, r.body)],

  // Module 2: pay and trial
  ['GET', '/api/plan', (r) => billing.subscriptionStatus(r.ctx, needUser(r).id)],
  ['GET', '/api/plan/tiers', (r) => {
    const u = needUser(r);
    return tiersFor(u.role === 'estate_agent' ? 'estate_agent' : 'member').map((t) => ({ ...t, availability: billing.checkoutAvailability(r.ctx, u.id, t.id) }));
  }],
  ['POST', '/api/plan/cancel', (r) => billing.cancel(r.ctx, needUser(r).id)],
  ['POST', '/api/plan/resume', (r) => billing.resume(r.ctx, needUser(r).id)],
  ['POST', '/api/plan/referral', (r) => billing.applyReferralCode(r.ctx, needUser(r).id, r.body.code)],
  ['POST', '/api/plan/refund', (r) => billing.requestRefund(r.ctx, needUser(r).id, r.body)],

  // Module 3: Property Mentor
  ['GET', '/api/mentor/courses', (r) => mentor.listCourses(r.ctx, needUser(r).id)],
  ['GET', '/api/mentor/courses/:course', (r) => mentor.getCourse(r.ctx, needUser(r).id, r.params.course)],
  ['GET', '/api/mentor/courses/:course/lessons/:lesson', (r) => mentor.getLesson(r.ctx, needUser(r).id, r.params.course, r.params.lesson)],
  ['POST', '/api/mentor/courses/:course/lessons/:lesson/complete', (r) => mentor.completeLesson(r.ctx, needUser(r).id, r.params.course, r.params.lesson)],
  ['POST', '/api/mentor/courses/:course/quiz', (r) => mentor.submitQuiz(r.ctx, needUser(r).id, r.params.course, r.body.answers)],

  // Module 4: law by nation (open to signed-in members of both sections)
  ['GET', '/api/law', (r) => (needUser(r), { topics: lawTopics(), toCheck: TO_CHECK })],
  ['GET', '/api/law/:topic', (r) => {
    needUser(r);
    try { return lawTable(r.params.topic); } catch (e) { throw new AppError('not_found', e.message, 404); }
  }],

  // Module 5: calculators
  ['POST', '/api/calc/purchase-tax', (r) => (needUser(r), wrapCalc(purchaseTax)(r.body))],
  ['POST', '/api/calc/deal', (r) => (needUser(r), wrapCalc(dealCalculator)(r.body))],
  ['POST', '/api/calc/refinance', (r) => (needUser(r), wrapCalc(refinanceTest)(r.body))],
  ['POST', '/api/calc/auction', (r) => (needUser(r), wrapCalc(auctionCalculator)(r.body))],
  ['POST', '/api/calc/hmo', (r) => (needUser(r), wrapCalc(hmoRoomCheck)(r.body))],

  // Area maps
  ['GET', '/api/area/sources', (r) => (needUser(r), { sources: AREA_SOURCES, levels: GEOGRAPHY_LEVELS, blocked: BLOCKED_SOURCES, disclaimer: AREA_DISCLAIMER })],
  ['POST', '/api/area/flood', (r) => (needUser(r), wrapCalc(floodResult)(r.body))],

  // Off-Market Finder and outreach menus (Part B): visible, gated items disabled
  ['GET', '/api/menus/:section', (r) => {
    const s = r.params.section === 'estate_agent' ? 'estate_agent' : 'developer';
    section(r, s);
    return { offMarket: menuView(OFF_MARKET_MENU, s), outreach: menuView(OUTREACH_MENU, s) };
  }],

  // Developer Studio (developer section)
  ['GET', '/api/studio', (r) => (section(r, 'developer'), studio.studioHome(r.ctx))],
  ['GET', '/api/studio/projects', (r) => studio.listProjects(r.ctx, section(r, 'developer'))],
  ['POST', '/api/studio/projects', (r) => studio.createProject(r.ctx, section(r, 'developer'), r.body)],
  ['GET', '/api/studio/projects/:id', (r) => studio.getProject(r.ctx, section(r, 'developer'), r.params.id)],
  ['GET', '/api/studio/projects/:id/scope', (r) => studio.draftScope(studio.getProject(r.ctx, section(r, 'developer'), r.params.id))],
  ['GET', '/api/studio/projects/:id/preview', (r) => ({ svg: studio.planPreviewSvg(studio.getProject(r.ctx, section(r, 'developer'), r.params.id)) })],
  ['GET', '/api/studio/projects/:id/model', (r) => studio.floorplanModel(studio.getProject(r.ctx, section(r, 'developer'), r.params.id).inputs.rooms || [])],
  ['GET', '/api/studio/projects/:id/walkthrough', (r) => studio.walkthrough(studio.getProject(r.ctx, section(r, 'developer'), r.params.id).inputs.rooms || [], { furnished: r.query.get('furnished') === 'true' })],
  ['POST', '/api/studio/projects/:id/export', (r) => studio.exportPlan(r.ctx, section(r, 'developer'), r.params.id)],

  // Flags, for labelling gated controls
  ['GET', '/api/flags', (r) => (needUser(r), compliance.listFlags(r.ctx).map(({ name, on, message }) => ({ name, on, message })))],

  // Admin
  ['GET', '/api/admin/members', (r) => (roles.requirePermission(needUser(r), 'admin.members.read'), account.listMembers(r.ctx))],
  ['GET', '/api/admin/audit', (r) => (roles.requirePermission(needUser(r), 'admin.audit.read'), audit.list(r.ctx, { limit: Number(r.query.get('limit')) || 100 }))],
  ['GET', '/api/admin/flags', (r) => (roles.requirePermission(needUser(r), 'admin.flags.read'), { flags: compliance.listFlags(r.ctx), register: compliance.COMPLIANCE_ROWS, signoffs: compliance.listSignoffs(r.ctx) })],
  ['POST', '/api/admin/flags/:name', (r) => compliance.setFlag(r.ctx, needUser(r), r.params.name, r.body.on, { signoffId: r.body.signoffId })],
  ['POST', '/api/admin/signoffs', (r) => compliance.recordSignoff(r.ctx, needUser(r), r.body)],
  ['POST', '/api/admin/roles', (r) => roles.setRole(r.ctx, needUser(r), r.body.userId, r.body.role)],
  ['POST', '/api/admin/refunds/:id', (r) => billing.decideRefund(r.ctx, needUser(r), r.params.id, r.body)],
  ['GET', '/api/admin/revenue', (r) => billing.revenueSummary(r.ctx, needUser(r))],
];

function compile(pattern) {
  const names = [];
  const re = new RegExp(`^${pattern.replace(/:([a-z]+)/g, (_, n) => (names.push(n), '([^/]+)'))}$`);
  return { re, names };
}

const COMPILED = ROUTES.map(([method, pattern, handler]) => ({ method, handler, ...compile(pattern) }));

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(body);
}

// Handles one request against the context. Exported for tests.
export async function handle(ctx, req, res, { allowOrigin = null } = {}) {
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const url = new URL(req.url, 'http://localhost');
  const match = COMPILED.find((r) => r.method === req.method && r.re.test(url.pathname));
  if (!match) {
    return send(res, 404, { error: { code: 'not_found', message: 'Nothing here.' } });
  }
  try {
    const params = Object.fromEntries(match.names.map((n, i) => [n, decodeURIComponent(url.pathname.match(match.re)[i + 1])]));
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const user = token ? auth.getSessionUser(ctx, token) : null;
    const body = req.method === 'GET' ? {} : await readBody(req);
    const data = await match.handler({ ctx, user, token, body, params, query: url.searchParams });
    return send(res, 200, data ?? {});
  } catch (e) {
    if (e instanceof AppError) {
      return send(res, e.status, { error: { code: e.code, message: e.message, ...(e.reason ? { reason: e.reason } : {}) } });
    }
    console.error(e);
    return send(res, 500, { error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } });
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// Serves the built website (web/dist) for every path outside /api, so the
// desktop app needs only this one server. Paths cannot climb out of the folder.
async function serveStatic(dir, req, res) {
  const url = new URL(req.url, 'http://localhost');
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = resolve(dir, rel || 'index.html');
  if (!file.startsWith(resolve(dir))) {
    res.writeHead(403);
    return res.end();
  }
  try {
    if (!(await stat(file)).isFile()) file = join(dir, 'index.html');
  } catch {
    file = join(dir, 'index.html');
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
    });
    return res.end(body);
  } catch {
    res.writeHead(404);
    return res.end('Not found');
  }
}

export function createApiServer(ctx, opts = {}) {
  return createServer((req, res) => {
    if (opts.staticDir && (req.method === 'GET' || req.method === 'HEAD') && !req.url.startsWith('/api/')) {
      serveStatic(opts.staticDir, req, res);
      return;
    }
    handle(ctx, req, res, opts);
  });
}
