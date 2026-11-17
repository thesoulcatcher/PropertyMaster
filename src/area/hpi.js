// UK House Price Index: parse the open CSV and work out appreciation and
// depreciation by area (brief section 14b).
//
// The CSV is the published UK HPI download (HM Land Registry with Registers of
// Scotland, Land and Property Services NI and the VOA), Open Government Licence.
// Column names are read from the header row, so a reordered file still parses.
// The exact column names are to check against the current download at
// https://www.gov.uk/government/statistical-data-sets/uk-house-price-index-data-downloads
// before the first real import.
//
// Every figure here is an average SOLD price index for an area and a month. It is
// not a valuation of any one property.

export const HPI_BASIS = 'Average sold prices (UK House Price Index), by area and month. Not a valuation.';
export const HPI_SOURCE = 'https://www.gov.uk/government/collections/uk-house-price-index-reports';
export const HPI_ATTRIBUTION = 'Contains HM Land Registry data © Crown copyright and database right. Licensed under the Open Government Licence v3.0. To check the exact wording at the source.';

// Minimal CSV parser: commas, double-quoted fields, doubled quotes inside quotes.
export function parseCsv(text) {
  if (typeof text !== 'string') {
    throw new TypeError('CSV text is required.');
  }
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

const COLUMN_NAMES = {
  date: ['Date'],
  region: ['RegionName', 'Region_Name'],
  code: ['AreaCode', 'Area_Code'],
  price: ['AveragePrice', 'Average_Price'],
  index: ['Index'],
};

function findColumn(header, names) {
  return header.findIndex((h) => names.includes(h.trim()));
}

// Returns rows { date: 'YYYY-MM', region, code, averagePrice, index } with bad
// rows skipped and counted, never turned into numbers.
export function parseHpi(text) {
  const [header, ...data] = parseCsv(text);
  if (!header) {
    throw new RangeError('The file is empty.');
  }
  const col = Object.fromEntries(Object.entries(COLUMN_NAMES).map(([k, names]) => [k, findColumn(header, names)]));
  for (const need of ['date', 'region', 'code', 'price']) {
    if (col[need] < 0) {
      throw new RangeError(`The file has no ${COLUMN_NAMES[need][0]} column. Check it is the UK HPI download.`);
    }
  }
  const rows = [];
  let skipped = 0;
  for (const r of data) {
    const date = normaliseMonth(r[col.date]);
    const price = Number(r[col.price]);
    if (!date || !Number.isFinite(price) || price <= 0 || price > 100_000_000) {
      skipped += 1;
      continue;
    }
    const index = col.index >= 0 ? Number(r[col.index]) : NaN;
    rows.push({ date, region: r[col.region].trim(), code: r[col.code].trim(), averagePrice: price, index: Number.isFinite(index) ? index : null });
  }
  return { rows, skipped };
}

// Accepts YYYY-MM-DD, YYYY-MM or DD/MM/YYYY and returns YYYY-MM, or null.
export function normaliseMonth(value) {
  const v = String(value || '').trim();
  let m = v.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (m) return Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${m[1]}-${m[2]}` : null;
  m = v.match(/^\d{2}\/(\d{2})\/(\d{4})$/);
  if (m) return Number(m[1]) >= 1 && Number(m[1]) <= 12 ? `${m[2]}-${m[1]}` : null;
  return null;
}

function monthsBack(month, n) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) - n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

// One area's series and its change over 1 and 5 years, with the period stated.
export function areaTrend(rows, code) {
  const series = rows.filter((r) => r.code === code).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (series.length === 0) {
    return null;
  }
  const latest = series[series.length - 1];
  const at = (month) => series.find((r) => r.date === month) || null;
  const change = (years) => {
    const past = at(monthsBack(latest.date, years * 12));
    if (!past) return null;
    return { from: past.date, to: latest.date, fromPrice: past.averagePrice, toPrice: latest.averagePrice, change: Math.round(((latest.averagePrice - past.averagePrice) / past.averagePrice) * 10000) / 10000 };
  };
  return {
    code,
    region: latest.region,
    series: series.map((r) => ({ date: r.date, averagePrice: r.averagePrice })),
    latest: { date: latest.date, averagePrice: latest.averagePrice },
    oneYear: change(1),
    fiveYear: change(5),
    basis: HPI_BASIS,
    source: HPI_SOURCE,
    attribution: HPI_ATTRIBUTION,
  };
}

// Change over `years` for every area in the file, for the heat map.
export function changeByArea(rows, years = 1) {
  const codes = [...new Set(rows.map((r) => r.code))];
  return codes
    .map((code) => {
      const t = areaTrend(rows, code);
      const c = years === 5 ? t.fiveYear : t.oneYear;
      return c ? { code, region: t.region, value: c.change, from: c.from, to: c.to } : null;
    })
    .filter(Boolean);
}
