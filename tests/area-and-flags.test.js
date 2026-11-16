import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREA_SOURCES, BLOCKED_SOURCES, AREA_DISCLAIMER, GEOGRAPHY_LEVELS } from '../src/data/area-sources.js';
import { FLAGS, isOn, gateLabel } from '../src/config/flags.js';

test('every area source has a URL, licence, attribution, level and wording', () => {
  for (const s of AREA_SOURCES) {
    assert.match(s.url, /^https:\/\//, `${s.id} url`);
    assert.ok(s.licence && s.licence.length > 0, `${s.id} licence`);
    assert.ok(s.attribution && s.attribution.length > 0, `${s.id} attribution`);
    assert.ok(s.level && s.level.length > 0, `${s.id} level`);
    assert.ok(s.wording && s.wording.length > 0, `${s.id} wording`);
  }
});

test('the SEPA flood wording says a low-risk result does not confirm no risk', () => {
  const sepa = AREA_SOURCES.find((s) => s.id === 'sepa-flood');
  assert.match(sepa.wording, /does not confirm that there is no risk/);
});

test('no blocked site is used as a source', () => {
  const names = AREA_SOURCES.map((s) => `${s.name} ${s.url}`.toLowerCase());
  for (const blocked of BLOCKED_SOURCES) {
    const key = blocked.name.split(' ')[0].toLowerCase();
    assert.ok(!names.some((n) => n.includes(key)), `${blocked.name} must not be a source`);
  }
});

test('the disclaimer says it is not advice and points to a professional', () => {
  assert.match(AREA_DISCLAIMER, /not advice/);
  assert.match(AREA_DISCLAIMER, /professional/);
});

test('the Scotland data zone level is listed', () => {
  assert.ok(GEOGRAPHY_LEVELS.includes('data zone (Scotland)'));
});

test('every gated feature is off by default', () => {
  for (const [name, flag] of Object.entries(FLAGS)) {
    assert.equal(flag.on, false, `${name} must be off`);
    assert.ok(flag.gate && flag.gate.length > 0, `${name} needs a gate label`);
  }
});

test('isOn and gateLabel refuse unknown flags', () => {
  assert.equal(isOn('insurance'), false);
  assert.match(gateLabel('insurance'), /^Gated: /);
  assert.throws(() => isOn('nope'), RangeError);
  assert.throws(() => gateLabel('nope'), RangeError);
});

test('no em dash appears in shipped source text', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const files = [
    '../src/data/area-sources.js',
    '../src/config/flags.js',
    '../src/data/purchase-tax.js',
    '../src/calc/purchase-tax.js',
    '../src/calc/investment.js',
    '../src/calc/hmo.js',
    '../src/calc/validate.js',
  ];
  const dir = path.dirname(fileURLToPath(import.meta.url));
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!text.includes(String.fromCharCode(0x2014)), `${f} contains an em dash`);
  }
});
