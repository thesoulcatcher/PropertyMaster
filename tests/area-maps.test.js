import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseHpi, areaTrend, changeByArea, normaliseMonth, HPI_BASIS } from '../src/area/hpi.js';
import { summariseStreetCrime, streetCrimeUrl, fetchStreetCrime, perThousand, scotlandCrime } from '../src/area/crime.js';
import { floodResult } from '../src/area/flood.js';
import { lineChart, heatGrid, choropleth, divergingClass, sequentialClass, divergingLegend, esc, DIVERGING } from '../src/area/charts.js';

// EXAMPLE DATA ONLY. These rows are made up for the tests and are not real prices.
function exampleCsv() {
  const lines = ['Date,RegionName,AreaCode,AveragePrice,Index'];
  for (let y = 2020; y <= 2025; y += 1) {
    for (let m = 1; m <= 12; m += 1) {
      const mm = String(m).padStart(2, '0');
      const step = (y - 2020) * 12 + (m - 1);
      lines.push(`${y}-${mm}-01,Example Town,X00000001,${100000 + step * 500},${100 + step / 2}`);
      lines.push(`${y}-${mm}-01,"Example, Falling",X00000002,${200000 - step * 400},${100 - step / 3}`);
    }
  }
  lines.push('not-a-date,Bad Row,X00000003,abc,1');
  return lines.join('\r\n');
}

test('CSV parser handles quotes, commas in quotes and CRLF', () => {
  const rows = parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'he said "hi"']]);
});

test('HPI parser keeps good rows, skips bad ones, and refuses a wrong file', () => {
  const { rows, skipped } = parseHpi(exampleCsv());
  assert.equal(rows.length, 144);
  assert.equal(skipped, 1);
  assert.equal(rows[1].region, 'Example, Falling');
  assert.throws(() => parseHpi('Name,Value\nx,1'), /no Date column/);
  assert.throws(() => parseHpi(''), /empty/);
});

test('months are normalised from three formats and nonsense is rejected', () => {
  assert.equal(normaliseMonth('2025-03-01'), '2025-03');
  assert.equal(normaliseMonth('2025-03'), '2025-03');
  assert.equal(normaliseMonth('01/03/2025'), '2025-03');
  assert.equal(normaliseMonth('2025-13-01'), null);
  assert.equal(normaliseMonth(''), null);
});

test('area trend gives 1 and 5 year change with the period and the sold-price basis', () => {
  const { rows } = parseHpi(exampleCsv());
  const t = areaTrend(rows, 'X00000001');
  assert.equal(t.latest.date, '2025-12');
  assert.equal(t.oneYear.from, '2024-12');
  assert.equal(t.fiveYear.from, '2020-12');
  assert.ok(t.oneYear.change > 0);
  assert.equal(t.basis, HPI_BASIS);
  assert.match(t.basis, /sold prices/i);
  assert.equal(areaTrend(rows, 'NOPE'), null);
  const all = changeByArea(rows, 1);
  assert.equal(all.length, 2);
  assert.ok(all.find((a) => a.code === 'X00000002').value < 0);
});

test('police.uk is never used for Scotland, and inputs are checked', async () => {
  await assert.rejects(() => fetchStreetCrime({ lat: 55.95, lng: -3.19, month: '2025-01', nation: 'scotland' }, async () => ({})), /does not cover Scotland/);
  assert.throws(() => streetCrimeUrl({ lat: 40, lng: 0, month: '2025-01' }), /outside the United Kingdom/);
  assert.throws(() => streetCrimeUrl({ lat: 52, lng: -1, month: '2025' }), /YYYY-MM/);
});

test('street crime is summarised as counts with a fake fetch, never a rate', async () => {
  const fake = async (url) => {
    assert.match(url, /^https:\/\/data\.police\.uk\/api\/crimes-street\/all-crime\?lat=52\.000000&lng=-1\.000000&date=2025-01$/);
    return { ok: true, json: async () => [{ category: 'burglary' }, { category: 'burglary' }, { category: 'vehicle-crime' }] };
  };
  const r = await fetchStreetCrime({ lat: 52, lng: -1, month: '2025-01', nation: 'england' }, fake);
  assert.equal(r.total, 3);
  assert.equal(r.byCategory.burglary, 2);
  assert.match(r.basis, /not a rate/);
  assert.deepEqual(summariseStreetCrime([], '2025-01').byCategory, {});
});

test('a rate per resident needs a sourced population', () => {
  assert.equal(perThousand(50, null).rate, null);
  assert.equal(perThousand(50, { value: 10000 }).rate, null);
  const r = perThousand(50, { value: 10000, source: 'NRS mid-year estimates (example)', year: '2024' });
  assert.equal(r.rate, 5);
  assert.throws(() => perThousand(-1, null), RangeError);
});

test('Scotland crime keeps only clean rows, in year order', () => {
  const r = scotlandCrime([{ area: 'Example Council', year: '2024-25', count: 10 }, { area: 'Example Council', year: '2023-24', count: 12 }, { area: 'Example Council', year: '2022', count: -5 }, { area: 'Other', year: '2024', count: 1 }], 'Example Council');
  assert.deepEqual(r.series.map((s) => s.year), ['2023-24', '2024-25']);
});

test('flood results always carry the wording, and a low result never says no risk', () => {
  const s = floodResult({ nation: 'scotland', level: 'low' });
  assert.match(s.wording, /assess areas, not individual properties/);
  assert.match(s.lowRiskNote, /does not confirm that there is no flood risk/);
  assert.match(s.attribution, /SEPA/);
  assert.equal(floodResult({ nation: 'england', level: 'high' }).lowRiskNote, null);
  assert.throws(() => floodResult({ nation: 'france', level: 'low' }), RangeError);
  assert.throws(() => floodResult({ nation: 'wales', level: 'none' }), RangeError);
});

test('diverging classes are symmetric with a neutral middle, sequential classes are bounded', () => {
  assert.equal(divergingClass(0), 3);
  assert.equal(divergingClass(0.5), 6);
  assert.equal(divergingClass(-0.5), 0);
  assert.equal(divergingClass(NaN), null);
  assert.equal(sequentialClass(0, 10), 0);
  assert.equal(sequentialClass(10, 10), 6);
  assert.equal(sequentialClass(5, 0), null);
  assert.equal(divergingLegend().length, 7);
  assert.equal(DIVERGING.light[3], '#D9D6CF');
});

test('charts escape names, show values in text, and refuse empty input', () => {
  const svg = heatGrid({ title: 'Example <change>', cells: [{ name: 'A & B', value: 0.05 }, { name: 'C', value: NaN }], source: 'Example data' });
  assert.ok(svg.includes('A &amp; B'));
  assert.ok(svg.includes('+5%'));
  assert.ok(svg.includes('no data'));
  assert.ok(!svg.includes('<change>'));
  assert.throws(() => heatGrid({ title: 'x', cells: [] }), RangeError);
  const line = lineChart({ title: 'Average sold price', points: [{ label: '2024-12', value: 150000 }, { label: '2025-12', value: 156000 }], source: 'Example' });
  assert.match(line, /<path d="M/);
  assert.throws(() => lineChart({ title: 'x', points: [] }), RangeError);
  assert.equal(esc('"<&>'), '&quot;&lt;&amp;&gt;');
});

test('a choropleth draws each area from GeoJSON with a tooltip', () => {
  const geojson = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { code: 'E1', name: 'Example North' }, geometry: { type: 'Polygon', coordinates: [[[-3.3, 56.0], [-3.1, 56.0], [-3.1, 56.1], [-3.3, 56.1], [-3.3, 56.0]]] } },
      { type: 'Feature', properties: { code: 'E2', name: 'Example South' }, geometry: { type: 'Polygon', coordinates: [[[-3.3, 55.9], [-3.1, 55.9], [-3.1, 56.0], [-3.3, 56.0], [-3.3, 55.9]]] } },
    ],
  };
  const svg = choropleth({ title: 'Example', geojson, values: { E1: 0.04, E2: -0.03 }, source: 'Example' });
  assert.equal((svg.match(/<path /g) || []).length, 2);
  assert.ok(svg.includes('Example North: +4%'));
  assert.throws(() => choropleth({ title: 'x', geojson: { features: [] }, values: {} }), RangeError);
});
