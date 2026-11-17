import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAW_TOPICS, TO_CHECK, lawTable, lawTopics, LAW_DISCLAIMER } from '../src/data/law-by-nation.js';
import { PURCHASE_TAX } from '../src/data/purchase-tax.js';

test('every topic covers all four nations, Scotland first', () => {
  for (const { id } of lawTopics()) {
    const t = lawTable(id);
    assert.deepEqual(t.columns.map((c) => c.nation), ['scotland', 'england', 'wales', 'northern_ireland'], id);
  }
});

test('the brief topics are all present: purchase tax, tenancy, licensing, deposits', () => {
  const ids = LAW_TOPICS.map((t) => t.id);
  for (const need of ['purchase_tax', 'tenancy_type', 'hmo_licensing', 'landlord_registration', 'deposits']) {
    assert.ok(ids.includes(need), need);
  }
});

test('every verified row has an official source, a check date and a source date', () => {
  const official = /^https:\/\/(www\.)?(gov\.uk|mygov\.scot|gov\.scot|gov\.wales|nidirect\.gov\.uk|revenue\.scot|rentsmart\.gov\.wales|legislation\.gov\.uk|belfastcity\.gov\.uk)\//;
  for (const topic of LAW_TOPICS) {
    for (const [nation, row] of Object.entries(topic.rows)) {
      assert.match(row.source, official, `${topic.id} ${nation}`);
      if (row.verified) {
        assert.match(row.checkedOn, /^\d{4}-\d{2}-\d{2}$/, `${topic.id} ${nation}`);
        assert.ok(row.sourceDate, `${topic.id} ${nation} source date`);
      } else {
        assert.match(row.summary, /to check/i, `${topic.id} ${nation} unverified rows say so`);
      }
    }
  }
});

test('purchase tax rows come from the calculator table, so they cannot disagree', () => {
  const t = lawTable('purchase_tax');
  const scot = t.columns[0];
  assert.equal(scot.summary, PURCHASE_TAX.scotland.tax);
  assert.ok(scot.points.some((p) => p.includes('145,000 pounds to 250,000 pounds: 2%')));
  assert.ok(t.columns[2].points.some((p) => p.includes('17%')), 'Wales higher rates shown');
});

test('the disclaimer names the professionals and every gap is listed with where to check', () => {
  assert.match(LAW_DISCLAIMER, /not legal advice/);
  assert.match(LAW_DISCLAIMER, /solicitor/);
  assert.match(LAW_DISCLAIMER, /accountant/);
  for (const g of TO_CHECK) assert.ok(g.where.length > 0);
  assert.throws(() => lawTable('nope'), RangeError);
});
