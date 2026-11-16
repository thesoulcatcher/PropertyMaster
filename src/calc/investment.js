// Deal, refinance and auction calculators.
// Every result returns its inputs, its formula text and its assumptions, so the
// UI can show how a figure was reached. Figures are arithmetic on the inputs the
// member gives; they are not market rates and not advice.

import { purchaseTax } from './purchase-tax.js';
import { num, optNum, round2 } from './validate.js';

export const FORMULAS = {
  grossYield: 'Gross yield = (monthly rent x 12) / purchase price',
  netYield: 'Net yield = (annual rent - annual running costs) / total cost',
  cashflow: 'Monthly cashflow = monthly rent - monthly running costs - monthly mortgage payment',
  totalCost: 'Total cost = price + purchase tax + purchase fees + refurbishment',
  exitProfit: 'Exit profit = exit value - exit costs - total cost',
};

// Deal calculator. All money in pounds.
export function dealCalculator(input) {
  const price = num(input.price, 'Purchase price', { min: 1 });
  const monthlyRent = optNum(input.monthlyRent, 'Monthly rent', 0);
  const purchaseFees = optNum(input.purchaseFees, 'Purchase fees (legal, survey, other)', 0);
  const refurb = optNum(input.refurb, 'Refurbishment cost', 0);
  const annualRunningCosts = optNum(input.annualRunningCosts, 'Annual running costs', 0);
  const monthlyMortgage = optNum(input.monthlyMortgage, 'Monthly mortgage payment', 0);
  const exitValue = optNum(input.exitValue, 'Exit value', 0);
  const exitCostRate = optNum(input.exitCostRate, 'Exit costs as a share of exit value', 0.03, { min: 0, max: 0.5 });

  const tax = purchaseTax({
    nation: input.nation,
    price,
    additionalDwelling: Boolean(input.additionalDwelling),
  });

  const totalCost = round2(price + tax.tax + purchaseFees + refurb);
  const annualRent = round2(monthlyRent * 12);
  const grossYield = round2(((annualRent / price) * 10000)) / 10000;
  const netYield = totalCost > 0
    ? round2(((annualRent - annualRunningCosts) / totalCost) * 10000) / 10000
    : 0;
  const monthlyCashflow = round2(monthlyRent - annualRunningCosts / 12 - monthlyMortgage);
  const exitCosts = round2(exitValue * exitCostRate);
  const exitProfit = round2(exitValue - exitCosts - totalCost);

  return {
    inputs: { ...input, price, monthlyRent, purchaseFees, refurb, annualRunningCosts, monthlyMortgage, exitValue, exitCostRate },
    purchaseTax: tax,
    totalCost,
    annualRent,
    grossYield,
    netYield,
    monthlyCashflow,
    exitCosts,
    exitProfit,
    formulas: FORMULAS,
    assumptions: [
      `Purchase tax from ${tax.taxName} (${tax.source}, table dated ${tax.asOf}, verified: ${tax.verified}).`,
      `Exit costs at ${round2(exitCostRate * 100)} percent of exit value (an assumption; set your own).`,
      'Running costs and rent are the member inputs, not market figures.',
      'Mortgage payment is the monthly figure the member enters; no lending rules are applied here.',
    ],
  };
}

// Refinance test: how much a lender might lend on a refinance, by two tests.
// The lowest of the two limits is the answer. Lender tests vary, so the inputs are the member's.
export function refinanceTest(input) {
  const value = num(input.value, 'Property value', { min: 1 });
  const currentLoan = optNum(input.currentLoan, 'Current loan', 0);
  const monthlyRent = optNum(input.monthlyRent, 'Monthly rent', 0);
  const maxLtv = optNum(input.maxLtv, 'Maximum loan to value', 0.75, { min: 0, max: 1 });
  const minIcr = optNum(input.minIcr, 'Minimum interest cover ratio', 1.25, { min: 0.01, max: 10 });
  const stressRate = optNum(input.stressRate, 'Stress test interest rate', 0.055, { min: 0.0001, max: 1 });

  const ltvLimit = round2(value * maxLtv);
  // Interest cover: annual rent / (loan x stress rate) must be at least minIcr.
  const icrLimit = round2((monthlyRent * 12) / (minIcr * stressRate));
  const maxLoan = Math.min(ltvLimit, icrLimit);
  const cashOut = round2(maxLoan - currentLoan);

  return {
    inputs: { value, currentLoan, monthlyRent, maxLtv, minIcr, stressRate },
    ltvLimit,
    icrLimit,
    maxLoan: round2(maxLoan),
    limitingTest: ltvLimit <= icrLimit ? 'loan to value' : 'interest cover',
    cashOut,
    formulas: {
      ltv: 'LTV limit = value x maximum loan to value',
      icr: 'ICR limit = (annual rent) / (minimum ICR x stress rate)',
    },
    assumptions: [
      'The lender tests and thresholds are the member inputs; check the lender criteria.',
      'A negative cash out means the current loan is above what the test allows.',
    ],
  };
}

// Auction calculator: the highest bid that keeps the planned profit.
// Costs that grow with the bid (buyer's premium, purchase tax) are solved by bisection,
// so the answer never breaks the target profit.
export function auctionCalculator(input) {
  const gdv = num(input.gdv, 'Expected end value (GDV)', { min: 1 });
  const targetProfit = optNum(input.targetProfit, 'Target profit', 0);
  const premiumRate = optNum(input.premiumRate, "Buyer's premium rate", 0.02, { min: 0, max: 0.2 });
  const fixedFees = optNum(input.fixedFees, 'Fixed auction fees (legal pack, admin)', 0);
  const refurb = optNum(input.refurb, 'Refurbishment cost', 0);
  const sellingCostRate = optNum(input.sellingCostRate, 'Selling costs as a share of GDV', 0.03, { min: 0, max: 0.5 });
  const nation = input.nation;

  const budget = gdv * (1 - sellingCostRate) - targetProfit - refurb - fixedFees;

  const costAt = (bid) => {
    const tax = purchaseTax({ nation, price: bid, additionalDwelling: Boolean(input.additionalDwelling) }).tax;
    return bid + bid * premiumRate + tax;
  };

  let maxBid = 0;
  if (budget > 0) {
    let lo = 0;
    let hi = budget;
    for (let i = 0; i < 80; i += 1) {
      const mid = (lo + hi) / 2;
      if (costAt(mid) <= budget) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    maxBid = Math.floor(lo * 100) / 100;
  }

  const bid = maxBid;
  const premium = round2(bid * premiumRate);
  const tax = purchaseTax({ nation, price: bid, additionalDwelling: Boolean(input.additionalDwelling) });

  const acquisition = round2(bid + premium + tax.tax);
  const allInCost = round2(acquisition + fixedFees + refurb);
  const sellingCosts = round2(gdv * sellingCostRate);
  return {
    inputs: { gdv, targetProfit, premiumRate, fixedFees, refurb, sellingCostRate, nation },
    maxBid,
    budget: round2(budget),
    buyersPremium: premium,
    purchaseTax: tax,
    acquisitionCost: acquisition,
    allInCost,
    sellingCosts,
    profitAtMaxBid: round2(gdv - sellingCosts - allInCost),
    feasible: budget > 0 && maxBid > 0,
    formulas: {
      budget: 'Budget = GDV x (1 - selling cost rate) - target profit - refurbishment - fixed fees',
      maxBid: "Max bid: highest bid where bid + buyer's premium + purchase tax <= budget",
      profit: 'Profit = GDV - selling costs - (acquisition + fixed fees + refurbishment)',
    },
    assumptions: [
      "Buyer's premium rate is an input; check each auction house's own terms (VAT may apply to the premium).",
      'The fixed fees, refurbishment and selling costs are member inputs.',
    ],
  };
}
