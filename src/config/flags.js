// Feature flags. A gated feature is OFF and labelled as gated until its compliance
// row (brief section 11) is signed off. Changing a flag here is a decision: record it in docs/DECISIONS.md.

export const FLAGS = {
  // Developer Studio
  studioPlanExport: { on: false, gate: 'Compliance row 13: building warrant or building regulations need a qualified person sign-off' },
  studioTitleSplitting: { on: false, gate: 'Compliance row 13 and section 2: solicitor sign-off' },
  studioVirtualStaging: { on: false, gate: 'Section 6: disclosure wording must be checked before paid use' },

  // Modules gated in section 3
  lettingsModule: { on: false, gate: 'Compliance row 7: lettings company cleared (redress, client money, licensing)' },
  jointVentures: { on: false, gate: 'Compliance row 2: solicitor sign-off (collective investment scheme risk)' },
  finderFees: { on: false, gate: 'Compliance row 3: solicitor, accountant and AML checks' },
  memberPayments: { on: false, gate: 'Compliance row 3: member-to-member payments' },
  insurance: { on: false, gate: 'Compliance row 4: FCA authorisation through a partner' },
  conveyancing: { on: false, gate: 'Compliance row 5: SRA or Law Society regulated; training only' },
  sourcingForOthers: { on: false, gate: 'Compliance row 8: dated briefing and solicitor sign-off' },

  // Data sources
  propertyDataLicensed: { on: false, gate: 'Section 10: licence needed before the connector runs' },
  homeDataLicensed: { on: false, gate: 'Section 10: confirm the exact product before buying' },

  // Off-market outreach (Part B)
  ownerOutreach: { on: false, gate: 'Compliance row 8 and section 14a: no owner approach until a solicitor signs off' },

  // Paid advertising and paid staging runs
  paidAdvertising: { on: false, gate: 'Section 9: paid advertising stays off until the owner approves a budget' },
};

export function isOn(name) {
  const flag = FLAGS[name];
  if (!flag) {
    throw new RangeError(`Unknown feature flag "${name}".`);
  }
  return flag.on === true;
}

export function gateLabel(name) {
  const flag = FLAGS[name];
  if (!flag) {
    throw new RangeError(`Unknown feature flag "${name}".`);
  }
  return flag.on ? 'On' : `Gated: ${flag.gate}`;
}
