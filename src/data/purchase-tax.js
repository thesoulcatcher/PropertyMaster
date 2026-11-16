// Purchase tax bands by nation. Residential, standard rates only.
//
// STATUS: every table here is verified: false. These figures were written from
// memory and have NOT been checked against the official source on the day of use.
// Check each table at its source before any figure is shown to a member.
// Each band is a marginal slice: the rate applies only to the part of the price
// inside that band (the same way SDLT, LBTT and LTT are charged).
//
// bands: [{ from, to, rate }] where `to` is null for the top band.

export const PURCHASE_TAX = {
  england: {
    tax: 'SDLT (Stamp Duty Land Tax)',
    source: 'https://www.gov.uk/stamp-duty-land-tax/residential-property-rates',
    asOf: '2026-11-16',
    verified: false,
    surcharges: {
      additionalDwelling: { rate: 0.05, label: 'Higher rates for additional dwellings (added to each band rate)', verified: false },
    },
    bands: [
      { from: 0, to: 125000, rate: 0 },
      { from: 125000, to: 250000, rate: 0.02 },
      { from: 250000, to: 925000, rate: 0.05 },
      { from: 925000, to: 1500000, rate: 0.10 },
      { from: 1500000, to: null, rate: 0.12 },
    ],
  },
  northern_ireland: {
    tax: 'SDLT (Stamp Duty Land Tax), as in England',
    source: 'https://www.gov.uk/stamp-duty-land-tax/residential-property-rates',
    asOf: '2026-11-16',
    verified: false,
    note: 'Northern Ireland uses SDLT with the same residential bands as England. Check the nidirect page too.',
    surcharges: {
      additionalDwelling: { rate: 0.05, label: 'Higher rates for additional dwellings (added to each band rate)', verified: false },
    },
    bands: [
      { from: 0, to: 125000, rate: 0 },
      { from: 125000, to: 250000, rate: 0.02 },
      { from: 250000, to: 925000, rate: 0.05 },
      { from: 925000, to: 1500000, rate: 0.10 },
      { from: 1500000, to: null, rate: 0.12 },
    ],
  },
  scotland: {
    tax: 'LBTT (Land and Buildings Transaction Tax)',
    source: 'https://www.revenue.scot/taxes/land-buildings-transaction-tax/lbtt-rates-and-bands',
    asOf: '2026-11-16',
    verified: false,
    surcharges: {
      additionalDwelling: { rate: 0.08, label: 'Additional Dwelling Supplement (ADS), a flat rate on the whole price', verified: false, flat: true },
    },
    bands: [
      { from: 0, to: 145000, rate: 0 },
      { from: 145000, to: 250000, rate: 0.02 },
      { from: 250000, to: 325000, rate: 0.05 },
      { from: 325000, to: 750000, rate: 0.10 },
      { from: 750000, to: null, rate: 0.12 },
    ],
  },
  wales: {
    tax: 'LTT (Land Transaction Tax)',
    source: 'https://www.gov.wales/land-transaction-tax-rates',
    asOf: '2026-11-16',
    verified: false,
    surcharges: {
      additionalDwelling: { rate: 0.04, label: 'Higher rates for additional dwellings (added to each band rate)', verified: false },
    },
    bands: [
      { from: 0, to: 225000, rate: 0 },
      { from: 225000, to: 400000, rate: 0.06 },
      { from: 400000, to: 750000, rate: 0.075 },
      { from: 750000, to: 1500000, rate: 0.10 },
      { from: 1500000, to: null, rate: 0.12 },
    ],
  },
};

export const NATIONS = Object.keys(PURCHASE_TAX);
