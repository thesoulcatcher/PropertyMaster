import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAGS } from '../src/config/flags.js';
import { OFF_MARKET_MENU, OUTREACH_MENU, menuView, SECTIONS } from '../src/outreach/menus.js';
import * as controls from '../src/outreach/controls.js';
import { OutreachLedger, draftMessage, approveDraft, checkChannel } from '../src/outreach/controls.js';

const OUTREACH_FLAG_NAMES = [
  'OUTREACH_DIRECT_TO_VENDOR',
  'OUTREACH_MAIL',
  'OUTREACH_CALL',
  'OUTREACH_EMAIL',
  'OUTREACH_SMS',
  'OUTREACH_PROBATE_INSOLVENCY',
];

const contact = { reference: 'lead-1' };

test('all six outreach flags exist and default to off, each with a gate', () => {
  for (const name of OUTREACH_FLAG_NAMES) {
    assert.ok(FLAGS[name], `${name} missing`);
    assert.equal(FLAGS[name].on, false, `${name} must default off`);
    assert.ok(FLAGS[name].gate.length > 0);
  }
});

test('menus: Off-Market Finder and Outreach list the requested items', () => {
  const finder = OFF_MARKET_MENU.items.map((i) => i.label);
  assert.deepEqual(finder, ['Leads', 'Pre-auction', 'Probate', 'Insolvency', 'Repossession', 'Long-empty', 'Network', 'Alerts']);
  const outreach = OUTREACH_MENU.items.map((i) => i.label);
  assert.deepEqual(outreach, [
    'Campaigns', 'Direct to vendor', 'Mail', 'Call', 'Email', 'Text', 'Replies',
    'Opt-outs', 'Suppression lists', 'Consent log', 'Templates', 'Tracking sheet',
  ]);
});

test('gated menu items stay visible, disabled, with the gate in plain words', () => {
  for (const section of SECTIONS) {
    const view = menuView(OUTREACH_MENU, section);
    const call = view.items.find((i) => i.id === 'call');
    assert.equal(call.visible, true);
    assert.equal(call.enabled, false);
    assert.match(call.gate, /^Off: /);
    assert.match(call.gate, /TPS/);
  }
});

test('the same menus serve both sections', () => {
  const dev = menuView(OUTREACH_MENU, 'developer');
  const agent = menuView(OUTREACH_MENU, 'estate_agent');
  assert.deepEqual(dev.items.map((i) => i.id), agent.items.map((i) => i.id));
  assert.throws(() => menuView(OUTREACH_MENU, 'landlord'), RangeError);
});

test('ungated menu items are enabled', () => {
  const view = menuView(OFF_MARKET_MENU, 'developer');
  assert.equal(view.items.find((i) => i.id === 'leads').enabled, true);
  assert.equal(view.items.find((i) => i.id === 'leads').gate, null);
});

test('with every flag off, no channel is allowed, even with consent and approval', () => {
  const ledger = new OutreachLedger();
  ledger.recordConsent(contact, 'email', 'consent', 'web form, 1 Nov 2026');
  ledger.recordTps(contact, 'clear');
  ledger.recordMps(contact, 'clear');
  const d = draftMessage(ledger, { channel: 'email', template: 'Hello {name}', fields: { name: 'A' }, contact });
  approveDraft(ledger, d.id, 'Owner');
  const r = checkChannel(ledger, { channel: 'email', contact, draftId: d.id });
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => x.startsWith('Switched off')));
  assert.equal(r.sends, false);
});

test('opt-outs apply across channels', () => {
  const ledger = new OutreachLedger();
  ledger.addOptOut(contact, 'mail', 'asked by letter');
  assert.equal(ledger.isOptedOut(contact, 'mail'), true);
  assert.equal(ledger.isOptedOut(contact, 'email'), false);
  ledger.addOptOut(contact, 'all', 'asked by phone');
  assert.equal(ledger.isOptedOut(contact, 'email'), true);
  assert.equal(ledger.isOptedOut(contact, 'sms'), true);
});

test('call needs a clear TPS check, mail needs a clear MPS check', () => {
  const ledger = new OutreachLedger();
  assert.match(checkChannel(ledger, { channel: 'call', contact }).reasons.join(' '), /TPS/);
  ledger.recordTps(contact, 'registered');
  assert.match(checkChannel(ledger, { channel: 'call', contact }).reasons.join(' '), /TPS/);
  assert.match(checkChannel(ledger, { channel: 'mail', contact }).reasons.join(' '), /MPS/);
});

test('email and SMS need recorded consent with a basis and source', () => {
  const ledger = new OutreachLedger();
  assert.throws(() => ledger.recordConsent(contact, 'email', '', 'form'), TypeError);
  assert.throws(() => ledger.recordConsent(contact, 'email', 'consent', ''), TypeError);
  assert.match(checkChannel(ledger, { channel: 'email', contact }).reasons.join(' '), /No consent/);
});

test('probate and insolvency need a named, human-reviewed step', () => {
  const ledger = new OutreachLedger();
  const d = draftMessage(ledger, { channel: 'probate_insolvency', template: 'Hello', contact });
  approveDraft(ledger, d.id, 'Reviewer');
  const r = checkChannel(ledger, { channel: 'probate_insolvency', contact, draftId: d.id });
  assert.match(r.reasons.join(' '), /human-reviewed/);
  assert.throws(() => ledger.recordReview(d.id, '   ', 'note'), TypeError);
});

test('drafts are never sent: status draft, approval required, footer with opt-out', () => {
  const ledger = new OutreachLedger();
  const d = draftMessage(ledger, { channel: 'mail', template: 'Dear {name}', fields: { name: 'Sam' }, contact });
  assert.equal(d.status, 'draft');
  assert.equal(d.requiresApproval, true);
  assert.match(d.body, /Dear Sam/);
  assert.match(d.body, /Reply STOP/);
});

test('a draft with a missing or blank field is refused', () => {
  const ledger = new OutreachLedger();
  assert.throws(() => draftMessage(ledger, { channel: 'mail', template: 'Dear {name}', fields: { name: '  ' }, contact }), TypeError);
  assert.throws(() => draftMessage(ledger, { channel: 'mail', template: 'Dear {name}', fields: {}, contact }), TypeError);
});

test('automatic approval is refused; a named person must approve', () => {
  const ledger = new OutreachLedger();
  const d = draftMessage(ledger, { channel: 'mail', template: 'Hi', contact });
  assert.throws(() => approveDraft(ledger, d.id, 'auto'), TypeError);
  assert.throws(() => approveDraft(ledger, d.id, ''), TypeError);
  assert.equal(approveDraft(ledger, d.id, 'Bruce').status, 'approved');
});

test('the module exposes no send function', () => {
  const names = Object.keys(controls);
  for (const n of names) {
    assert.doesNotMatch(n, /send|dial|call|post|mail|text|sms|deliver/i, `export ${n} looks like a send path`);
  }
});

test('every decision is written to the audit log', () => {
  const ledger = new OutreachLedger();
  ledger.addOptOut(contact, 'all');
  ledger.recordTps(contact, 'clear');
  const actions = ledger.audit_log.map((a) => a.action);
  assert.deepEqual(actions, ['opt_out', 'tps_checked']);
});

test('unknown channel is refused', () => {
  const ledger = new OutreachLedger();
  assert.throws(() => checkChannel(ledger, { channel: 'fax', contact }), RangeError);
  assert.throws(() => draftMessage(ledger, { channel: 'fax', template: 'x', contact }), RangeError);
});
