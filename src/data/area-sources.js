// Area risk and appreciation sources for the area maps (brief section 14b).
// This file describes what each source is, its licence, the attribution it needs
// and the wording every result must carry. No data is fetched here.
// Licences and dataset terms are written from memory and must be checked at the
// source on the day of use (verified: false).

export const AREA_DISCLAIMER =
  'This is a general guide to investing by area and postcode. It is not advice. ' +
  'Check the figures at the source and speak to a qualified professional before any decision.';

export const FLOOD_WORDING_SCOTLAND =
  'SEPA flood maps assess areas, not individual properties. A low-risk result does not confirm that there is no risk.';

export const AREA_SOURCES = [
  {
    id: 'sepa-flood',
    kind: 'flood',
    nation: 'scotland',
    name: 'SEPA flood maps (river, coastal, surface water)',
    url: 'https://www.sepa.org.uk/environment/water/flooding/',
    licence: 'Open Government Licence',
    attribution: "Contains SEPA data. Use SEPA's own attribution statement; check the current wording.",
    level: 'area (not individual property)',
    wording: FLOOD_WORDING_SCOTLAND,
    verified: false,
  },
  {
    id: 'ea-flood',
    kind: 'flood',
    nation: 'england',
    name: 'Environment Agency flood risk datasets',
    url: 'https://www.gov.uk/guidance/flood-risk-assessment-data',
    licence: 'Open Government Licence for the open datasets. Some property-level data is not open: check each dataset.',
    attribution: 'Contains Environment Agency information. Check the dataset for the exact statement.',
    level: 'postcode or area, dataset dependent',
    wording: 'Flood risk datasets show areas and likelihoods. They do not confirm the risk to a single property.',
    verified: false,
  },
  {
    id: 'nrw-flood',
    kind: 'flood',
    nation: 'wales',
    name: 'Natural Resources Wales flood maps',
    url: 'https://www.naturalresources.wales/',
    licence: 'Check the licence on the dataset page before use.',
    attribution: 'Check the dataset page for the attribution statement.',
    level: 'area',
    wording: 'Flood maps show areas. They do not confirm the risk to a single property.',
    verified: false,
  },
  {
    id: 'rivers-agency-flood',
    kind: 'flood',
    nation: 'northern_ireland',
    name: 'Rivers Agency flood maps',
    url: 'https://www.infrastructure-ni.gov.uk/',
    licence: 'Check the licence on the dataset page before use.',
    attribution: 'Check the dataset page for the attribution statement.',
    level: 'area',
    wording: 'Flood maps show areas. They do not confirm the risk to a single property.',
    verified: false,
  },
  {
    id: 'police-uk-crime',
    kind: 'crime',
    nation: 'england_wales_ni',
    name: 'police.uk crime API (street-level crime)',
    url: 'https://data.police.uk/docs/',
    licence: 'Open Government Licence v3.0',
    attribution: 'Contains police data. Check the current wording on data.police.uk.',
    level: 'street or neighbourhood',
    rateLimit: 'Listed as 15 requests a second with bursts to 30. Check the current limit before launch.',
    wording: 'Counts are recorded crimes by location, not a rate per resident unless a population figure is sourced.',
    verified: false,
  },
  {
    id: 'scotland-crime',
    kind: 'crime',
    nation: 'scotland',
    name: 'Scottish Government recorded crime and clear-up rates',
    url: 'https://www.gov.scot/collections/recorded-crime-in-scotland/',
    licence: 'Open Government Licence',
    attribution: 'Check the publication for the attribution statement.',
    level: 'area (annual)',
    note: 'police.uk does not cover Scotland. This dataset is annual and area-level.',
    wording: 'Annual counts by area. Not a live feed.',
    verified: false,
  },
  {
    id: 'ukhpi',
    kind: 'appreciation',
    nation: 'uk',
    name: 'UK House Price Index (HM Land Registry, Registers of Scotland, LPS NI, VOA)',
    url: 'https://www.gov.uk/government/collections/uk-house-price-index-reports',
    licence: 'Open Government Licence (CSV download). Check each nation’s dataset.',
    attribution: 'Contains HM Land Registry data. Check each publisher for its statement.',
    level: 'area (region, local authority, postcode sector where published)',
    wording: 'Figures are sold prices for the period shown. Not valuations.',
    verified: false,
  },
];

// Every source must carry its licence, attribution, level, wording and a source URL.
// Blocked sources are listed so the build cannot quietly add them.
export const BLOCKED_SOURCES = [
  { name: 'Rightmove', reason: 'No scraping. Use only a licence they offer.' },
  { name: 'Zoopla', reason: 'No scraping. Use only a licence they offer.' },
  { name: 'Google Maps API (Android app)', reason: 'No Google SDK in the Android build (Phase 2).' },
];

export const GEOGRAPHY_LEVELS = [
  'postcode',
  'postcode sector',
  'postcode district',
  'data zone (Scotland)',
  'LSOA (England and Wales)',
  'SOA (Northern Ireland)',
];
