import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../src/core/context.js';
import * as auth from '../src/core/auth.js';
import * as studio from '../src/core/studio.js';
import * as compliance from '../src/core/compliance.js';
import { PROJECT_TYPES, ENTRY_BUTTONS, STUDIO_TABS, PERMISSIONS_BY_NATION, STAGING_PRICE_HYPOTHESIS } from '../src/data/studio.js';

const PASSWORD = 'correct horse battery';
// EXAMPLE plan only.
const ROOMS = [
  { name: 'Kitchen', type: 'kitchen', x: 0, y: 0, w: 4, d: 3 },
  { name: 'Living room', type: 'living', x: 4, y: 0, w: 5, d: 4 },
  { name: 'Bedroom', type: 'bedroom', x: 0, y: 3, w: 3.5, d: 3.2 },
];

function setup() {
  const ctx = createContext({ config: { scryptCost: 2 ** 10 } });
  const owner = auth.createStaff(ctx, { email: 'owner@example.com', password: PASSWORD, displayName: 'Example Owner', role: 'owner' });
  auth.signUp(ctx, { email: 'dev@example.com', password: PASSWORD, displayName: 'Example Developer', consents: { terms: true, privacy: true } });
  const user = auth.signIn(ctx, { email: 'dev@example.com', password: PASSWORD }).user;
  return { ctx, owner, user };
}

test('the entry screen has the four buttons and the five tabs from the brief', () => {
  const { ctx } = setup();
  const home = studio.studioHome(ctx);
  assert.deepEqual(home.buttons.map((b) => b.id), ['extension_planning', 'floorplan_3d', 'walkthrough_3d', 'staging']);
  assert.equal(home.buttons.find((b) => b.id === 'staging').enabled, false);
  assert.match(home.buttons.find((b) => b.id === 'staging').gate, /needs sign-off/);
  assert.deepEqual(STUDIO_TABS.map((t) => t.id), ['land', 'planning', 'foundations', 'building', 'development']);
  assert.equal(ENTRY_BUTTONS.length, 4);
});

test('every project type in the brief is listed, each with a scope', () => {
  const ids = PROJECT_TYPES.map((t) => t.id);
  for (const need of ['loft', 'side', 'rear', 'dormer', 'conservatory', 'garage', 'basement', 'hmo', 'brrr', 'title_split', 'roof', 'repairs']) {
    assert.ok(ids.includes(need), need);
  }
  for (const t of PROJECT_TYPES) assert.ok(t.scope.length >= 3, t.id);
});

test('a draft scope names the nation’s approvals as unverified and is labelled draft', () => {
  const { ctx, user } = setup();
  const p = studio.createProject(ctx, user, { type: 'loft', title: 'Example loft', nation: 'scotland', rooms: ROOMS });
  const s = studio.draftScope(p);
  assert.match(s.label, /not certified/);
  assert.match(s.permissions.building, /building warrant/);
  assert.equal(s.permissions.verified, false);
  assert.ok(s.professionals.includes('structural engineer'));
  assert.equal(s.totalArea, 12 + 20 + 11.2);
  for (const n of Object.values(PERMISSIONS_BY_NATION)) assert.match(n.building, /To check/);
});

test('room input is checked: blank, tiny, huge, overlapping and non-numeric rooms are refused', () => {
  assert.throws(() => studio.validateRooms([]), /at least one room/);
  assert.throws(() => studio.validateRooms([{ name: 'A', x: 0, y: 0, w: 0.2, d: 3 }]), /more than 0.5/);
  assert.throws(() => studio.validateRooms([{ name: 'A', x: 0, y: 0, w: 1e9, d: 3 }]), /at most 50/);
  assert.throws(() => studio.validateRooms([{ name: 'A', x: 0, y: 0, w: '3', d: 3 }]), /must be a number/);
  assert.throws(() => studio.validateRooms([{ name: 'A', x: 0, y: 0, w: NaN, d: 3 }]), /must be a number/);
  assert.throws(() => studio.validateRooms([{ name: 'A', x: 0, y: 0, w: 4, d: 4 }, { name: 'B', x: 2, y: 2, w: 4, d: 4 }]), /overlap/);
  // Rooms that only touch are fine.
  assert.equal(studio.validateRooms([{ name: 'A', x: 0, y: 0, w: 4, d: 4 }, { name: 'B', x: 4, y: 0, w: 4, d: 4 }]).length, 2);
});

test('the 3D model has a floor and four walls per room', () => {
  const m = studio.floorplanModel(ROOMS);
  assert.equal(m.boxes.length, ROOMS.length * 5);
  assert.equal(m.up, 'y');
  assert.throws(() => studio.floorplanModel(ROOMS, { wallHeight: 50 }), /between 2 and 6/);
});

test('walkthrough comes furnished and unfurnished, and furniture fits its room', () => {
  const bare = studio.walkthrough(ROOMS);
  const full = studio.walkthrough(ROOMS, { furnished: true });
  assert.equal(bare.version, 'unfurnished');
  assert.equal(bare.furniture.length, 0);
  assert.equal(full.stops.length, 3);
  assert.ok(full.furniture.length > 0);
  assert.match(full.label, /illustration/);
  for (const f of full.furniture) {
    const r = ROOMS.find((x) => x.name === f.room);
    assert.ok(f.max[0] <= r.x + r.w && f.max[2] <= r.y + r.d, `${f.item} fits ${f.room}`);
  }
});

test('the preview is watermarked DRAFT and escapes names', () => {
  const { ctx, user } = setup();
  const p = studio.createProject(ctx, user, { type: 'rear', title: 'Example <rear>', nation: 'england', rooms: ROOMS });
  const svg = studio.planPreviewSvg(p);
  assert.ok(svg.includes('DRAFT'));
  assert.ok(svg.includes('not certified'));
  assert.ok(svg.includes('Example &lt;rear&gt;'));
});

test('plan export is locked until the flag is on and this project has its sign-off', () => {
  const { ctx, owner, user } = setup();
  const p = studio.createProject(ctx, user, { type: 'rear', title: 'Example rear', nation: 'scotland', rooms: ROOMS });
  assert.throws(() => studio.exportPlan(ctx, user, p.id), /needs sign-off before it opens/);

  const flagSignoff = compliance.recordSignoff(ctx, owner, { row: 13, flag: 'studioPlanExport', professionalName: 'Example Engineer', professionalRole: 'Structural engineer', reference: 'EXAMPLE-FLAG', signedOn: '2026-11-16' });
  compliance.setFlag(ctx, owner, 'studioPlanExport', true, { signoffId: flagSignoff.id });
  // Flag on, but no sign-off for this project yet.
  assert.throws(() => studio.exportPlan(ctx, user, p.id), (e) => /No sign-off/.test(e.reason));

  compliance.recordSignoff(ctx, owner, { row: 13, projectId: p.id, professionalName: 'Example Architect', professionalRole: 'Architect', reference: 'EXAMPLE-P1', signedOn: '2026-11-16' });
  const out = studio.exportPlan(ctx, user, p.id);
  assert.equal(out.signoff.professionalRole, 'Architect');
  assert.ok(out.svg.includes('DRAFT'));
});

test('title splitting also needs a solicitor’s sign-off for the project', () => {
  const { ctx, owner, user } = setup();
  const p = studio.createProject(ctx, user, { type: 'title_split', title: 'Example block', nation: 'scotland', rooms: ROOMS });
  const f1 = compliance.recordSignoff(ctx, owner, { row: 13, flag: 'studioPlanExport', professionalName: 'Example', professionalRole: 'Architect', reference: 'F1', signedOn: '2026-11-16' });
  compliance.setFlag(ctx, owner, 'studioPlanExport', true, { signoffId: f1.id });
  compliance.recordSignoff(ctx, owner, { row: 13, projectId: p.id, professionalName: 'Example', professionalRole: 'Architect', reference: 'P1', signedOn: '2026-11-16' });
  assert.throws(() => studio.exportPlan(ctx, user, p.id), (e) => /Title splitting is switched off/.test(e.reason));
  const f2 = compliance.recordSignoff(ctx, owner, { row: 13, flag: 'studioTitleSplitting', professionalName: 'Example', professionalRole: 'Solicitor', reference: 'F2', signedOn: '2026-11-16' });
  compliance.setFlag(ctx, owner, 'studioTitleSplitting', true, { signoffId: f2.id });
  assert.throws(() => studio.exportPlan(ctx, user, p.id), (e) => /solicitor/.test(e.reason));
  compliance.recordSignoff(ctx, owner, { row: 13, projectId: p.id, professionalName: 'Example', professionalRole: 'Solicitor', reference: 'P2', signedOn: '2026-11-16' });
  assert.ok(studio.exportPlan(ctx, user, p.id).svg);
});

test('another member cannot open someone else’s project', () => {
  const { ctx, user } = setup();
  const p = studio.createProject(ctx, user, { type: 'garage', title: 'Example garage', nation: 'wales' });
  auth.signUp(ctx, { email: 'other@example.com', password: PASSWORD, displayName: 'Other', consents: { terms: true, privacy: true } });
  const other = auth.signIn(ctx, { email: 'other@example.com', password: PASSWORD }).user;
  assert.throws(() => studio.getProject(ctx, other, p.id), /not found/);
  assert.throws(() => studio.createProject(ctx, user, { type: 'castle', title: 'x', nation: 'wales' }), /project type/);
  assert.throws(() => studio.createProject(ctx, user, { type: 'loft', title: 'x', nation: 'france' }), /Choose Scotland/);
});

test('staging stays gated, shows its cost first and refuses automatic approval', () => {
  const { ctx, owner, user } = setup();
  const quote = studio.quoteStagingRun({ tool: 'Example staging tool', photoCount: 8, pricePerPhotoPence: 300 });
  assert.equal(quote.totalPence, 2400);
  assert.throws(() => studio.quoteStagingRun({ tool: 'x', photoCount: 0, pricePerPhotoPence: 1 }), /between 1 and 200/);
  assert.throws(() => studio.createStagingJob(ctx, user, { originalRef: 'photo-1', quote, approvedBy: 'Example' }), /needs sign-off/);
  const s = compliance.recordSignoff(ctx, owner, { row: 14, flag: 'studioVirtualStaging', professionalName: 'Example Owner', professionalRole: 'Owner', reference: 'S1', signedOn: '2026-11-16' });
  compliance.setFlag(ctx, owner, 'studioVirtualStaging', true, { signoffId: s.id });
  assert.throws(() => studio.createStagingJob(ctx, user, { originalRef: 'photo-1', quote, approvedBy: 'auto' }), /named person/);
  assert.throws(() => studio.createStagingJob(ctx, user, { quote, approvedBy: 'Example' }), /original photo/);
  const job = studio.createStagingJob(ctx, user, { originalRef: 'photo-1', quote, approvedBy: 'Example Owner' });
  assert.equal(job.label, 'Virtually staged');
  assert.equal(job.keepOriginal, true);
  assert.ok(job.forbidden.includes('damp'));
  assert.match(STAGING_PRICE_HYPOTHESIS.status, /hypothesis/);
});
