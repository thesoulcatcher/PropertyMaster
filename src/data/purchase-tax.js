// Purchase tax bands by nation. Residential, standard rates only.
//
// STATUS: every table here was read at its official source on 2026-11-17 and is
// marked verified: true with that date. Two dates are kept apart on purpose:
//   checkedOn  the day this build read the official page
//   ratesFrom  the date the SOURCE says the rates apply from (or says nothing)
// Rates change. Check the source again on the day a figure is relied on.
//
// Each band is a marginal slice: the rate applies only to the part of the price
// inside that band (the same way SDLT, LBTT and LTT are charged).
//
// bands: [{ from, to, rate }] where `to` is null for the top band.
//
// Additional dwelling surcharges come in three shapes, because the nations differ:
//   kind 'added'  a number of points added to every band rate (England, Northern Ireland)
//   kind 'flat'   a flat rate on the whole price above a minimum price (Scotland, ADS)
//   kind 'table'  a separate set of higher-rate bands that replaces the main table (Wales)
//
// Scotland comes first wherever the nations are listed.

const SDLT_BANDS = [
  { from: 0, to: 125000, rate: 0 },
  { from: 125000, to: 250000, rate: 0.02 },
  { from: 250000, to: 925000, rate: 0.05 },
  { from: 925000, to: 1500000, rate: 0.10 },
  { from: 1500000, to: null, rate: 0.12 },
];

const SDLT_SOURCE = 'https://www.gov.uk/stamp-duty-land-tax/residential-property-rates';

const SDLT_SURCHARGE = {
  kind: 'added',
  rate: 0.05,
  label: 'Higher rates for additional dwellings: 5 points on top of each band rate',
  verified: true,
  note: 'The gov.uk rates page states no minimum price for the surcharge. To check at gov.uk: the rule for purchases under 40,000 pounds.',
};

export const PURCHASE_TAX = {
  scotland: {
    tax: 'LBTT (Land and Buildings Transaction Tax)',
    source: 'https://revenue.scot/taxes/land-buildings-transaction-tax/residential-property',
    checkedOn: '2026-11-17',
    asOf: '2026-11-17',
    ratesFrom: 'Revenue Scotland states these bands "as of 1 April 2021". Its page revisions list shows 28 August 2026 as the newest entry.',
    verified: true,
    surcharges: {
      additionalDwelling: {
        kind: 'flat',
        rate: 0.08,
        minPrice: 40000,
        label: 'Additional Dwelling Supplement (ADS): 8% of the purchase price',
        source: 'https://revenue.scot/taxes/land-buildings-transaction-tax/additional-dwelling-supplement-ads',
        ratesFrom: 'Revenue Scotland: 8% for transactions on or after 5 December 2024. The ADS does not apply where the price is less than 40,000 pounds.',
        verified: true,
      },
    },
    reliefs: [
      { name: 'First-time buyer relief', detail: 'Raises the nil rate band to 175,000 pounds (Revenue Scotland, read 2026-11-17). Not applied by this calculator.' },
    ],
    bands: [
      { from: 0, to: 145000, rate: 0 },
      { from: 145000, to: 250000, rate: 0.02 },
      { from: 250000, to: 325000, rate: 0.05 },
      { from: 325000, to: 750000, rate: 0.10 },
      { from: 750000, to: null, rate: 0.12 },
    ],
  },
  england: {
    tax: 'SDLT (Stamp Duty Land Tax)',
    source: SDLT_SOURCE,
    checkedOn: '2026-11-17',
    asOf: '2026-11-17',
    ratesFrom: 'The gov.uk page states no start date for these rates and shows no last-updated date.',
    verified: true,
    surcharges: { additionalDwelling: SDLT_SURCHARGE },
    reliefs: [
      { name: 'First-time buyer relief', detail: 'No SDLT up to 300,000 pounds and 5% from 300,001 to 500,000 pounds; no relief above 500,000 pounds (gov.uk, read 2026-11-17). Not applied by this calculator.' },
      { name: 'Non-UK resident surcharge', detail: 'A 2% surcharge for non-UK residents (gov.uk, read 2026-11-17). Not applied by this calculator.' },
    ],
    bands: SDLT_BANDS,
  },
  wales: {
    tax: 'LTT (Land Transaction Tax)',
    source: 'https://www.gov.wales/land-transaction-tax-rates-and-bands',
    checkedOn: '2026-11-17',
    asOf: '2026-11-17',
    ratesFrom: 'gov.wales: main residential rates from 10 October 2022. Page last updated 10 December 2024.',
    verified: true,
    surcharges: {
      additionalDwelling: {
        kind: 'table',
        label: 'Higher residential rates: a separate band table that replaces the main one',
        ratesFrom: 'gov.wales: higher residential rates from 11 December 2024.',
        verified: true,
        bands: [
          { from: 0, to: 180000, rate: 0.05 },
          { from: 180000, to: 250000, rate: 0.085 },
          { from: 250000, to: 400000, rate: 0.10 },
          { from: 400000, to: 750000, rate: 0.125 },
          { from: 750000, to: 1500000, rate: 0.15 },
          { from: 1500000, to: null, rate: 0.17 },
        ],
      },
    },
    reliefs: [],
    bands: [
      { from: 0, to: 225000, rate: 0 },
      { from: 225000, to: 400000, rate: 0.06 },
      { from: 400000, to: 750000, rate: 0.075 },
      { from: 750000, to: 1500000, rate: 0.10 },
      { from: 1500000, to: null, rate: 0.12 },
    ],
  },
  northern_ireland: {
    tax: 'SDLT (Stamp Duty Land Tax), as in England',
    source: SDLT_SOURCE,
    checkedOn: '2026-11-17',
    asOf: '2026-11-17',
    ratesFrom: 'The gov.uk page states no start date for these rates and shows no last-updated date.',
    verified: true,
    note: 'SDLT covers England and Northern Ireland with the same residential bands (gov.uk, read 2026-11-17).',
    surcharges: { additionalDwelling: SDLT_SURCHARGE },
    reliefs: [],
    bands: SDLT_BANDS,
  },
};

// Scotland first, then England, Wales and Northern Ireland.
export const NATIONS = ['scotland', 'england', 'wales', 'northern_ireland'];

export const NATION_LABELS = {
  scotland: 'Scotland',
  england: 'England',
  wales: 'Wales',
  northern_ireland: 'Northern Ireland',
};
