// Graphs, heat maps and maps for the area pages, drawn as SVG strings so the same
// code serves the website, the desktop app and exported reports. No map tiles
// and no map SDK: area shapes come in as GeoJSON from open boundary data
// (ONS, NRS, OSNI; licences to check at source).
//
// Colour, per the dataviz method used in this build:
//   appreciation and depreciation are DIVERGING: clay for falls, teal for rises,
//   and a neutral grey midpoint for little change;
//   crime counts are SEQUENTIAL: one teal hue, light to dark.
// The teal and clay pair passed the palette validator (light mode) on 2026-11-17.
// Every chart has a title, a text table alternative and the source line, so no
// meaning depends on colour alone.

import { AREA_DISCLAIMER } from '../data/area-sources.js';

export const DIVERGING = {
  light: ['#9E3A26', '#C8553D', '#E2A08F', '#D9D6CF', '#8CCBC2', '#1B998B', '#11665D'],
  dark: ['#E07A63', '#C8553D', '#7A3F33', '#55575F', '#2E6F67', '#1B998B', '#5CC7B8'],
};

export const SEQUENTIAL = {
  light: ['#E3F2F0', '#B3DDD7', '#7FC4BA', '#4BAA9D', '#1B998B', '#137568', '#0C4F47'],
  dark: ['#15302D', '#1D4C46', '#24685F', '#2C8578', '#3AA294', '#62BFB2', '#93D8CE'],
};

const INK = { light: { text: '#2B2D42', muted: '#5C5F73', grid: '#DAD6CC', surface: '#F7F5F0' }, dark: { text: '#F7F5F0', muted: '#B9B6AE', grid: '#3A3C52', surface: '#14213D' } };

export function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function pctLabel(v) {
  const p = Math.round(v * 1000) / 10;
  return `${p > 0 ? '+' : ''}${p}%`;
}

// Seven classes symmetric around zero. `step` is the width of one class.
export function divergingClass(value, step = 0.02) {
  if (!Number.isFinite(value)) return null;
  const k = Math.round(value / step);
  return Math.max(-3, Math.min(3, k)) + 3;
}

export function sequentialClass(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0 || value < 0) return null;
  return Math.min(6, Math.floor((value / max) * 7));
}

export function divergingLegend(step = 0.02) {
  return [-3, -2, -1, 0, 1, 2, 3].map((k, i) => ({
    index: i,
    label: k === 0 ? `Within ${pctLabel(step / 2).replace('+', '')} either way` : k < 0 ? `Fall about ${pctLabel(k * step).replace('-', '')}${k === -3 ? ' or more' : ''}` : `Rise about ${pctLabel(k * step).replace('+', '')}${k === 3 ? ' or more' : ''}`,
  }));
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// One series over time. points: [{ label, value }]. A single series needs no
// legend: the title names it.
export function lineChart({ title, points, valueFormat = (v) => `£${Math.round(v).toLocaleString('en-GB')}`, source, mode = 'light', width = 640, height = 280 }) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new RangeError('A line chart needs at least one point.');
  }
  const ink = INK[mode];
  const pad = { l: 72, r: 16, t: 36, b: 48 };
  const values = points.map((p) => p.value);
  const max = niceMax(Math.max(...values));
  const x = (i) => pad.l + (points.length === 1 ? 0 : (i / (points.length - 1)) * (width - pad.l - pad.r));
  const y = (v) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const every = Math.max(1, Math.ceil(points.length / 6));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">`,
    `<rect width="${width}" height="${height}" fill="${ink.surface}"/>`,
    `<text x="${pad.l}" y="20" fill="${ink.text}" font-size="14" font-weight="600">${esc(title)}</text>`,
    ...ticks.map((t) => `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="${ink.grid}" stroke-width="1"/><text x="${pad.l - 8}" y="${(y(t) + 4).toFixed(1)}" fill="${ink.muted}" font-size="11" text-anchor="end">${esc(valueFormat(t))}</text>`),
    ...points.map((p, i) => (i % every === 0 || i === points.length - 1 ? `<text x="${x(i).toFixed(1)}" y="${height - pad.b + 18}" fill="${ink.muted}" font-size="11" text-anchor="middle">${esc(p.label)}</text>` : '')),
    `<path d="${path}" fill="none" stroke="#1B998B" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    ...points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="8" fill="transparent"><title>${esc(p.label)}: ${esc(valueFormat(p.value))}</title></circle>`),
    `<circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="4" fill="#1B998B" stroke="${ink.surface}" stroke-width="2"/>`,
    `<text x="${pad.l}" y="${height - 8}" fill="${ink.muted}" font-size="10">${esc(source || '')}</text>`,
    '</svg>',
  ].join('');
}

// A grid heat map: one cell per area, coloured by its class, labelled with its
// name and value so colour is never the only cue.
export function heatGrid({ title, cells, kind = 'diverging', step = 0.02, max = null, mode = 'light', columns = 4, cellW = 150, cellH = 56, source }) {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw new RangeError('A heat map needs at least one area.');
  }
  const ink = INK[mode];
  const ramp = kind === 'diverging' ? DIVERGING[mode] : SEQUENTIAL[mode];
  const top = Math.max(...cells.map((c) => c.value).filter(Number.isFinite), 0);
  const rows = Math.ceil(cells.length / columns);
  const width = columns * (cellW + 2) + 2;
  const height = 36 + rows * (cellH + 2) + 28;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">`,
    `<rect width="${width}" height="${height}" fill="${ink.surface}"/>`,
    `<text x="2" y="20" fill="${ink.text}" font-size="14" font-weight="600">${esc(title)}</text>`,
  ];
  cells.forEach((c, i) => {
    const cls = kind === 'diverging' ? divergingClass(c.value, step) : sequentialClass(c.value, max ?? top);
    const fill = cls === null ? ink.grid : ramp[cls];
    const dark = cls !== null && (kind === 'diverging' ? cls <= 1 || cls >= 5 : cls >= 4);
    const text = dark ? '#FFFFFF' : '#2B2D42';
    const cx = 2 + (i % columns) * (cellW + 2);
    const cy = 30 + Math.floor(i / columns) * (cellH + 2);
    const shown = kind === 'diverging' ? (Number.isFinite(c.value) ? pctLabel(c.value) : 'no data') : Number.isFinite(c.value) ? c.value.toLocaleString('en-GB') : 'no data';
    parts.push(
      `<g><title>${esc(c.name)}: ${esc(shown)}</title><rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" rx="4" fill="${fill}"/>`,
      `<text x="${cx + 8}" y="${cy + 22}" fill="${text}" font-size="12">${esc(c.name)}</text>`,
      `<text x="${cx + 8}" y="${cy + 42}" fill="${text}" font-size="13" font-weight="600">${esc(shown)}</text></g>`,
    );
  });
  parts.push(`<text x="2" y="${height - 8}" fill="${ink.muted}" font-size="10">${esc(source || '')}</text>`, '</svg>');
  return parts.join('');
}

// Simple equirectangular projection fitted to the shapes' bounds, corrected for
// latitude so Scotland does not look stretched.
function projector(features, width, height) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const each = (coords) => {
    if (typeof coords[0] === 'number') {
      minX = Math.min(minX, coords[0]); maxX = Math.max(maxX, coords[0]);
      minY = Math.min(minY, coords[1]); maxY = Math.max(maxY, coords[1]);
    } else coords.forEach(each);
  };
  features.forEach((f) => each(f.geometry.coordinates));
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const sx = (width - 20) / Math.max(1e-9, (maxX - minX) * k);
  const sy = (height - 20) / Math.max(1e-9, maxY - minY);
  const s = Math.min(sx, sy);
  return ([lng, lat]) => [10 + (lng - minX) * k * s, 10 + (maxY - lat) * s];
}

function ringPath(ring, project) {
  return `${ring.map((pt, i) => { const [x, y] = project(pt); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join('')}Z`;
}

// A choropleth from GeoJSON features with properties { code, name }. values maps
// code to number.
export function choropleth({ title, geojson, values, kind = 'diverging', step = 0.02, mode = 'light', width = 480, height = 560, source }) {
  const features = (geojson && geojson.features) || [];
  const shapes = features.filter((f) => f.geometry && ['Polygon', 'MultiPolygon'].includes(f.geometry.type));
  if (shapes.length === 0) {
    throw new RangeError('The map needs at least one area shape.');
  }
  const ink = INK[mode];
  const ramp = kind === 'diverging' ? DIVERGING[mode] : SEQUENTIAL[mode];
  const project = projector(shapes, width, height - 40);
  const top = Math.max(0, ...Object.values(values).filter(Number.isFinite));
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">`,
    `<rect width="${width}" height="${height}" fill="${ink.surface}"/>`,
    `<text x="10" y="20" fill="${ink.text}" font-size="14" font-weight="600">${esc(title)}</text>`,
    '<g transform="translate(0,24)">',
  ];
  for (const f of shapes) {
    const { code, name } = f.properties || {};
    const v = values[code];
    const cls = kind === 'diverging' ? divergingClass(v, step) : sequentialClass(v, top);
    const fill = cls === null ? ink.grid : ramp[cls];
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const d = polys.map((poly) => poly.map((ring) => ringPath(ring, project)).join('')).join('');
    const shown = Number.isFinite(v) ? (kind === 'diverging' ? pctLabel(v) : v.toLocaleString('en-GB')) : 'no data';
    parts.push(`<path d="${d}" fill="${fill}" stroke="${ink.surface}" stroke-width="2" fill-rule="evenodd"><title>${esc(name || code)}: ${esc(shown)}</title></path>`);
  }
  parts.push('</g>', `<text x="10" y="${height - 8}" fill="${ink.muted}" font-size="10">${esc(source || '')}</text>`, '</svg>');
  return parts.join('');
}

// The text table that sits under every chart, plus the disclaimer.
export function tableAlternative(rows, columns) {
  return {
    columns,
    rows: rows.map((r) => columns.map((c) => r[c.key])),
    disclaimer: AREA_DISCLAIMER,
  };
}
