// Compliance register and feature flags at run time.
//
// The register holds the fourteen gates from the brief (section 11). A gated
// feature opens only when BOTH of these are true:
//   1. a sign-off by the named kind of professional is recorded here, and
//   2. the owner switches the flag on, pointing at that sign-off.
// Every flag in src/config/flags.js starts off. Nothing here switches one on by
// itself, and a flag cannot be switched on without its sign-off.

import { AppError, iso, newId } from './context.js';
import { record } from './audit.js';
import { requirePermission } from './roles.js';
import { FLAGS } from '../config/flags.js';

export const COMPLIANCE_ROWS = [
  { row: 1, title: 'Financial promotion', who: 'An FCA-authorised firm approves the promotion', check: 'fca.org.uk (FSMA section 21)' },
  { row: 2, title: 'Joint ventures and pooled money', who: 'Solicitor', check: 'fca.org.uk (FSMA section 235, collective investment schemes)' },
  { row: 3, title: "Finder's fees and member-to-member payments", who: 'Solicitor and accountant; anti-money-laundering checks', check: 'gov.uk (money laundering regulations)' },
  { row: 4, title: 'Insurance', who: 'FCA authorisation, through a partner', check: 'register.fca.org.uk' },
  { row: 5, title: 'Conveyancing service', who: 'Law Society of Scotland (Scotland); SRA (England and Wales)', check: 'lawscot.org.uk and sra.org.uk' },
  { row: 6, title: 'Personal tax advice or schemes', who: 'Tax adviser registered for anti-money-laundering supervision', check: 'gov.uk (HMRC, GAAR and DOTAS)' },
  { row: 7, title: 'Lettings company', who: 'Letting agent registration and Code (Scotland); redress and client money protection (England); Rent Smart Wales; nidirect', check: 'gov.scot, gov.uk, rentsmart.gov.wales, nidirect.gov.uk' },
  { row: 8, title: 'Sourcing for other people', who: 'Dated briefing and solicitor sign-off', check: 'gov.uk (Estate Agents Act 1979) and the redress schemes' },
  { row: 9, title: 'Subscription rules', who: 'Owner, with legal advice', check: 'gov.uk (Digital Markets, Competition and Consumers Act 2024)' },
  { row: 10, title: 'Referral emails and offers', who: 'Owner, with legal advice', check: 'asa.org.uk (CAP Code) and ico.org.uk (PECR)' },
  { row: 11, title: 'Data protection', who: 'Owner; DPIA for AI chat and roleplay', check: 'ico.org.uk' },
  { row: 12, title: 'Trademark', who: 'Owner, with a trademark attorney if needed', check: 'ipo.gov.uk' },
  { row: 13, title: 'Architectural plans and building warrants', who: 'Architect, structural engineer or building control (a qualified person)', check: 'gov.scot (building standards), gov.uk (building regulations)' },
  { row: 14, title: 'Virtual staging disclosure', who: 'Owner, against the portal and ombudsman rules', check: 'tpos.co.uk, gov.uk (CMA), Rightmove and Zoopla photo rules' },
];

// Which register row each flag depends on.
export const FLAG_ROWS = {
  studioPlanExport: 13,
  studioTitleSplitting: 13,
  studioVirtualStaging: 14,
  lettingsModule: 7,
  jointVentures: 2,
  finderFees: 3,
  memberPayments: 3,
  insurance: 4,
  conveyancing: 5,
  sourcingForOthers: 8,
  propertyDataLicensed: null,
  homeDataLicensed: null,
  ownerOutreach: 8,
  paidAdvertising: null,
  referralEmails: 10,
  paidSubscriptions: 9,
  OUTREACH_DIRECT_TO_VENDOR: 8,
  OUTREACH_MAIL: 8,
  OUTREACH_CALL: 8,
  OUTREACH_EMAIL: 10,
  OUTREACH_SMS: 10,
  OUTREACH_PROBATE_INSOLVENCY: 8,
};

export const GATE_MESSAGE = 'This feature needs sign-off before it opens. Your Propertymaster team will tell you when it is ready.';

function knownFlag(name) {
  if (!FLAGS[name]) {
    throw new AppError('unknown_flag', `Unknown feature flag "${name}".`);
  }
  return FLAGS[name];
}

// A sign-off for a whole feature (flag) or for one Developer Studio project.
export function recordSignoff(ctx, actor, input = {}) {
  requirePermission(actor, 'owner.signoff.record');
  const row = COMPLIANCE_ROWS.find((r) => r.row === input.row);
  if (!row) {
    throw new AppError('bad_row', 'Choose a row from the compliance register.');
  }
  if (input.flag) knownFlag(input.flag);
  for (const field of ['professionalName', 'professionalRole', 'reference']) {
    if (typeof input[field] !== 'string' || !input[field].trim()) {
      throw new AppError('bad_signoff', 'A sign-off needs the professional, their role and a reference to the signed document.');
    }
  }
  if (typeof input.signedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.signedOn) || input.signedOn > iso(ctx).slice(0, 10)) {
    throw new AppError('bad_signoff', 'Give the date the sign-off was signed, today or earlier.');
  }
  const id = newId();
  ctx.db
    .prepare('INSERT INTO signoffs (id, compliance_row, flag, project_id, professional_name, professional_role, reference, signed_on, recorded_by, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, input.row, input.flag || null, input.projectId || null, input.professionalName.trim(), input.professionalRole.trim(), input.reference.trim(), input.signedOn, actor.id, iso(ctx));
  record(ctx, { actorId: actor.id, action: 'compliance.signoff_recorded', target: id, detail: { row: input.row, flag: input.flag || null, projectId: input.projectId || null } });
  return getSignoff(ctx, id);
}

function mapSignoff(r) {
  return r && {
    id: r.id,
    row: r.compliance_row,
    flag: r.flag,
    projectId: r.project_id,
    professionalName: r.professional_name,
    professionalRole: r.professional_role,
    reference: r.reference,
    signedOn: r.signed_on,
    recordedAt: r.recorded_at,
  };
}

export function getSignoff(ctx, id) {
  return mapSignoff(ctx.db.prepare('SELECT * FROM signoffs WHERE id = ?').get(id));
}

export function listSignoffs(ctx) {
  return ctx.db.prepare('SELECT * FROM signoffs ORDER BY recorded_at DESC').all().map(mapSignoff);
}

export function projectSignoff(ctx, projectId, row) {
  return mapSignoff(ctx.db.prepare('SELECT * FROM signoffs WHERE project_id = ? AND compliance_row = ? ORDER BY recorded_at DESC LIMIT 1').get(projectId, row));
}

// Is the flag on right now? The config default, unless the owner has set it.
export function flagOn(ctx, name) {
  const def = knownFlag(name);
  const override = ctx.db.prepare('SELECT is_on FROM flag_overrides WHERE name = ?').get(name);
  return override ? override.is_on === 1 : def.on === true;
}

export function setFlag(ctx, actor, name, on, { signoffId = null } = {}) {
  requirePermission(actor, 'owner.flags.set');
  knownFlag(name);
  if (typeof on !== 'boolean') {
    throw new AppError('bad_flag', 'A flag is switched on or off.');
  }
  if (on) {
    const row = FLAG_ROWS[name];
    const signoff = signoffId ? getSignoff(ctx, signoffId) : null;
    if (!signoff || signoff.flag !== name || (row && signoff.row !== row)) {
      throw new AppError('signoff_needed', `"${name}" cannot be switched on until its sign-off is recorded in the compliance register.`, 409);
    }
  }
  ctx.db
    .prepare('INSERT INTO flag_overrides (name, is_on, signoff_id, set_by, set_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET is_on = excluded.is_on, signoff_id = excluded.signoff_id, set_by = excluded.set_by, set_at = excluded.set_at')
    .run(name, on ? 1 : 0, on ? signoffId : null, actor.id, iso(ctx));
  record(ctx, { actorId: actor.id, action: on ? 'flag.switched_on' : 'flag.switched_off', target: name, detail: { signoffId: on ? signoffId : null } });
  return { name, on };
}

// Every flag with its state and its gate in plain words, for the admin screen
// and for labelling gated controls.
export function listFlags(ctx) {
  return Object.entries(FLAGS).map(([name, def]) => {
    const on = flagOn(ctx, name);
    return { name, on, row: FLAG_ROWS[name] ?? null, gate: def.gate, label: on ? 'On' : `Gated: ${def.gate}`, message: on ? null : GATE_MESSAGE };
  });
}

export function requireFlag(ctx, name) {
  if (!flagOn(ctx, name)) {
    throw new AppError('gated', GATE_MESSAGE, 403, { flag: name, gate: knownFlag(name).gate });
  }
}
