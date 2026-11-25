// Developer Studio (brief section 2): projects, draft scopes, floor plans, 3D
// models, walkthrough paths and virtual staging jobs.
//
// Gates:
//   plan export     needs the studioPlanExport flag AND a sign-off for this project
//                   from a qualified person (compliance row 13)
//   title splitting needs the studioTitleSplitting flag AND a solicitor's sign-off
//                   for this project
//   staging         needs the studioVirtualStaging flag; every paid run shows its
//                   cost and needs a named person's yes first
// A draft preview on screen is always allowed and always watermarked.

import { AppError, iso, newId } from './context.js';
import { record } from './audit.js';
import { requirePermission } from './roles.js';
import { flagOn, projectSignoff, GATE_MESSAGE } from './compliance.js';
import { DRAFT_LABEL, PROJECT_TYPES, PERMISSIONS_BY_NATION, FURNITURE, STAGING_RULES, ENTRY_BUTTONS, STUDIO_TABS } from '../data/studio.js';
import { NATIONS } from '../data/purchase-tax.js';
import { esc } from '../area/charts.js';

const MAX_ROOM_M = 50;
const ROOM_TYPES = Object.keys(FURNITURE);

export function studioHome(ctx) {
  return {
    buttons: ENTRY_BUTTONS.map((b) => ({ ...b, enabled: b.flag ? flagOn(ctx, b.flag) : true, gate: b.flag && !flagOn(ctx, b.flag) ? GATE_MESSAGE : null })),
    tabs: STUDIO_TABS,
    projectTypes: PROJECT_TYPES.map((t) => ({ id: t.id, label: t.label })),
    draftLabel: DRAFT_LABEL,
  };
}

function projectType(id) {
  const t = PROJECT_TYPES.find((p) => p.id === id);
  if (!t) {
    throw new AppError('bad_type', 'Choose a project type from the list.');
  }
  return t;
}

// Rooms: [{ name, type, x, y, w, d }] in metres, x and y the top-left corner.
export function validateRooms(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    throw new AppError('bad_plan', 'Add at least one room.');
  }
  if (rooms.length > 60) {
    throw new AppError('bad_plan', 'A plan can have up to 60 rooms.');
  }
  const clean = rooms.map((r, i) => {
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : `Room ${i + 1}`;
    const type = ROOM_TYPES.includes(r.type) ? r.type : 'other';
    for (const k of ['x', 'y', 'w', 'd']) {
      const v = r[k];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new AppError('bad_plan', `${name}: ${k} must be a number of metres.`);
      }
      if ((k === 'w' || k === 'd') && (v <= 0.5 || v > MAX_ROOM_M)) {
        throw new AppError('bad_plan', `${name}: each side must be more than 0.5 and at most ${MAX_ROOM_M} metres.`);
      }
      if ((k === 'x' || k === 'y') && (v < 0 || v > 200)) {
        throw new AppError('bad_plan', `${name}: position must be between 0 and 200 metres.`);
      }
    }
    return { name, type, x: r.x, y: r.y, w: r.w, d: r.d, area: Math.round(r.w * r.d * 100) / 100 };
  });
  for (let i = 0; i < clean.length; i += 1) {
    for (let j = i + 1; j < clean.length; j += 1) {
      const a = clean[i];
      const b = clean[j];
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y);
      if (overlapX > 0.01 && overlapY > 0.01) {
        throw new AppError('bad_plan', `${a.name} and ${b.name} overlap. Check their positions.`);
      }
    }
  }
  return clean;
}

export function createProject(ctx, user, { type, title, nation, rooms = null, notes = '' } = {}) {
  requirePermission(user, 'app.use');
  const t = projectType(type);
  if (!NATIONS.includes(nation)) {
    throw new AppError('bad_nation', 'Choose Scotland, England, Wales or Northern Ireland.');
  }
  const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 100) : '';
  if (!cleanTitle) {
    throw new AppError('bad_title', 'Give the project a name.');
  }
  const inputs = { rooms: rooms ? validateRooms(rooms) : null, notes: String(notes).slice(0, 4000) };
  const id = newId();
  ctx.db.prepare('INSERT INTO studio_projects (id, user_id, type, title, nation, inputs_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, user.id, t.id, cleanTitle, nation, JSON.stringify(inputs), iso(ctx));
  record(ctx, { actorId: user.id, action: 'studio.project_created', target: id, detail: { type: t.id, nation } });
  return getProject(ctx, user, id);
}

export function getProject(ctx, user, id) {
  const row = ctx.db.prepare('SELECT * FROM studio_projects WHERE id = ?').get(id);
  if (!row || (row.user_id !== user.id && user.role !== 'admin' && user.role !== 'owner')) {
    throw new AppError('not_found', 'That project was not found.', 404);
  }
  return { id: row.id, userId: row.user_id, type: row.type, title: row.title, nation: row.nation, inputs: JSON.parse(row.inputs_json), createdAt: row.created_at };
}

export function listProjects(ctx, user) {
  return ctx.db.prepare('SELECT id, type, title, nation, created_at FROM studio_projects WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
}

// The draft scope: what the work involves, who approves it in this nation, and
// which professionals it needs.
export function draftScope(project) {
  const t = projectType(project.type);
  const perms = PERMISSIONS_BY_NATION[project.nation];
  return {
    label: DRAFT_LABEL,
    project: { title: project.title, type: t.label, nation: project.nation },
    scope: t.scope,
    permissions: { planning: perms.planning, building: perms.building, source: perms.source, verified: false },
    professionals: [...new Set(['architect or technologist', ...t.needs])],
    lawTopic: t.lawTopic || null,
    calculators: t.calculators || [],
    solicitorGate: Boolean(t.solicitorGate),
    totalArea: project.inputs.rooms ? Math.round(project.inputs.rooms.reduce((s, r) => s + r.area, 0) * 100) / 100 : null,
  };
}

// A 3D model as plain boxes: a floor slab per room and four walls. Units are
// metres; y is up. Ready to hand to any 3D viewer.
export function floorplanModel(rooms, { wallHeight = 2.4, wallThickness = 0.1 } = {}) {
  const clean = validateRooms(rooms);
  if (!Number.isFinite(wallHeight) || wallHeight < 2 || wallHeight > 6) {
    throw new AppError('bad_plan', 'Wall height must be between 2 and 6 metres.');
  }
  const boxes = [];
  for (const r of clean) {
    boxes.push({ room: r.name, part: 'floor', min: [r.x, 0, r.y], max: [r.x + r.w, 0.02, r.y + r.d] });
    const t = wallThickness;
    boxes.push({ room: r.name, part: 'wall-north', min: [r.x, 0, r.y], max: [r.x + r.w, wallHeight, r.y + t] });
    boxes.push({ room: r.name, part: 'wall-south', min: [r.x, 0, r.y + r.d - t], max: [r.x + r.w, wallHeight, r.y + r.d] });
    boxes.push({ room: r.name, part: 'wall-west', min: [r.x, 0, r.y], max: [r.x + t, wallHeight, r.y + r.d] });
    boxes.push({ room: r.name, part: 'wall-east', min: [r.x + r.w - t, 0, r.y], max: [r.x + r.w, wallHeight, r.y + r.d] });
  }
  return { units: 'metres', up: 'y', label: DRAFT_LABEL, rooms: clean, boxes, note: 'Door and window openings are not modelled in this draft.' };
}

// A walkthrough path: the camera visits each room centre at eye height. The
// furnished version adds illustrative furniture, labelled as illustration.
export function walkthrough(rooms, { furnished = false, eyeHeight = 1.6 } = {}) {
  const clean = validateRooms(rooms);
  const stops = clean.map((r) => ({ room: r.name, position: [r.x + r.w / 2, eyeHeight, r.y + r.d / 2], holdSeconds: 4 }));
  const furniture = furnished
    ? clean.flatMap((r) =>
        FURNITURE[r.type]
          .filter((f) => f.w <= r.w - 0.4 && f.d <= r.d - 0.4)
          .map((f, i) => ({ room: r.name, item: f.item, min: [r.x + 0.2 + i * 0.1, 0, r.y + 0.2], max: [r.x + 0.2 + i * 0.1 + f.w, f.h, r.y + 0.2 + f.d] })),
      )
    : [];
  return {
    version: furnished ? 'furnished' : 'unfurnished',
    label: furnished ? `${DRAFT_LABEL} Furniture is an illustration only.` : DRAFT_LABEL,
    stops,
    furniture,
  };
}

// A watermarked SVG of the plan, for the on-screen preview.
export function planPreviewSvg(project, { scale = 40 } = {}) {
  const rooms = project.inputs.rooms;
  if (!rooms) {
    throw new AppError('bad_plan', 'This project has no floor plan yet.');
  }
  const maxX = Math.max(...rooms.map((r) => r.x + r.w));
  const maxY = Math.max(...rooms.map((r) => r.y + r.d));
  // At least wide enough for the draft warning line, so it is never cut off.
  const w = Math.max(Math.ceil(maxX * scale) + 40, 620);
  const h = Math.ceil(maxY * scale) + 80;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(project.title)} draft plan">`,
    `<rect width="${w}" height="${h}" fill="#F7F5F0"/>`,
    `<text x="20" y="24" fill="#2B2D42" font-size="14" font-weight="600">${esc(project.title)}</text>`,
  ];
  for (const r of rooms) {
    const x = 20 + r.x * scale;
    const y = 40 + r.y * scale;
    parts.push(
      `<rect x="${x}" y="${y}" width="${r.w * scale}" height="${r.d * scale}" fill="#FFFFFF" stroke="#14213D" stroke-width="2"/>`,
      `<text x="${x + 6}" y="${y + 18}" fill="#2B2D42" font-size="12">${esc(r.name)}</text>`,
      `<text x="${x + 6}" y="${y + 34}" fill="#5C5F73" font-size="11">${r.w} x ${r.d} m, ${r.area} sq m</text>`,
    );
  }
  parts.push(
    `<text x="${w / 2}" y="${h / 2}" fill="#C8553D" fill-opacity="0.25" font-size="28" font-weight="700" text-anchor="middle" transform="rotate(-20 ${w / 2} ${h / 2})">DRAFT</text>`,
    `<text x="20" y="${h - 12}" fill="#C8553D" font-size="11">${esc(DRAFT_LABEL)}</text>`,
    '</svg>',
  );
  return parts.join('');
}

// Export is locked until the flag is on AND this project has its sign-off.
export function exportPlan(ctx, user, projectId) {
  const project = getProject(ctx, user, projectId);
  const t = projectType(project.type);
  const blocked = (reason) => {
    record(ctx, { actorId: user.id, action: 'studio.export_refused', target: projectId, detail: { reason } });
    return new AppError('gated', GATE_MESSAGE, 403, { reason });
  };
  if (!flagOn(ctx, 'studioPlanExport')) {
    throw blocked('Plan export is switched off until sign-off (compliance row 13).');
  }
  const signoff = projectSignoff(ctx, projectId, 13);
  if (!signoff) {
    throw blocked('No sign-off from a qualified person is recorded for this project.');
  }
  if (t.solicitorGate) {
    if (!flagOn(ctx, 'studioTitleSplitting')) {
      throw blocked('Title splitting is switched off until a solicitor signs off.');
    }
    const all = ctx.db.prepare('SELECT professional_role FROM signoffs WHERE project_id = ?').all(projectId);
    if (!all.some((s) => /solicitor/i.test(s.professional_role))) {
      throw blocked('Title splitting needs a solicitor’s sign-off for this project.');
    }
  }
  record(ctx, { actorId: user.id, action: 'studio.plan_exported', target: projectId, detail: { signoffId: signoff.id } });
  return {
    svg: planPreviewSvg(project),
    scope: draftScope(project),
    signoff: { professionalName: signoff.professionalName, professionalRole: signoff.professionalRole, reference: signoff.reference, signedOn: signoff.signedOn },
  };
}

// ---------- Virtual staging ----------

// The quote a person must see before any paid staging run. Nothing runs here.
export function quoteStagingRun({ tool, photoCount, pricePerPhotoPence }) {
  if (typeof tool !== 'string' || !tool.trim()) {
    throw new AppError('bad_quote', 'Name the staging tool.');
  }
  if (!Number.isInteger(photoCount) || photoCount < 1 || photoCount > 200) {
    throw new AppError('bad_quote', 'Choose between 1 and 200 photos.');
  }
  if (!Number.isInteger(pricePerPhotoPence) || pricePerPhotoPence < 0 || pricePerPhotoPence > 100000) {
    throw new AppError('bad_quote', 'The price per photo must be a whole number of pence.');
  }
  return { tool: tool.trim(), photoCount, totalPence: photoCount * pricePerPhotoPence, needsApproval: true };
}

// Records a staging job. The original photo reference is kept with it, every
// output is labelled, and a run only starts after a named person approves the quote.
export function createStagingJob(ctx, user, { originalRef, quote, approvedBy }) {
  if (!flagOn(ctx, 'studioVirtualStaging')) {
    throw new AppError('gated', GATE_MESSAGE, 403, { flag: 'studioVirtualStaging' });
  }
  if (!originalRef) {
    throw new AppError('bad_job', 'Keep the original photo: give its reference.');
  }
  if (!quote || quote.needsApproval !== true) {
    throw new AppError('bad_job', 'Show the cost first with a quote.');
  }
  if (typeof approvedBy !== 'string' || !approvedBy.trim() || /^(auto|system)$/i.test(approvedBy.trim())) {
    throw new AppError('approval_needed', 'A named person must approve the cost before any paid run.');
  }
  const job = { id: newId(), originalRef, label: STAGING_RULES.label, keepOriginal: true, rules: STAGING_RULES.allowed, forbidden: STAGING_RULES.forbidden, quote, approvedBy: approvedBy.trim(), at: iso(ctx) };
  record(ctx, { actorId: user.id, action: 'studio.staging_job_approved', target: job.id, detail: { originalRef, totalPence: quote.totalPence, approvedBy: job.approvedBy } });
  return job;
}
