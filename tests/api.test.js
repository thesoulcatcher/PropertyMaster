import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../src/core/context.js';
import { createApiServer } from '../src/server/api.js';
import * as auth from '../src/core/auth.js';

const PASSWORD = 'correct horse battery';
let server;
let base;
let ctx;

before(async () => {
  ctx = createContext({ config: { scryptCost: 2 ** 10 } });
  auth.createStaff(ctx, { email: 'owner@example.com', password: PASSWORD, displayName: 'Example Owner', role: 'owner' });
  server = createApiServer(ctx);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((r) => server.close(r)));

async function call(method, path, { body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function signUpAndIn(email, accountType = 'member') {
  await call('POST', '/api/auth/sign-up', { body: { email, password: PASSWORD, displayName: 'Example', accountType, consents: { terms: true, privacy: true } } });
  return (await call('POST', '/api/auth/sign-in', { body: { email, password: PASSWORD } })).data;
}

test('health check answers without signing in', async () => {
  assert.deepEqual((await call('GET', '/api/health')).data, { ok: true });
});

test('signing up starts the trial and lands a member in the developer section', async () => {
  const s = await signUpAndIn('api.member@example.com');
  assert.equal(s.home, 'developer');
  const me = await call('GET', '/api/me', { token: s.token });
  assert.equal(me.data.plan.state, 'trialing');
  assert.equal(me.data.consents.terms.granted, true);
});

test('an estate agent lands in the agent section and cannot open Developer Studio', async () => {
  const s = await signUpAndIn('api.agent@example.com', 'estate_agent');
  assert.equal(s.home, 'estate_agent');
  assert.equal((await call('GET', '/api/studio', { token: s.token })).status, 403);
  assert.equal((await call('GET', '/api/menus/estate_agent', { token: s.token })).status, 200);
});

test('routes that need a sign-in refuse without one, with a plain message', async () => {
  const r = await call('GET', '/api/me');
  assert.equal(r.status, 401);
  assert.equal(r.data.error.message, 'Please sign in first.');
});

test('calculator errors come back as 400 with the reason, never a number', async () => {
  const s = await signUpAndIn('api.calc@example.com');
  const ok = await call('POST', '/api/calc/purchase-tax', { token: s.token, body: { nation: 'scotland', price: 200000 } });
  assert.equal(ok.data.tax, 1100);
  const bad = await call('POST', '/api/calc/purchase-tax', { token: s.token, body: { nation: 'scotland', price: -5 } });
  assert.equal(bad.status, 400);
  assert.ok(!('tax' in bad.data));
});

test('law tables and courses are served to members, Scotland first', async () => {
  const s = await signUpAndIn('api.law@example.com');
  const t = await call('GET', '/api/law/deposits', { token: s.token });
  assert.equal(t.data.columns[0].nation, 'scotland');
  assert.equal((await call('GET', '/api/law/nope', { token: s.token })).status, 404);
  const courses = await call('GET', '/api/mentor/courses', { token: s.token });
  assert.equal(courses.data.length, 6);
});

test('members cannot reach admin routes; the owner can, and gated flags stay shut', async () => {
  const s = await signUpAndIn('api.nosy@example.com');
  assert.equal((await call('GET', '/api/admin/audit', { token: s.token })).status, 403);
  const owner = (await call('POST', '/api/auth/sign-in', { body: { email: 'owner@example.com', password: PASSWORD } })).data;
  const flags = await call('GET', '/api/admin/flags', { token: owner.token });
  assert.ok(flags.data.flags.every((f) => f.on === false));
  const refused = await call('POST', '/api/admin/flags/lettingsModule', { token: owner.token, body: { on: true } });
  assert.equal(refused.status, 409);
});

test('a studio export without sign-off is refused with the gate message', async () => {
  const s = await signUpAndIn('api.studio@example.com');
  const p = await call('POST', '/api/studio/projects', { token: s.token, body: { type: 'loft', title: 'Example loft', nation: 'scotland', rooms: [{ name: 'Loft', type: 'bedroom', x: 0, y: 0, w: 4, d: 4 }] } });
  assert.equal(p.status, 200);
  const e = await call('POST', `/api/studio/projects/${p.data.id}/export`, { token: s.token });
  assert.equal(e.status, 403);
  assert.match(e.data.error.message, /needs sign-off before it opens/);
  const prev = await call('GET', `/api/studio/projects/${p.data.id}/preview`, { token: s.token });
  assert.ok(prev.data.svg.includes('DRAFT'));
});

test('bad JSON and unknown routes get plain errors', async () => {
  const res = await fetch(`${base}/api/auth/sign-in`, { method: 'POST', body: '{nope', headers: { 'Content-Type': 'application/json' } });
  assert.equal(res.status, 400);
  assert.equal((await call('GET', '/api/nothing')).status, 404);
});
