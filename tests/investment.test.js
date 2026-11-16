import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dealCalculator, refinanceTest, auctionCalculator } from '../src/calc/investment.js';

test('deal: gross yield is annual rent over price', () => {
  // 1,000 a month = 12,000 a year on 200,000 = 6%
  const r = dealCalculator({ nation: 'england', price: 200000, monthlyRent: 1000 });
  assert.equal(r.grossYield, 0.06);
  assert.equal(r.annualRent, 12000);
});

test('deal: total cost adds purchase tax, fees and refurbishment', () => {
  // England 200,000 tax = 1,500
  const r = dealCalculator({ nation: 'england', price: 200000, purchaseFees: 3000, refurb: 10000 });
  assert.equal(r.purchaseTax.tax, 1500);
  assert.equal(r.totalCost, 200000 + 1500 + 3000 + 10000);
});

test('deal: monthly cashflow = rent - running costs/12 - mortgage', () => {
  const r = dealCalculator({
    nation: 'scotland',
    price: 150000,
    monthlyRent: 900,
    annualRunningCosts: 1200,
    monthlyMortgage: 500,
  });
  // 900 - 100 - 500 = 300
  assert.equal(r.monthlyCashflow, 300);
});

test('deal: zero rent and zero price-based yield do not produce nonsense', () => {
  const r = dealCalculator({ nation: 'wales', price: 100000, monthlyRent: 0 });
  assert.equal(r.grossYield, 0);
  assert.equal(r.netYield, 0);
  assert.equal(r.monthlyCashflow, 0);
});

test('deal: blank optional inputs fall back to zero, a blank price is refused', () => {
  const r = dealCalculator({ nation: 'england', price: 100000, monthlyRent: '', refurb: null });
  assert.equal(r.inputs.monthlyRent, 0);
  assert.equal(r.inputs.refurb, 0);
  assert.throws(() => dealCalculator({ nation: 'england', price: '' }), TypeError);
  assert.throws(() => dealCalculator({ nation: 'england', price: 0 }), RangeError);
});

test('deal: absurdly large inputs are refused, not turned into a figure', () => {
  assert.throws(() => dealCalculator({ nation: 'england', price: 1e15, monthlyRent: 1 }), RangeError);
  assert.throws(() => dealCalculator({ nation: 'england', price: 100000, monthlyRent: -5 }), RangeError);
  assert.throws(() => dealCalculator({ nation: 'england', price: 100000, monthlyRent: NaN }), TypeError);
});

test('deal: exit profit uses exit costs and total cost', () => {
  const r = dealCalculator({ nation: 'scotland', price: 100000, exitValue: 150000, exitCostRate: 0.02 });
  // exit costs 3000; scotland tax on 100,000 = 0 (under 145,000); total cost 100000
  assert.equal(r.exitCosts, 3000);
  assert.equal(r.exitProfit, 150000 - 3000 - 100000);
});

test('deal: every result lists formulas and assumptions', () => {
  const r = dealCalculator({ nation: 'england', price: 100000 });
  assert.ok(r.formulas.grossYield);
  assert.ok(r.assumptions.length >= 3);
});

test('refinance: LTV test limits the loan when rent is high', () => {
  const r = refinanceTest({ value: 200000, monthlyRent: 2000, maxLtv: 0.75 });
  assert.equal(r.ltvLimit, 150000);
  assert.equal(r.limitingTest, 'loan to value');
  assert.equal(r.maxLoan, 150000);
});

test('refinance: interest cover limits the loan when rent is low', () => {
  // ICR limit = (500*12) / (1.25 * 0.055) = 6000 / 0.06875 = 87272.73
  const r = refinanceTest({ value: 200000, monthlyRent: 500, maxLtv: 0.75, minIcr: 1.25, stressRate: 0.055 });
  assert.equal(r.limitingTest, 'interest cover');
  assert.equal(r.maxLoan, 87272.73);
});

test('refinance: zero rent gives zero ICR loan, and a negative cash out is shown as such', () => {
  const r = refinanceTest({ value: 200000, currentLoan: 100000, monthlyRent: 0 });
  assert.equal(r.maxLoan, 0);
  assert.equal(r.cashOut, -100000);
});

test('refinance: a zero value is refused, a stress rate of zero is refused', () => {
  assert.throws(() => refinanceTest({ value: 0 }), RangeError);
  assert.throws(() => refinanceTest({ value: 100000, stressRate: 0 }), RangeError);
});

test('auction: max bid keeps bid, premium and purchase tax inside the budget', () => {
  const r = auctionCalculator({
    nation: 'england',
    gdv: 300000,
    targetProfit: 30000,
    premiumRate: 0.02,
    fixedFees: 1000,
    refurb: 20000,
    sellingCostRate: 0.03,
  });
  assert.equal(r.feasible, true);
  assert.ok(r.maxBid > 0);
  // At the max bid the profit is at least the target (allowing for pence rounding)
  assert.ok(r.profitAtMaxBid >= 30000 - 0.01, `profit ${r.profitAtMaxBid}`);
  // Raising the bid by 1 pound must break the budget (the answer is the highest bid)
  const over = r.maxBid + 1;
  const tax = englandTax(over);
  assert.ok(over + over * 0.02 + tax > r.budget);
});

// England purchase tax for a price, from the calculator itself.
function englandTax(price) {
  return dealCalculator({ nation: 'england', price }).purchaseTax.tax;
}

test('auction: an unprofitable GDV gives no bid, not a negative one', () => {
  const r = auctionCalculator({ nation: 'england', gdv: 50000, targetProfit: 60000 });
  assert.equal(r.feasible, false);
  assert.equal(r.maxBid, 0);
});

test('auction: zero GDV is refused', () => {
  assert.throws(() => auctionCalculator({ nation: 'england', gdv: 0 }), RangeError);
  assert.throws(() => auctionCalculator({ nation: 'england', gdv: '' }), TypeError);
});

test("auction: a buyer's premium above 20 percent is refused", () => {
  assert.throws(() => auctionCalculator({ nation: 'england', gdv: 100000, premiumRate: 0.5 }), RangeError);
});
