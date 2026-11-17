// HMO room counts and occupancy. Pure functions.
// England, Scotland and Northern Ireland were read at source on 2026-11-17 and are
// marked verified with that date. Wales could not be read and stays verified: false.
// Check each one at its source again on the day a member relies on it.

import { num, round2 } from './validate.js';

export const HMO_RULES = {
  england: {
    source: 'https://www.gov.uk/house-in-multiple-occupation-licence',
    asOf: '2026-11-17',
    verified: true,
    note: 'Read on 2026-11-17: a licence is mandatory for 5 or more people in more than 1 household (gov.uk). Room sizes from SI 2018/616 (legislation.gov.uk), in force from 1 October 2018. Councils can license smaller HMOs: check the council.',
    // Room sizes in square metres (SI 2018/616, Schedule, read 2026-11-17).
    minRoomSize: { oneAdultOver10: 6.51, twoAdultsOver10: 10.22, oneAdultUnder10: 4.64 },
    mandatoryLicence: { minOccupants: 5, minHouseholds: 2 },
  },
  scotland: {
    source: 'https://www.mygov.scot/landlord-hmo-licence',
    asOf: '2026-11-17',
    verified: true,
    note: 'Read on 2026-11-17 at mygov.scot: a licence from the local council is needed to rent to 3 or more tenants who are not related or from the same family. Room standards are set by the council: check the council. Room-size rules are not applied here.',
    minRoomSize: null,
    // "Not related": counted here as 3 people from at least 3 families.
    mandatoryLicence: { minOccupants: 3, minHouseholds: 3 },
  },
  wales: {
    source: 'https://www.gov.wales/ and Rent Smart Wales',
    asOf: '2026-11-16',
    verified: false,
    note: 'Check Rent Smart Wales and local council rules. Room-size rules are not applied here.',
    minRoomSize: null,
    mandatoryLicence: null,
  },
  northern_ireland: {
    source: 'https://www.belfastcity.gov.uk/Documents/Northern-Ireland-Houses-in-Multiple-Occupation',
    asOf: '2026-11-17',
    verified: true,
    note: 'Read on 2026-11-17: an HMO is the main home of 3 or more people forming more than 2 households; the NI HMO Unit licenses for 5 years. Room-size rules are not applied here: check the NI HMO Unit.',
    minRoomSize: null,
    mandatoryLicence: { minOccupants: 3, minHouseholds: 3 },
  },
};

// rooms: [{ name, areaM2, occupants }] where occupants is 1 or 2 (the planned sleeping use).
export function hmoRoomCheck({ nation, rooms, households = 1 }) {
  const rules = HMO_RULES[nation];
  if (!rules) {
    throw new RangeError(`Unknown nation "${nation}".`);
  }
  if (!Array.isArray(rooms) || rooms.length === 0) {
    throw new TypeError('Enter at least one room.');
  }
  const hh = num(households, 'Households', { min: 1, max: 100 });

  const results = rooms.map((room, i) => {
    const label = room.name || `Room ${i + 1}`;
    const area = num(room.areaM2, `${label} area (m2)`, { min: 0, max: 1000 });
    const occ = room.occupants === 2 ? 2 : 1;
    if (room.occupants !== 1 && room.occupants !== 2 && room.occupants !== undefined) {
      throw new RangeError(`${label}: occupants must be 1 or 2.`);
    }
    let meetsMinimum = null;
    let minimum = null;
    if (rules.minRoomSize) {
      minimum = occ === 2 ? rules.minRoomSize.twoAdultsOver10 : rules.minRoomSize.oneAdultOver10;
      meetsMinimum = area >= minimum;
    }
    return { label, areaM2: area, occupants: occ, minimumM2: minimum, meetsMinimum };
  });

  const occupants = results.reduce((sum, r) => sum + r.occupants, 0);
  const licenceNeeded = rules.mandatoryLicence
    ? occupants >= rules.mandatoryLicence.minOccupants && hh >= rules.mandatoryLicence.minHouseholds
    : null;

  return {
    nation,
    rooms: results,
    roomCount: results.length,
    occupants,
    households: hh,
    mandatoryLicenceNeeded: licenceNeeded,
    failingRooms: results.filter((r) => r.meetsMinimum === false).map((r) => r.label),
    averageRoomM2: round2(results.reduce((s, r) => s + r.areaM2, 0) / results.length),
    source: rules.source,
    asOf: rules.asOf,
    verified: rules.verified,
    note: rules.verified
      ? `${rules.note} Rules change: check the source again on the day you rely on this.`
      : rules.note || 'Room sizes and licence thresholds are NOT VERIFIED. Check the source on the day of use.',
  };
}
