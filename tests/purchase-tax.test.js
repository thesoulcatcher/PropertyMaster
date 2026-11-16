import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseTax, validatePrice, MAX_PRICE } from '../src/calc/purchase-tax.js';

test('England: zero price gives zero tax', () => {
  const r = purchaseTax({ nation: 'england', price: 0 });
  assert.equal(r.tax, 0);
  assert.equal(r.effectiveRate, 0);
});

test('England: price inside the nil-rate band gives zero tax', () => {
  assert.equal(purchaseTax({ nation: 'england', price: 125000 }).tax, 0);
});

test('England: 200,000 pays 2 percent on the slice above 125,000', () => {
  // (200000 - 125000) * 0.02 = 1500
  assert.equal(purchaseTax({ nation: 'england', price: 200000 }).tax, 1500);
});

test('England: bands are marginal, not whole-price rates', () => {
  // 125,000 to 250,000 at 2% = 2,500; 250,000 to 300,000 at 5% = 2,500; total 5,000
  assert.equal(purchaseTax({ nation: 'england', price: 300000 }).tax, 5000);
});

test('England: additional dwelling adds 5 points to every band', () => {
  const base = purchaseTax({ nation: 'england', price: 300000 }).tax;
  const extra = purchaseTax({ nation: 'england', price: 300000, additionalDwelling: true });
  // The surcharge applies to every slice, including the nil-rate slice:
  // the whole 300,000 at an extra 5% = 15,000, so 5,000 + 15,000 = 20,000
  assert.equal(extra.tax, base + 15000);
  assert.equal(extra.tax, 20000);
  assert.equal(extra.surchargeApplied, true);
});

test('Scotland: LBTT example at 200,000', () => {
  // (200000 - 145000) * 0.02 = 1100
  assert.equal(purchaseTax({ nation: 'scotland', price: 200000 }).tax, 1100);
});

test('Scotland: ADS is a flat 8 percent on the whole price when additional', () => {
  const base = purchaseTax({ nation: 'scotland', price: 200000 }).tax;
  const r = purchaseTax({ nation: 'scotland', price: 200000, additionalDwelling: true });
  assert.equal(r.flatSurcharge, 16000);
  assert.equal(r.tax, base + 16000);
});

test('Wales: LTT example at 300,000', () => {
  // (300000 - 225000) * 0.06 = 4500
  assert.equal(purchaseTax({ nation: 'wales', price: 300000 }).tax, 4500);
});

test('Northern Ireland uses the same bands as England', () => {
  for (const price of [0, 100000, 300000, 1000000, 2000000]) {
    assert.equal(
      purchaseTax({ nation: 'northern_ireland', price }).tax,
      purchaseTax({ nation: 'england', price }).tax,
      `price ${price}`,
    );
  }
});

test('every result carries its source, date and verified flag', () => {
  const r = purchaseTax({ nation: 'scotland', price: 250000 });
  assert.match(r.source, /^https:\/\//);
  assert.match(r.asOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(r.verified, false);
  assert.match(r.note, /NOT VERIFIED/);
});

test('blank, NaN, negative and absurd inputs are refused, never a nonsense number', () => {
  assert.throws(() => purchaseTax({ nation: 'england', price: null }), TypeError);
  assert.throws(() => purchaseTax({ nation: 'england', price: undefined }), TypeError);
  assert.throws(() => purchaseTax({ nation: 'england', price: '' }), TypeError);
  assert.throws(() => purchaseTax({ nation: 'england', price: NaN }), TypeError);
  assert.throws(() => purchaseTax({ nation: 'england', price: Infinity }), TypeError);
  assert.throws(() => purchaseTax({ nation: 'england', price: '200000' }), TypeError);
  assert.throws(() => purchaseTax({ nation: 'england', price: -1 }), RangeError);
  assert.throws(() => purchaseTax({ nation: 'england', price: MAX_PRICE + 1 }), RangeError);
});

test('unknown nation is refused', () => {
  assert.throws(() => purchaseTax({ nation: 'france', price: 1000 }), RangeError);
});

test('validatePrice accepts the sanity cap exactly', () => {
  assert.equal(validatePrice(MAX_PRICE), MAX_PRICE);
});

test('a very large valid price gives a finite tax', () => {
  const r = purchaseTax({ nation: 'england', price: MAX_PRICE });
  assert.ok(Number.isFinite(r.tax));
  assert.ok(r.tax > 0);
});
