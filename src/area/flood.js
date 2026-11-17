// Flood risk results (brief section 14b). Scotland first.
//
// The flood bodies publish maps that assess AREAS, not single properties. Every
// result carries its body's wording and attribution, and a low result never
// says "no risk". The live lookups (SEPA, Environment Agency, Natural Resources
// Wales, Rivers Agency) are not connected in this build: each dataset's licence
// and access route is to check at its source first.

import { AREA_SOURCES, FLOOD_WORDING_SCOTLAND } from '../data/area-sources.js';

export const FLOOD_LEVELS = ['high', 'medium', 'low', 'not_assessed'];

const LABELS = {
  high: 'High likelihood in this area',
  medium: 'Medium likelihood in this area',
  low: 'Low likelihood in this area',
  not_assessed: 'Not assessed for this area',
};

const SOURCE_BY_NATION = {
  scotland: 'sepa-flood',
  england: 'ea-flood',
  wales: 'nrw-flood',
  northern_ireland: 'rivers-agency-flood',
};

export function floodResult({ nation, level, floodType = 'river', checkedOn = null }) {
  const sourceId = SOURCE_BY_NATION[nation];
  if (!sourceId) {
    throw new RangeError('Choose Scotland, England, Wales or Northern Ireland.');
  }
  if (!FLOOD_LEVELS.includes(level)) {
    throw new RangeError(`Flood level must be one of: ${FLOOD_LEVELS.join(', ')}.`);
  }
  const src = AREA_SOURCES.find((s) => s.id === sourceId);
  return {
    nation,
    floodType,
    level,
    label: LABELS[level],
    wording: nation === 'scotland' ? FLOOD_WORDING_SCOTLAND : src.wording,
    lowRiskNote: level === 'low' || level === 'not_assessed' ? 'A low or missing result does not confirm that there is no flood risk. Ask a surveyor or check with the insurer.' : null,
    sourceName: src.name,
    source: src.url,
    attribution: src.attribution,
    licence: src.licence,
    level_of_geography: src.level,
    checkedOn,
  };
}
