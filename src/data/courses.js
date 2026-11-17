// Property Mentor course content (brief module 3). Written for this build; no
// third-party course material is used.
//
// Status: draft for the owner's review. Law and tax points link to the checked
// rows in law-by-nation.js (by topic id) instead of repeating figures, so a rule is
// kept in one place. Anything not checked at source says "to check" and where.
//
// Training only. Nothing here is personal financial, tax or legal advice, and the
// conveyancing, surveying and broker courses do not offer those services.

export const MENTOR_DISCLAIMER =
  'Property Mentor is training, not advice. For a decision on your own deal, speak to the professional named in the lesson.';

export const PASS_MARK = 0.66;

// Status words for the per-nation strategy tables.
export const FIT = {
  works: 'Works, with the usual rules',
  care: 'Works with care: extra rules apply',
  check: 'Check first: a rule decides it and was not confirmed here',
};

const NATIONS_ORDER = ['scotland', 'england', 'wales', 'northern_ireland'];

function table(rows) {
  return NATIONS_ORDER.map((nation) => ({ nation, ...rows[nation] }));
}

export const COURSES = [
  {
    id: 'strategies-by-nation',
    title: 'Property strategies by nation',
    summary: 'What each strategy is, and what decides whether it works in Scotland, England, Wales and Northern Ireland.',
    reviewStatus: 'draft for owner review',
    lessons: [
      {
        id: 'btl',
        title: 'Buy to let',
        body: [
          'You buy a home and rent it to one household. Your return is the rent after costs, plus any rise in value over time.',
          'The rules that change most between the nations are the tenancy you must give, how you end it, the deposit rules and the extra purchase tax on a second home.',
        ],
        lawTopics: ['purchase_tax', 'tenancy_type', 'ending', 'deposits', 'landlord_registration'],
        nationTable: table({
          scotland: { fit: 'works', why: 'Register as a landlord first. The tenancy is open-ended (PRT), so plan for an 18-ground exit. The Additional Dwelling Supplement adds 8% of the price if you already own a home.' },
          england: { fit: 'works', why: 'Tenancies are rolling with no end date since 1 May 2026, and ending one needs a section 8 ground. The higher purchase rates add 5 points to every band.' },
          wales: { fit: 'works', why: 'Register with Rent Smart Wales. Higher LTT rates use their own table and charge from the first pound. A no-fault notice needs 6 months.' },
          northern_ireland: { fit: 'works', why: 'Register as a landlord. The deposit is capped at one month of rent. Purchase tax is SDLT, with the same higher rates as England.' },
        }),
      },
      {
        id: 'hmo',
        title: 'Houses in multiple occupation (HMO)',
        body: [
          'You let rooms to people who are not one household and share a kitchen or bathroom. Rent per room can beat a single let, and so can the work and the rules.',
          'Licensing thresholds differ a great deal between the nations, and planning rules can apply on top. Check both with the council before you buy.',
        ],
        lawTopics: ['hmo_licensing', 'landlord_registration'],
        nationTable: table({
          scotland: { fit: 'care', why: 'A licence is needed from 3 unrelated tenants, so even a small shared house is licensed by the council. Check planning and the council room standards first.' },
          england: { fit: 'care', why: 'A licence is mandatory from 5 people in more than 1 household, and councils can license smaller HMOs. National minimum bedroom sizes apply to licensed HMOs.' },
          wales: { fit: 'check', why: 'The Welsh HMO licensing threshold was not confirmed in this build. Check gov.wales and the local council.' },
          northern_ireland: { fit: 'care', why: 'A licence is needed from 3 people in more than 2 households, through the NI HMO Unit, for 5 years.' },
        }),
      },
      {
        id: 'brrr',
        title: 'Buy, refurbish, refinance, rent (BRRR)',
        body: [
          'You buy below what the property will be worth once improved, do the works, then refinance on the new value to take some of your money back out, and rent it.',
          'It depends on two things you do not control: what the lender’s surveyor says it is worth after the works, and how soon the lender will refinance. Ask a broker before you buy.',
        ],
        lawTopics: ['purchase_tax'],
        calculators: ['deal', 'refinance'],
        nationTable: table({
          scotland: { fit: 'works', why: 'The same lending test as elsewhere. Price the Additional Dwelling Supplement into your money left in.' },
          england: { fit: 'works', why: 'Price the higher purchase rates into your money left in.' },
          wales: { fit: 'works', why: 'Higher LTT charges from the first pound, which matters on cheaper buys.' },
          northern_ireland: { fit: 'works', why: 'SDLT with the higher rates. Check local lender appetite with a broker.' },
        }),
      },
      {
        id: 'flip',
        title: 'Buy, refurbish and sell (flip)',
        body: [
          'You buy, improve and sell for a profit. You pay purchase tax on the way in and tax on the profit on the way out, so the margin must cover both.',
          'Tax on the profit depends on how you hold the property and your own position. Take that to an accountant before you buy.',
        ],
        lawTopics: ['purchase_tax'],
        calculators: ['deal'],
        nationTable: table({
          scotland: { fit: 'works', why: 'Purchases go through missives agreed by solicitors, so timing differs from England. The Additional Dwelling Supplement applies if you already own a home.' },
          england: { fit: 'works', why: 'Higher purchase rates apply if you own another home.' },
          wales: { fit: 'works', why: 'Higher LTT charges from the first pound.' },
          northern_ireland: { fit: 'works', why: 'SDLT with the higher rates.' },
        }),
      },
      {
        id: 'r2r',
        title: 'Rent to rent',
        body: [
          'You rent a property from its owner, then let it out yourself for more than you pay. You need the owner’s written consent to sublet, and a contract a solicitor has checked.',
          'Managing a property for its owner can count as letting agency work, which brings registration, redress and client money rules. That is why this strategy is marked check first everywhere.',
        ],
        lawTopics: ['landlord_registration', 'hmo_licensing'],
        nationTable: table({
          scotland: { fit: 'check', why: 'Letting agent registration and the Letting Agent Code may apply. To check at gov.scot with a solicitor.' },
          england: { fit: 'check', why: 'Redress scheme and client money rules may apply. To check at gov.uk with a solicitor.' },
          wales: { fit: 'check', why: 'Anyone who lets or manages needs a Rent Smart Wales licence.' },
          northern_ireland: { fit: 'check', why: 'To check at nidirect.gov.uk with a solicitor.' },
        }),
      },
      {
        id: 'serviced',
        title: 'Serviced accommodation and short lets',
        body: [
          'You let by the night, like a hotel. Income can be higher and so are the costs, the work and the empty nights.',
          'Short lets now have their own licensing and planning rules in parts of the UK. Check them before you buy, because they can stop the plan outright.',
        ],
        lawTopics: [],
        nationTable: table({
          scotland: { fit: 'check', why: 'Short-term let licensing applies in Scotland. To check at gov.scot and the local council, with any control area.' },
          england: { fit: 'check', why: 'Planning rules can limit short lets in some areas. To check with the local council.' },
          wales: { fit: 'check', why: 'To check at gov.wales and the local council.' },
          northern_ireland: { fit: 'check', why: 'To check at nidirect.gov.uk and the local council.' },
        }),
      },
      {
        id: 'title-split',
        title: 'Title splitting',
        body: [
          'You buy a building on one title, such as a block of flats, and split it into separate titles to sell or refinance each unit.',
          'Splitting a title is a legal step for a solicitor. In Developer Studio this stays locked until a solicitor’s sign-off is recorded.',
        ],
        lawTopics: [],
        nationTable: table({
          scotland: { fit: 'care', why: 'Titles are on the Land Register of Scotland (Registers of Scotland). Your solicitor handles the split.' },
          england: { fit: 'care', why: 'Titles are with HM Land Registry. Your solicitor or conveyancer handles the split.' },
          wales: { fit: 'care', why: 'Titles are with HM Land Registry, as in England.' },
          northern_ireland: { fit: 'care', why: 'Titles are with Land and Property Services. Your solicitor handles the split.' },
        }),
      },
    ],
    quiz: [
      { q: 'In Scotland, from how many unrelated tenants is an HMO licence needed?', options: ['2', '3', '5'], answer: 1, why: 'mygov.scot: 3 or more tenants who are not related or from the same family.' },
      { q: 'In Wales, how do the higher residential LTT rates work?', options: ['5 points added to each main band', 'A separate band table that charges from the first pound', 'A flat 8% on the whole price'], answer: 1, why: 'gov.wales publishes a separate higher rates table from 11 December 2024, starting at 5% from the first pound.' },
      { q: 'What does a rent to rent deal always need first?', options: ['The owner’s written consent to sublet', 'An HMO licence', 'A mortgage'], answer: 0, why: 'Without the owner’s consent you cannot sublet. The other items depend on the property.' },
    ],
  },
  {
    id: 'auctions',
    title: 'Buying at auction',
    summary: 'How a property auction works, what the legal pack tells you, and how to set your maximum bid.',
    reviewStatus: 'draft for owner review',
    lessons: [
      {
        id: 'how-auctions-work',
        title: 'How an auction works',
        body: [
          'Lots are published in a catalogue some weeks before the sale. Each lot has a guide price and usually a reserve, the lowest price the seller will accept. The reserve is not published.',
          'At many traditional auctions the contract is binding when the hammer falls, with a deposit due on the day and completion soon after. The terms differ by auction house and lot, so read the conditions of sale for each one.',
        ],
      },
      {
        id: 'legal-pack',
        title: 'Reading the legal pack',
        body: [
          'The legal pack holds the title, searches, special conditions and any lease. The special conditions often add costs to the buyer, such as the seller’s legal fees or search costs.',
          'Have a solicitor read the pack before you bid. Once the hammer falls it is usually too late to raise a problem.',
        ],
      },
      {
        id: 'max-bid',
        title: 'Setting your maximum bid',
        body: [
          'Work back from what the property will be worth, then take off the works, purchase tax, the buyer’s premium and fees, finance costs and the profit you want. What is left is your limit.',
          'The auction calculator does this sum for you and shows each step. Decide the limit before the day and keep to it.',
        ],
        calculators: ['auction'],
      },
    ],
    quiz: [
      { q: 'Where do you find extra costs the buyer must pay at an auction?', options: ['The guide price', 'The special conditions in the legal pack', 'The auctioneer’s website banner'], answer: 1, why: 'Special conditions in the legal pack often move costs to the buyer.' },
      { q: 'Is the reserve price published?', options: ['Yes, next to the guide', 'No', 'Only for online auctions'], answer: 1, why: 'The reserve is confidential between the seller and the auctioneer.' },
      { q: 'When should you set your maximum bid?', options: ['During the bidding', 'Before the auction day', 'After the hammer falls'], answer: 1, why: 'Set it before the day, from the numbers, so the room does not set it for you.' },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing, social media and your personal brand',
    summary: 'Build a brand people trust, make content for free channels, and keep within the advertising rules.',
    reviewStatus: 'draft for owner review',
    lessons: [
      {
        id: 'brand',
        title: 'Your personal brand',
        body: [
          'Pick who you help and what you help them with, and say it the same way everywhere. One name, one look and one voice across every channel.',
          'Show real work: deals you have done, lessons you have learned, numbers you can stand behind. Label any example as an example.',
        ],
        templates: ['profile-bio', 'about-me'],
      },
      {
        id: 'content',
        title: 'Free content: reels, shorts, carousels and email',
        body: [
          'Short vertical video works on every main platform. One idea per video, a clear first line, and captions on screen.',
          'Carousels suit step-by-step ideas. Email keeps the people who want to hear from you, with a short sequence for each kind of lead.',
          'Anyone who appears in a video agrees in writing first. Faceless video is fine. Label AI-made content where the platform asks you to.',
        ],
        templates: ['reel-script', 'carousel-outline', 'email-welcome-sequence'],
      },
      {
        id: 'ad-rules',
        title: 'The rules for advertising',
        body: [
          'Adverts must be honest and backed by evidence: no made-up results, reviews or members. The CAP Code sets the rules; check it at asa.org.uk.',
          'Inviting people to invest money is a financial promotion. Under section 21 of the Financial Services and Markets Act 2000 it needs approval by an FCA-authorised firm before it goes out, unless an exemption applies. Check at fca.org.uk.',
          'Marketing emails and texts need consent, or the soft opt-in, and a clear way to opt out. Check at ico.org.uk.',
        ],
        complianceRows: [1, 10, 11],
      },
    ],
    quiz: [
      { q: 'A post invites people to put money into your next deal. What is it?', options: ['Ordinary marketing', 'A financial promotion that needs FCA-authorised approval unless exempt', 'Fine if you add an emoji'], answer: 1, why: 'Section 21 of FSMA 2000 covers invitations to invest.' },
      { q: 'A colleague appears in your reel. What do you need first?', options: ['Nothing', 'Their written agreement', 'A paid licence'], answer: 1, why: 'Real people in your content agree in writing first.' },
      { q: 'Can you quote a result you have not measured?', options: ['Yes, if it is likely', 'No, unless it is clearly labelled as an example', 'Only on Instagram'], answer: 1, why: 'Claims must be backed by evidence; examples are labelled as examples.' },
    ],
  },
  {
    id: 'conveyancing',
    title: 'Conveyancing explained (training only)',
    summary: 'What happens legally between an agreed price and the keys, nation by nation. Propertymaster does not provide conveyancing.',
    reviewStatus: 'draft for owner review',
    lessons: [
      {
        id: 'scotland',
        title: 'Buying in Scotland',
        body: [
          'In Scotland your solicitor makes the offer and agrees the contract by an exchange of letters called missives. The deal is binding once the missives are concluded.',
          'The seller provides a Home Report. Ownership is recorded on the Land Register of Scotland, run by Registers of Scotland. Check the details at mygov.scot.',
        ],
      },
      {
        id: 'england-wales',
        title: 'Buying in England and Wales',
        body: [
          'An offer accepted through the agent is not binding. A solicitor or licensed conveyancer runs the searches and enquiries, then the contracts are exchanged, which makes it binding, and the sale completes on a set date.',
          'Ownership is recorded with HM Land Registry. Check the process at gov.uk.',
        ],
      },
      {
        id: 'northern-ireland',
        title: 'Buying in Northern Ireland',
        body: [
          'A solicitor acts for you. Ownership is recorded with Land and Property Services. Check the process at nidirect.gov.uk.',
          'Whichever nation you buy in, choose a regulated firm: the Law Society of Scotland in Scotland, the SRA or the Council for Licensed Conveyancers in England and Wales, the Law Society of Northern Ireland in Northern Ireland.',
        ],
        complianceRows: [5],
      },
    ],
    quiz: [
      { q: 'In Scotland, when is a purchase binding?', options: ['When the agent says yes', 'When the missives are concluded', 'On the day you get the keys'], answer: 1, why: 'Concluded missives make the contract binding in Scotland.' },
      { q: 'In England and Wales, what makes the deal binding?', options: ['Exchange of contracts', 'The mortgage offer', 'The survey'], answer: 0, why: 'Exchange of contracts makes it binding; completion follows.' },
      { q: 'Does Propertymaster do your conveyancing?', options: ['Yes', 'No, it trains you and you use a regulated firm', 'Only in Scotland'], answer: 1, why: 'Conveyancing is regulated work (compliance row 5); Propertymaster trains only.' },
    ],
  },
  {
    id: 'surveying',
    title: 'Surveys and valuations (training only)',
    summary: 'The kinds of survey, what each one tells you, and how a valuation differs from a survey.',
    reviewStatus: 'draft for owner review',
    lessons: [
      {
        id: 'survey-levels',
        title: 'Which survey to get',
        body: [
          'RICS Home Surveys come in three levels. Level 1 is a basic condition report, Level 2 suits a conventional home in fair condition, and Level 3 is a full building survey for older, altered or run-down property.',
          'In Scotland the seller’s Home Report includes a single survey. You can still commission your own. Check the levels at rics.org.',
        ],
      },
      {
        id: 'valuation',
        title: 'A valuation is not a survey',
        body: [
          'A lender’s valuation is for the lender. It tells them the property is fair security for the loan, not whether it is in good order.',
          'If a valuation comes in low, the gap must come from you, the seller, or a new price. Plan for it in your numbers.',
        ],
      },
    ],
    quiz: [
      { q: 'Which RICS level suits an old house that has been altered?', options: ['Level 1', 'Level 2', 'Level 3'], answer: 2, why: 'Level 3 is the full building survey for older or altered property.' },
      { q: 'Who is a mortgage valuation for?', options: ['The buyer', 'The lender', 'The seller'], answer: 1, why: 'It protects the lender.' },
      { q: 'In Scotland, who provides the Home Report?', options: ['The seller', 'The buyer', 'The lender'], answer: 0, why: 'The seller provides it before marketing.' },
    ],
  },
  {
    id: 'brokers',
    title: 'Working with mortgage brokers (training only)',
    summary: 'What a broker does, how to check one, and how lenders test a rental deal.',
    reviewStatus: 'draft for owner review',
    lessons: [
      {
        id: 'what-brokers-do',
        title: 'What a broker does',
        body: [
          'A broker searches lenders for a loan that fits you and the property, and handles the application. Ask whether they search the whole market and how they are paid.',
          'Check the firm on the FCA register at register.fca.org.uk before you share your details.',
        ],
      },
      {
        id: 'lender-tests',
        title: 'How lenders test a rental deal',
        body: [
          'Lenders look at two numbers: the loan as a share of the value (loan to value) and whether the rent covers the interest with room to spare (interest cover). The lower of the two sets your loan.',
          'Each lender sets its own rates for these tests, and they change. The refinance calculator shows the sum; your broker gives you the lender’s real figures.',
        ],
        calculators: ['refinance'],
      },
    ],
    quiz: [
      { q: 'Where do you check a broker is authorised?', options: ['Their own website', 'The FCA register', 'A review site'], answer: 1, why: 'register.fca.org.uk is the official record.' },
      { q: 'A lender tests both loan to value and interest cover. Which one sets the loan?', options: ['The higher', 'The lower', 'Neither'], answer: 1, why: 'The lower of the two is the most the lender will offer.' },
      { q: 'Who gives you a lender’s current test rates?', options: ['Your broker or the lender', 'A forum', 'This course'], answer: 0, why: 'Rates change; the broker or lender has today’s figures.' },
    ],
  },
];

// Short templates the marketing course refers to. Placeholders are in brackets.
export const TEMPLATES = {
  'profile-bio': 'I help [who] to [result] through [how]. Based in [place]. Examples on my page are labelled as examples.',
  'about-me': 'I started in property in [year] with [first step]. Today I focus on [strategy] in [area]. What I share is my own experience, not advice.',
  'reel-script': 'First line (2 seconds): [the problem in one sentence]. Middle: [three short steps]. End: [one action, for example "follow for part 2"]. Captions on screen.',
  'carousel-outline': 'Slide 1: [the promise]. Slides 2 to 6: [one step per slide]. Last slide: [the action]. Any figure shows its source.',
  'email-welcome-sequence': 'Email 1: thank you and what to expect. Email 2: your most useful lesson. Email 3: a worked example, labelled as an example. Every email: how to opt out.',
};

export function findCourse(courseId) {
  return COURSES.find((c) => c.id === courseId) || null;
}
