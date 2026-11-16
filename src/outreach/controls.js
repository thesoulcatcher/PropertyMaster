// Built-in outreach controls. These apply whether or not a flag is on.
//
// Draft-only mode: this module has NO send function. It can write a draft, record
// an approval, record consent and checks, and say whether a channel is allowed.
// "Allowed" means a person may decide to act outside this software after approval.
// Nothing here sends, calls, mails or texts anyone.

import { FLAGS, isOn } from '../config/flags.js';

export const CHANNEL_FLAGS = {
  direct_to_vendor: 'OUTREACH_DIRECT_TO_VENDOR',
  mail: 'OUTREACH_MAIL',
  call: 'OUTREACH_CALL',
  email: 'OUTREACH_EMAIL',
  sms: 'OUTREACH_SMS',
  probate_insolvency: 'OUTREACH_PROBATE_INSOLVENCY',
};

export const OPT_OUT_FOOTER =
  'You can ask us to stop contacting you at any time. Reply STOP, or tell us when you call.';

// The ledger holds opt-outs, consent, TPS and MPS results, reviews, approvals and the audit log.
// In this session it lives in memory. Persisting it is a Part B task (database and audit store).
export class OutreachLedger {
  constructor({ clock = () => new Date().toISOString() } = {}) {
    this.clock = clock;
    this.optOuts = new Map(); // contactKey -> Set of channels or 'all'
    this.consents = []; // { contact, channel, basis, source, at }
    this.tps = new Map(); // contactKey -> 'clear' | 'registered' | 'unchecked'
    this.mps = new Map();
    this.reviews = []; // { draftId, reviewer, note, at }
    this.drafts = new Map(); // id -> draft
    this.approvals = new Map(); // draftId -> { reviewer, at }
    this.audit_log = [];
  }

  audit(action, detail) {
    this.audit_log.push({ action, detail, at: this.clock() });
  }

  static key(contact) {
    if (!contact || typeof contact.reference !== 'string' || contact.reference.trim() === '') {
      throw new TypeError('A contact needs a reference (for example a lead id).');
    }
    return contact.reference.trim();
  }

  addOptOut(contact, channel = 'all', source = 'member request') {
    const k = OutreachLedger.key(contact);
    if (!this.optOuts.has(k)) {
      this.optOuts.set(k, new Set());
    }
    this.optOuts.get(k).add(channel);
    this.audit('opt_out', { contact: k, channel, source });
  }

  isOptedOut(contact, channel) {
    const set = this.optOuts.get(OutreachLedger.key(contact));
    return Boolean(set && (set.has('all') || set.has(channel)));
  }

  recordConsent(contact, channel, basis, source) {
    if (!basis || basis.trim() === '') {
      throw new TypeError('A consent record needs a lawful basis.');
    }
    if (!source || source.trim() === '') {
      throw new TypeError('A consent record needs a source (where and when consent was given).');
    }
    const record = { contact: OutreachLedger.key(contact), channel, basis, source, at: this.clock() };
    this.consents.push(record);
    this.audit('consent_recorded', record);
    return record;
  }

  hasConsent(contact, channel) {
    const k = OutreachLedger.key(contact);
    return this.consents.some((c) => c.contact === k && c.channel === channel);
  }

  recordTps(contact, result) {
    if (!['clear', 'registered', 'unchecked'].includes(result)) {
      throw new RangeError('TPS result must be clear, registered or unchecked.');
    }
    this.tps.set(OutreachLedger.key(contact), result);
    this.audit('tps_checked', { contact: OutreachLedger.key(contact), result });
  }

  recordMps(contact, result) {
    if (!['clear', 'registered', 'unchecked'].includes(result)) {
      throw new RangeError('MPS result must be clear, registered or unchecked.');
    }
    this.mps.set(OutreachLedger.key(contact), result);
    this.audit('mps_checked', { contact: OutreachLedger.key(contact), result });
  }

  recordReview(draftId, reviewer, note) {
    if (!reviewer || reviewer.trim() === '') {
      throw new TypeError('A review needs a named reviewer.');
    }
    const review = { draftId, reviewer, note: note || '', at: this.clock() };
    this.reviews.push(review);
    this.audit('human_review', review);
    return review;
  }

  hasReview(draftId) {
    return this.reviews.some((r) => r.draftId === draftId);
  }
}

// Draft a message from a template. Output is a draft only: it is never sent.
export function draftMessage(ledger, { channel, template, fields = {}, contact }) {
  if (!Object.prototype.hasOwnProperty.call(CHANNEL_FLAGS, channel)) {
    throw new RangeError(`Unknown channel "${channel}".`);
  }
  OutreachLedger.key(contact);
  if (typeof template !== 'string' || template.trim() === '') {
    throw new TypeError('A template is required.');
  }
  const missing = [];
  const body = template.replace(/\{(\w+)\}/g, (_, name) => {
    const v = fields[name];
    if (v === undefined || v === null || String(v).trim() === '') {
      missing.push(name);
      return '';
    }
    return String(v);
  });
  if (missing.length > 0) {
    throw new TypeError(`Missing template fields: ${missing.join(', ')}.`);
  }
  const id = `draft-${ledger.drafts.size + 1}`;
  const draft = {
    id,
    channel,
    contact: OutreachLedger.key(contact),
    status: 'draft',
    body: `${body}\n\n${OPT_OUT_FOOTER}`,
    requiresApproval: true,
    createdAt: ledger.clock(),
  };
  ledger.drafts.set(id, draft);
  ledger.audit('draft_created', { id, channel });
  return draft;
}

// A person approves a draft. No send follows: approval only records the decision.
export function approveDraft(ledger, draftId, reviewer) {
  const draft = ledger.drafts.get(draftId);
  if (!draft) {
    throw new RangeError(`No draft ${draftId}.`);
  }
  if (!reviewer || reviewer.trim() === '' || reviewer.toLowerCase() === 'auto') {
    throw new TypeError('Approval needs a named person. Automatic approval is not allowed.');
  }
  ledger.approvals.set(draftId, { reviewer, at: ledger.clock() });
  ledger.audit('draft_approved', { id: draftId, reviewer });
  return { ...draft, status: 'approved' };
}

// Decide whether a channel may be used for this contact right now.
// Returns { allowed, reasons }. Every reason is plain words.
export function checkChannel(ledger, { channel, contact, draftId = null }) {
  const reasons = [];
  const flagName = CHANNEL_FLAGS[channel];
  if (!flagName) {
    throw new RangeError(`Unknown channel "${channel}".`);
  }
  const k = OutreachLedger.key(contact);

  if (!isOn(flagName)) {
    reasons.push(`Switched off: ${FLAGS[flagName].gate}`);
  }
  if (ledger.isOptedOut(contact, channel) || ledger.isOptedOut(contact, 'all')) {
    reasons.push('This contact has opted out. Opt-outs apply to every channel.');
  }
  if (channel === 'call' && ledger.tps.get(k) !== 'clear') {
    reasons.push('TPS check must be clear before any call. Record the result first.');
  }
  if (channel === 'mail' && ledger.mps.get(k) !== 'clear') {
    reasons.push('MPS check must be clear before any mailing. Record the result first.');
  }
  if ((channel === 'email' || channel === 'sms') && !ledger.hasConsent(contact, channel)) {
    reasons.push('No consent recorded for this channel. Record the basis and source first.');
  }
  if (channel === 'probate_insolvency' && (!draftId || !ledger.hasReview(draftId))) {
    reasons.push('A dated, human-reviewed step is required before any approach. Record the review first.');
  }
  if (!draftId) {
    reasons.push('No draft. Create a draft and have a person approve it.');
  } else if (!ledger.approvals.has(draftId)) {
    reasons.push('Not yet approved by a person.');
  }

  return { allowed: reasons.length === 0, reasons, sends: false };
}
