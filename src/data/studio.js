// Developer Studio content (brief section 2). Everything the studio produces is a
// DRAFT. It is not certified and must not be presented as approved.
//
// The permissions lines below were NOT read at source in this build. Each one says
// where to check it. Scotland first.

export const DRAFT_LABEL = 'DRAFT: not certified and not for submission. A qualified person must check, certify and submit it.';

export const ENTRY_BUTTONS = [
  { id: 'extension_planning', label: 'Extension planning', note: 'Draft plans and scope for every project type.' },
  { id: 'floorplan_3d', label: '3D floorplan', note: 'Build a 3D model from a floor plan.' },
  { id: 'walkthrough_3d', label: '3D walkthrough', note: 'A walk through the plan, furnished or unfurnished.' },
  { id: 'staging', label: 'Staging', note: 'Virtual staging of empty rooms, always labelled.', flag: 'studioVirtualStaging' },
];

export const STUDIO_TABS = [
  { id: 'land', label: 'Land acquisition', note: 'Site, title and access checks before an offer.' },
  { id: 'planning', label: 'Planning', note: 'What permission the project may need, and from whom.' },
  { id: 'foundations', label: 'Foundations', note: 'Ground, drainage and structural questions for the engineer.' },
  { id: 'building', label: 'Building', note: 'Scope, sequence and the approvals needed before work starts.' },
  { id: 'development', label: 'Development', note: 'Costs, timeline and exit for the whole project.' },
];

// Who approves building work in each nation. To check at the source given.
export const PERMISSIONS_BY_NATION = {
  scotland: {
    planning: 'Planning permission from the local council, unless permitted development applies. To check at gov.scot and with the council.',
    building: 'A building warrant from the council’s building standards service before work starts, then a completion certificate. To check at gov.scot (building standards).',
    source: 'https://www.gov.scot/policies/building-standards/',
  },
  england: {
    planning: 'Planning permission from the local council, unless permitted development applies. To check at planningportal.co.uk and with the council.',
    building: 'Building regulations approval through council or registered building control. To check at gov.uk.',
    source: 'https://www.gov.uk/building-regulations-approval',
  },
  wales: {
    planning: 'Planning permission from the local council, unless permitted development applies. To check at gov.wales and with the council.',
    building: 'Building regulations approval through building control. To check at gov.wales.',
    source: 'https://www.gov.wales/building-regulations',
  },
  northern_ireland: {
    planning: 'Planning permission from the local council. To check at nidirect.gov.uk.',
    building: 'Building control approval from the council. To check at nidirect.gov.uk.',
    source: 'https://www.nidirect.gov.uk/articles/building-control',
  },
};

// Project types. Add any new renovation type here: the studio reads this list.
export const PROJECT_TYPES = [
  { id: 'loft', label: 'Loft extension', scope: ['Head height and floor structure check', 'Stair position and fire escape route', 'Roof structure changes', 'Insulation and ventilation'], needs: ['structural engineer'] },
  { id: 'side', label: 'Side extension', scope: ['Boundary and neighbour position', 'Foundations and drainage runs', 'Openings into the existing house', 'Roof join to the main house'], needs: ['structural engineer'] },
  { id: 'rear', label: 'Rear extension', scope: ['Depth and height against the boundary', 'Foundations and drainage', 'Steel over the new opening', 'Light to the existing rooms'], needs: ['structural engineer'] },
  { id: 'dormer', label: 'Dormer', scope: ['Roof slope and materials', 'Head height gained', 'Structural changes to rafters', 'Fire escape from the new room'], needs: ['structural engineer'] },
  { id: 'conservatory', label: 'Conservatory', scope: ['Base and drainage', 'Glazing and heat loss', 'Separation from the house (doors)', 'Size against any exemption'], needs: [] },
  { id: 'garage', label: 'Garage conversion', scope: ['Floor level and damp proofing', 'Infill of the garage door', 'Insulation of walls and roof', 'Parking that is lost'], needs: [] },
  { id: 'basement', label: 'Basement', scope: ['Ground water and waterproofing', 'Underpinning or new structure', 'Party wall questions', 'Light, ventilation and escape'], needs: ['structural engineer'] },
  { id: 'hmo', label: 'HMO refurb', scope: ['Room sizes against the nation’s rules', 'Fire doors, alarms and escape routes', 'Kitchen and bathroom ratios', 'Licence and planning for the nation'], needs: ['council HMO team'], lawTopic: 'hmo_licensing' },
  { id: 'brrr', label: 'BRRR refurb', scope: ['Works that lift the value most', 'Costs with a contingency', 'Timeline against the lender’s refinance rules', 'Rentable standard at the end'], needs: ['mortgage broker'], calculators: ['deal', 'refinance'] },
  { id: 'title_split', label: 'Title splitting', scope: ['Units that can stand alone', 'Separate services and access', 'Each unit’s legal title', 'Lender and valuation per unit'], needs: ['solicitor'], solicitorGate: true },
  { id: 'roof', label: 'Roof repair or replacement', scope: ['Extent: repair, partial or full replacement', 'Structure under the covering', 'Insulation and ventilation once opened', 'Scaffold, access and weather'], needs: ['roofer', 'surveyor if structure is affected'] },
  { id: 'repairs', label: 'Repairs and replacements', scope: ['Item and its condition', 'Like-for-like or upgrade', 'Approvals if structure, gas or electrics are touched', 'Order of works'], needs: ['the qualified trade for gas or electrics'] },
  { id: 'change_of_use', label: 'Change of use', scope: ['Current and proposed use', 'Planning permission for the change', 'Building standards for the new use', 'Services and access'], needs: ['planning consultant or architect'] },
];

// Standard furniture used to illustrate a furnished walkthrough. Sizes in metres.
export const FURNITURE = {
  bedroom: [{ item: 'Double bed', w: 1.4, d: 2.0, h: 0.5 }, { item: 'Wardrobe', w: 1.0, d: 0.6, h: 2.0 }],
  living: [{ item: 'Sofa', w: 2.0, d: 0.9, h: 0.8 }, { item: 'Coffee table', w: 1.0, d: 0.5, h: 0.4 }],
  kitchen: [{ item: 'Worktop run', w: 2.4, d: 0.6, h: 0.9 }, { item: 'Table for four', w: 1.2, d: 0.8, h: 0.75 }],
  bathroom: [{ item: 'Bath', w: 1.7, d: 0.7, h: 0.55 }],
  other: [],
};

// Virtual staging (brief section 6).
export const STAGING_RULES = {
  label: 'Virtually staged',
  keepOriginal: true,
  allowed: 'Furniture and decor added to empty rooms. Same room, same angle.',
  forbidden: ['damp', 'cracks', 'stains', 'floors', 'walls', 'views', 'fixtures'],
  checkBeforeCharging: [
    'The Property Ombudsman code (tpos.co.uk)',
    'CMA guidance on property marketing (gov.uk)',
    'Rightmove photo rules',
    'Zoopla photo rules',
  ],
};

// A hypothesis to test, not a market rate (brief section 6). Pence.
export const STAGING_PRICE_HYPOTHESIS = {
  perPhotoPence: { low: 2500, high: 5000 },
  listingPackagePence: { low: 15000, high: 30000, photos: '8 to 10', revisions: 1, delivery: '24 to 48 hours' },
  status: 'hypothesis to test, not a market rate',
};
