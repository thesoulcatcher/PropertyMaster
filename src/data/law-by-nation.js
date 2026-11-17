// Law and rights by nation (brief module 4). Scotland first, then England, Wales
// and Northern Ireland.
//
// Every row was read at its official source on the date in `checkedOn`. The date
// the source itself gives is kept apart in `sourceDate` ("not stated" when the page
// shows none). Anything that could not be read is listed in `toCheck` with the place
// to check it, and is never stated as fact.
//
// This is general information, not legal advice. Rules change: check the source on
// the day you rely on a row.

import { PURCHASE_TAX, NATIONS, NATION_LABELS } from './purchase-tax.js';

export const LAW_DISCLAIMER =
  'General information, not legal advice. Rules change, so check the source on the day you rely on it. ' +
  'A solicitor settles a legal question; an accountant settles a tax question.';

const C = '2026-11-17';

function pct(r) {
  return `${Math.round(r * 10000) / 100}%`;
}

function money(n) {
  return `${n.toLocaleString('en-GB')} pounds`;
}

function bandLines(bands) {
  return bands.map((b) => (b.to === null ? `Over ${money(b.from)}: ${pct(b.rate)}` : `${money(b.from)} to ${money(b.to)}: ${pct(b.rate)}`));
}

// Purchase tax rows are built from the same table the calculator uses, so the two
// can never disagree.
function purchaseTaxRow(nation) {
  const t = PURCHASE_TAX[nation];
  const s = t.surcharges.additionalDwelling;
  const points = [...bandLines(t.bands)];
  if (s.kind === 'flat') points.push(`${s.label}. ${s.ratesFrom}`);
  if (s.kind === 'added') points.push(s.label);
  if (s.kind === 'table') points.push(`${s.label}: ${bandLines(s.bands).join('; ')}. ${s.ratesFrom}`);
  for (const r of t.reliefs) points.push(`${r.name}: ${r.detail}`);
  return {
    summary: t.tax,
    points,
    source: t.source,
    checkedOn: t.checkedOn,
    sourceDate: t.ratesFrom,
    verified: t.verified,
  };
}

export const LAW_TOPICS = [
  {
    id: 'purchase_tax',
    title: 'Tax when you buy',
    rows: Object.fromEntries(NATIONS.map((n) => [n, purchaseTaxRow(n)])),
  },
  {
    id: 'tenancy_type',
    title: 'The tenancy you give a private tenant',
    rows: {
      scotland: {
        summary: 'Private residential tenancy (PRT), for most new private tenancies since 1 December 2017.',
        points: [
          'The landlord ends it with a notice to leave, which states the eviction ground and the notice period.',
          'If the tenant does not leave, the landlord applies to the First-tier Tribunal for an eviction order.',
        ],
        source: 'https://www.mygov.scot/check-tenancy-type',
        checkedOn: C,
        sourceDate: 'Page last updated 1 April 2025',
        verified: true,
      },
      england: {
        summary: 'Assured periodic tenancy. It has no end date and runs on a rolling basis.',
        points: [
          'On 1 May 2026 all assured tenancies, assured shorthold tenancies included, became rolling tenancies.',
          'A rental period cannot be longer than a month at a time.',
        ],
        source: 'https://www.gov.uk/private-renting-tenancy-agreements',
        checkedOn: C,
        sourceDate: 'not stated on the page',
        verified: true,
      },
      wales: {
        summary: 'Standard occupation contract (the private sector contract under Renting Homes).',
        points: ['The landlord must give the written statement of the contract within 14 days of the occupation date.'],
        source: 'https://www.gov.wales/renting-homes-landlords',
        checkedOn: C,
        sourceDate: 'Page last updated 29 April 2026',
        verified: true,
      },
      northern_ireland: {
        summary: 'Private tenancy. The landlord must give a free Tenancy Information Notice within 28 days of the start.',
        points: ['A Notice of Variation is due within 28 days of a change taking effect.'],
        source: 'https://www.nidirect.gov.uk/articles/private-rent-and-tenancies',
        checkedOn: C,
        sourceDate: 'not stated on the page',
        verified: true,
      },
    },
  },
  {
    id: 'ending',
    title: 'When the landlord wants the property back',
    rows: {
      scotland: {
        summary: 'Only on one of 18 eviction grounds, with a notice to leave.',
        points: [
          'Notice is 28 days or 84 days.',
          'For most grounds (selling, refurbishing, the landlord moving in, and others) it is 84 days once the tenant has lived there 6 months or more, otherwise 28 days.',
          'Some grounds are always 28 days: rent arrears for 3 months in a row, a breach of the tenancy, a relevant criminal conviction, antisocial behaviour, and the tenant no longer living there.',
        ],
        source: 'https://www.mygov.scot/landlord-end-tenancy/private-residential-tenancy',
        checkedOn: C,
        sourceDate: 'Page last updated 6 October 2026',
        verified: true,
      },
      england: {
        summary: 'The landlord needs a valid ground and must serve a section 8 notice of seeking possession.',
        points: ['Notice is usually at least 2 months and can be up to 4 months, depending on the ground.'],
        source: 'https://www.gov.uk/assured-periodic-tenancies-tenants/if-your-landlords-wants-to-end-your-tenancy',
        checkedOn: C,
        sourceDate: 'not stated on the page',
        verified: true,
      },
      wales: {
        summary: 'A no-fault notice (form RHW16) needs at least 6 months, and can only be served after the first 6 months of occupation.',
        points: ['The no-fault notice period went up from two months to six.'],
        source: 'https://www.gov.wales/renting-homes-landlords',
        checkedOn: C,
        sourceDate: 'Page last updated 29 April 2026',
        verified: true,
      },
      northern_ireland: {
        summary: 'A written notice to quit, with the length set by how long the tenancy has run.',
        points: [
          'Up to 12 months: at least 4 weeks.',
          'More than 12 months and up to 10 years: at least 8 weeks.',
          'More than 10 years: at least 12 weeks.',
          'No notice is needed when a fixed-term tenancy reaches its end date.',
        ],
        source: 'https://www.nidirect.gov.uk/articles/private-rent-and-tenancies',
        checkedOn: C,
        sourceDate: 'not stated on the page',
        verified: true,
      },
    },
  },
  {
    id: 'rent_increases',
    title: 'Putting the rent up',
    rows: {
      scotland: {
        summary: 'Once in any 12 months, with at least 3 months written notice on the set form.',
        points: [
          'The page states no cap on the amount.',
          'The tenant can apply to Rent Service Scotland within 21 days.',
          'To check at gov.scot: whether a rent control area applies where the property is.',
        ],
        source: 'https://www.mygov.scot/landlord-rent-increases/private-residential-tenancy',
        checkedOn: C,
        sourceDate: 'Page last updated 1 May 2026',
        verified: true,
      },
      england: {
        summary: 'Once a year, not in the first year, with at least 2 months notice on form 4A.',
        points: ['The tenant can challenge an increase above the open market rent at the First-tier Tribunal.'],
        source: 'https://www.gov.uk/assured-periodic-tenancies-tenants/rent-increases',
        checkedOn: C,
        sourceDate: 'not stated on the page',
        verified: true,
      },
      wales: {
        summary: 'To check at gov.wales.',
        points: [],
        source: 'https://www.gov.wales/renting-homes-landlords',
        checkedOn: null,
        sourceDate: null,
        verified: false,
      },
      northern_ireland: {
        summary: 'Not within 12 months of the tenancy starting or of the last increase, and with 3 months written notice.',
        points: ['This applies from 1 April 2025. Notice can be given electronically.'],
        source: 'https://www.nidirect.gov.uk/articles/private-rent-and-tenancies',
        checkedOn: C,
        sourceDate: 'not stated on the page',
        verified: true,
      },
    },
  },
  {
    id: 'deposits',
    title: 'Tenancy deposits',
    rows: {
      scotland: {
        summary: 'Protect the deposit within 30 working days of the tenancy starting.',
        points: [
          'Approved schemes: Letting Protection Service Scotland, mydeposits Scotland, SafeDeposits Scotland.',
          'The deposit can be up to 2 months rent.',
          'If it is not protected, the tribunal can order it protected or returned and award the tenant up to 3 times the deposit.',
        ],
        source: 'https://www.mygov.scot/landlord-deposit/protection',
        checkedOn: C,
        sourceDate: 'Page last updated 1 April 2025',
        verified: true,
      },
      england: {
        summary: 'Protect the deposit within 30 days of getting it.',
        points: [
          'Schemes: Deposit Protection Service, MyDeposits, Tenancy Deposit Scheme.',
          'Return it within 10 days of both sides agreeing the amount.',
          'Cap: 5 weeks rent where the yearly rent is under 50,000 pounds, 6 weeks at 50,000 pounds or more. A holding deposit is capped at 1 week.',
        ],
        source: 'https://www.gov.uk/tenancy-deposit-protection',
        checkedOn: C,
        sourceDate: 'not stated on the page; the Tenant Fees Act collection page was last updated 1 June 2019',
        verified: true,
      },
      wales: {
        summary: 'The landlord has up to 30 days to protect the deposit in a government-approved scheme and give the tenant the information.',
        points: ['A court can order the deposit returned and award compensation if it is not protected correctly.'],
        source: 'https://www.gov.wales/deposits-guidance-tenants',
        checkedOn: C,
        sourceDate: 'not stated on the page',
        verified: true,
      },
      northern_ireland: {
        summary: 'Protect the deposit within 28 days of receiving it, and give the written information within 35 days.',
        points: [
          'Schemes: My Deposits Northern Ireland, Tenancy Deposit Scheme Northern Ireland.',
          'A landlord cannot ask for a deposit of more than one month rent.',
        ],
        source: 'https://www.nidirect.gov.uk/articles/tenancy-deposit-scheme-information-landlords',
        checkedOn: C,
        sourceDate: 'not stated on the page',
        verified: true,
      },
    },
  },
  {
    id: 'landlord_registration',
    title: 'Registering as a landlord',
    rows: {
      scotland: {
        summary: 'Register before renting out, on the Scottish Landlord Register, and renew every 3 years.',
        points: [
          'Joint owners must register too.',
          'Renting out without registering is a criminal offence, with a fine of up to 50,000 pounds.',
          'Adverts must show the registration number (or "landlord registration pending") and the EPC rating.',
        ],
        source: 'https://www.mygov.scot/renting-your-property-out/registration',
        checkedOn: C,
        sourceDate: 'Page last updated 1 April 2025',
        verified: true,
      },
      england: {
        summary: 'A Private Rented Sector Database is set out in the Renters’ Rights Act 2025, with no start date stated.',
        points: ['To check at gov.uk: the date landlords must register.'],
        source: 'https://www.gov.uk/government/publications/guide-to-the-renters-rights-act/guide-to-the-renters-rights-act',
        checkedOn: C,
        sourceDate: 'Page last updated 6 November 2025',
        verified: true,
      },
      wales: {
        summary: 'Every landlord of a domestic tenancy in Wales registers with Rent Smart Wales, valid for 5 years.',
        points: [
          'A landlord who lets or manages the property themselves also needs a licence, valid for 5 years. One who uses a licensed agent does not.',
          'Not registering can bring a fixed penalty of up to 150 pounds, prosecution and limits on getting possession.',
        ],
        source: 'https://rentsmart.gov.wales/en/landlord/landlord-registration/',
        checkedOn: C,
        sourceDate: 'not stated on the page',
        verified: true,
      },
      northern_ireland: {
        summary: 'Every landlord of a private tenancy registers. The certificate lasts 3 years.',
        points: ['The fee shown was 70 pounds online, 80 pounds on paper.', 'Penalty: not stated on the page; to check at nidirect.gov.uk.'],
        source: 'https://www.nidirect.gov.uk/articles/landlord-registration-scheme',
        checkedOn: C,
        sourceDate: 'not stated on the page',
        verified: true,
      },
    },
  },
  {
    id: 'hmo_licensing',
    title: 'Shared houses (HMO licensing)',
    rows: {
      scotland: {
        summary: 'A licence is needed to rent to 3 or more tenants who are not related or from the same family. The local council issues it.',
        points: [
          'Renting without a needed licence is a criminal offence, with a fine of up to 50,000 pounds.',
          'To check at the council: how long the licence lasts and the room standards.',
        ],
        source: 'https://www.mygov.scot/landlord-hmo-licence',
        checkedOn: C,
        sourceDate: 'Page last updated 1 April 2025',
        verified: true,
      },
      england: {
        summary: 'An HMO is let to at least 3 people from more than 1 household who share a kitchen, bathroom or toilet.',
        points: [
          'A licence is mandatory when 5 or more people from more than 1 household live there. Councils can license smaller HMOs in their area.',
          'A licence lasts up to 5 years. Renting out an unlicensed HMO can bring an unlimited fine.',
          'Minimum bedroom sizes: 6.51 square metres for one person over 10, 10.22 for two people over 10, 4.64 for one child under 10. A room under 4.64 cannot be used for sleeping.',
        ],
        source: 'https://www.gov.uk/house-in-multiple-occupation-licence',
        extraSources: ['https://www.legislation.gov.uk/uksi/2018/616/made'],
        checkedOn: C,
        sourceDate: 'not stated on the gov.uk page; the room sizes are in force from 1 October 2018',
        verified: true,
      },
      wales: {
        summary: 'To check at gov.wales and the local council: the mandatory HMO licence threshold, who licenses and for how long.',
        points: ['The gov.wales HMO pages could not be read on 2026-11-17.'],
        source: 'https://www.gov.wales/licensing-houses-multiple-occupation-hmo-guidance-tenants',
        checkedOn: null,
        sourceDate: null,
        verified: false,
      },
      northern_ireland: {
        summary: 'An HMO is the main home of 3 or more people forming more than 2 households, with rent paid by at least one.',
        points: [
          'The local council licenses HMOs; the NI HMO Unit at Belfast City Council runs the scheme for all 11 councils.',
          'A licence lasts 5 years. Running an HMO without one is a criminal offence.',
        ],
        source: 'https://www.belfastcity.gov.uk/Documents/Northern-Ireland-Houses-in-Multiple-Occupation',
        checkedOn: C,
        sourceDate: 'Page last updated 1 April 2026',
        verified: true,
      },
    },
  },
];

// Items this build could not read at source. Each is shown as "to check".
export const TO_CHECK = [
  { nation: 'scotland', item: 'Short-term let licensing for holiday and serviced lets', where: 'gov.scot and the local council' },
  { nation: 'scotland', item: 'Rent control areas', where: 'gov.scot' },
  { nation: 'scotland', item: 'HMO licence length and room standards', where: 'the local council' },
  { nation: 'wales', item: 'Rent increase rules for standard occupation contracts', where: 'gov.wales' },
  { nation: 'wales', item: 'HMO licensing threshold and length', where: 'gov.wales and the local council' },
  { nation: 'england', item: 'Start date of the Private Rented Sector Database', where: 'gov.uk' },
  { nation: 'northern_ireland', item: 'Penalty for not registering as a landlord', where: 'nidirect.gov.uk' },
];

// One topic as a side-by-side table, Scotland first.
export function lawTable(topicId) {
  const topic = LAW_TOPICS.find((t) => t.id === topicId);
  if (!topic) {
    throw new RangeError(`Unknown topic "${topicId}".`);
  }
  return {
    id: topic.id,
    title: topic.title,
    disclaimer: LAW_DISCLAIMER,
    columns: NATIONS.map((n) => ({ nation: n, label: NATION_LABELS[n], ...topic.rows[n] })),
  };
}

export function lawTopics() {
  return LAW_TOPICS.map((t) => ({ id: t.id, title: t.title }));
}
