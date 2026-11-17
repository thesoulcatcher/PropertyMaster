// Trial, tiers and referral settings (brief sections 3.2 and 8). Config only.
//
// PRICES ARE NOT SET. The brief gives no prices for the tiers, and this build does
// not invent them. Each price is null until the owner sets it here. While a price
// is null the tier is shown as "price to be set" and cannot be bought.
//
// The tier names and feature lists are a draft structure for the owner to confirm.

export const TRIAL_DAYS = 14;

// Days in which a member may ask for a full refund after the first payment.
// Taken as 14 from the general distance-selling cancellation period. To check at
// legislation.gov.uk (Consumer Contracts Regulations 2013) and at gov.uk for the
// subscription rules in the Digital Markets, Competition and Consumers Act 2024,
// which gov.uk showed as not yet commenced when read on 2026-11-17.
export const COOLING_OFF_DAYS = 14;

export const CURRENCY = 'GBP';

export const TIERS = {
  propertymaster: {
    label: 'Propertymaster',
    audience: 'member',
    pricePenceMonthly: null,
    features: ['Property Mentor courses', 'Calculators', 'Law and rights by nation', 'Area maps', 'Deal rooms and community'],
  },
  propertymaster_studio: {
    label: 'Propertymaster with Developer Studio',
    audience: 'member',
    pricePenceMonthly: null,
    features: ['Everything in Propertymaster', 'Developer Studio: extension planning drafts, 3D floorplan, walkthrough and staging'],
  },
  estate_agent_branch: {
    label: 'Propertymaster Estate Agent, one branch',
    audience: 'estate_agent',
    pricePenceMonthly: null,
    features: ['Agent section', 'Listing media and descriptions', 'Area maps', 'Virtual staging (gated until sign-off)'],
  },
  estate_agent_team: {
    label: 'Propertymaster Estate Agent, team rate',
    audience: 'estate_agent',
    pricePenceMonthly: null,
    features: ['Everything in the branch plan', 'Team rate for brokerages'],
  },
};

export const REFERRAL = {
  // Referrer and friend each get this many free months, once per referred account.
  freeMonthsEach: 1,
  // The reward is granted when the friend makes their first payment, so an account
  // that never pays cannot be used to farm free months. Recorded in docs/DECISIONS.md.
  trigger: 'friend_first_payment',
};

export function tiersFor(audience) {
  return Object.entries(TIERS)
    .filter(([, t]) => t.audience === audience)
    .map(([id, t]) => ({ id, ...t, priceSet: t.pricePenceMonthly !== null }));
}
