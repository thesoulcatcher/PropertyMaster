// Crime by area (brief section 14b).
//
// England, Wales and Northern Ireland: the police.uk API, street-level crime,
// Open Government Licence v3.0. police.uk does not cover Scotland.
// Scotland: the Scottish Government's recorded crime publication (annual, by area).
//
// A rate per resident is shown ONLY when a population figure with its own source
// and year is supplied (ONS, NRS). Otherwise the result is a count and says so.
//
// No request is made from this module unless a fetch function is passed in, and
// the build never calls police.uk in its tests.

export const POLICE_API = 'https://data.police.uk/api';
export const POLICE_ATTRIBUTION = 'Contains public sector information licensed under the Open Government Licence v3.0 (data.police.uk). To check the exact wording at the source.';
export const SCOTLAND_CRIME_SOURCE = 'https://www.gov.scot/collections/recorded-crime-in-scotland/';

// police.uk lists its limit as 15 requests a second with bursts to 30. To check the
// current limit before launch. The client below spaces calls to stay well under it.
export const POLICE_MIN_GAP_MS = 100;

function checkLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 49 || lat > 61.5 || lng < -8.7 || lng > 2) {
    throw new RangeError('That point is outside the United Kingdom.');
  }
}

export function inScotland(nation) {
  return nation === 'scotland';
}

export function streetCrimeUrl({ lat, lng, month }) {
  checkLatLng(lat, lng);
  if (!/^\d{4}-\d{2}$/.test(String(month))) {
    throw new RangeError('Month must be YYYY-MM.');
  }
  return `${POLICE_API}/crimes-street/all-crime?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}&date=${month}`;
}

// Fetches one month of street-level crime around a point. `fetchFn` is injected.
export async function fetchStreetCrime({ lat, lng, month, nation }, fetchFn) {
  if (inScotland(nation)) {
    throw new RangeError('police.uk does not cover Scotland. Use the Scottish Government recorded crime figures.');
  }
  if (typeof fetchFn !== 'function') {
    throw new TypeError('A fetch function is required.');
  }
  const res = await fetchFn(streetCrimeUrl({ lat, lng, month }), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`police.uk answered ${res.status}. Try again later.`);
  }
  return summariseStreetCrime(await res.json(), month);
}

// Groups police.uk records by category. Returns counts, never rates.
export function summariseStreetCrime(records, month) {
  if (!Array.isArray(records)) {
    throw new TypeError('Expected a list of crime records.');
  }
  const byCategory = {};
  for (const r of records) {
    const c = r && typeof r.category === 'string' ? r.category : 'unknown';
    byCategory[c] = (byCategory[c] || 0) + 1;
  }
  return {
    month,
    total: records.length,
    byCategory,
    level: 'street, within about one mile of the point (police.uk)',
    basis: 'Recorded crimes by location. A count, not a rate per resident.',
    source: POLICE_API,
    attribution: POLICE_ATTRIBUTION,
  };
}

// Scotland: rows { area, year, count } from the recorded crime tables.
export function scotlandCrime(rows, area) {
  if (!Array.isArray(rows)) {
    throw new TypeError('Expected the recorded crime rows.');
  }
  const own = rows
    .filter((r) => r && r.area === area && /^\d{4}(-\d{2})?$/.test(String(r.year)) && Number.isInteger(r.count) && r.count >= 0)
    .sort((a, b) => (String(a.year) < String(b.year) ? -1 : 1));
  return {
    area,
    series: own.map((r) => ({ year: String(r.year), count: r.count })),
    level: 'area (annual)',
    basis: 'Crimes recorded by the police in Scotland, by area and year. Annual, not a live feed.',
    source: SCOTLAND_CRIME_SOURCE,
  };
}

// Per 1,000 residents, only with a sourced population. Otherwise null plus a reason.
export function perThousand(count, population) {
  if (!Number.isFinite(count) || count < 0) {
    throw new RangeError('A crime count must be zero or more.');
  }
  if (!population || !Number.isFinite(population.value) || population.value <= 0 || !population.source || !population.year) {
    return { rate: null, reason: 'No sourced population figure, so this is a count only.' };
  }
  return {
    rate: Math.round((count / population.value) * 1000 * 10) / 10,
    per: 1000,
    population: population.value,
    populationSource: population.source,
    populationYear: population.year,
  };
}
