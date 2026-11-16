// Purchase tax calculator (SDLT, LBTT, LTT) by nation.
// Pure functions: no I/O, no globals. Tables come from src/data/purchase-tax.js.
// Every result carries the source, the table date and the verified flag, so the
// UI can show them next to the figure.

import { PURCHASE_TAX, NATIONS } from '../data/purchase-tax.js';

// Sanity cap: a residential price above this is treated as an input error.
export const MAX_PRICE = 1_000_000_000;

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function validatePrice(price) {
  if (price === null || price === undefined || price === '') {
    throw new TypeError('Price is required.');
  }
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new TypeError('Price must be a finite number.');
  }
  if (price < 0) {
    throw new RangeError('Price cannot be negative.');
  }
  if (price > MAX_PRICE) {
    throw new RangeError(`Price is above the sanity cap of ${MAX_PRICE}. Check the input.`);
  }
  return price;
}

// Returns { nation, tax, effectiveRate, breakdown, source, asOf, verified, note, surchargeApplied }
export function purchaseTax({ nation, price, additionalDwelling = false }) {
  if (!NATIONS.includes(nation)) {
    throw new RangeError(`Unknown nation "${nation}". Use one of: ${NATIONS.join(', ')}.`);
  }
  const p = validatePrice(price);
  const table = PURCHASE_TAX[nation];
  const surcharge = additionalDwelling ? table.surcharges?.additionalDwelling : null;

  const breakdown = [];
  let tax = 0;

  // A flat surcharge (Scotland ADS) is added after the band loop; a per-band
  // surcharge (England, Northern Ireland, Wales) is added to each band rate.
  for (const band of table.bands) {
    const top = band.to === null ? Infinity : band.to;
    const slice = Math.max(0, Math.min(p, top) - band.from);
    if (slice <= 0 && p <= band.from) {
      break;
    }
    const surchargeRate = surcharge && !surcharge.flat ? surcharge.rate : 0;
    const rate = band.rate + surchargeRate;
    const amount = slice * rate;
    breakdown.push({
      from: band.from,
      to: band.to,
      bandRate: band.rate,
      surchargeRate,
      rate,
      slice: round2(slice),
      tax: round2(amount),
    });
    tax += amount;
  }

  let flatSurcharge = 0;
  if (surcharge && surcharge.flat && p > 0) {
    flatSurcharge = p * surcharge.rate;
    tax += flatSurcharge;
  }

  const total = round2(tax);
  return {
    nation,
    tax: total,
    effectiveRate: p > 0 ? round2((total / p) * 10000) / 10000 : 0,
    breakdown,
    flatSurcharge: round2(flatSurcharge),
    surchargeApplied: Boolean(surcharge),
    taxName: table.tax,
    source: table.source,
    asOf: table.asOf,
    verified: table.verified,
    note: table.verified
      ? 'Band table verified on the date shown.'
      : 'NOT VERIFIED: rates are from memory. Check the source on the day of use before relying on this figure.',
  };
}
