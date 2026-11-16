// HMO room counts and occupancy. Pure functions.
// The room-size table and licence thresholds are written from memory and are marked
// verified: false. Check each one at its source before a member relies on it.

import { num, round2 } from './validate.js';

export const HMO_RULES = {
  england: {
    source: 'https://www.gov.uk/guidance/houses-in-multiple-occupation-hmo-licensing-and-planning',
    asOf: '2026-11-16',
    verified: false,
    // Room sizes in square metres (Licensing of HMOs regulations, from memory).
    minRoomSize: { oneAdultOver10: 6.51, twoAdultsOver10: 10.22, oneAdultUnder10: 4.64 },
    mandatoryLicence: { minOccupants: 5, minHouseholds: 2 },
  },
  scotland: {
    source: 'https://www.gov.scot/ (HMO licensing) and the local council',
    asOf: '2026-11-16',
    verified: false,
    note: 'Scotland licenses HMOs through the local council. Check the council rules and room standards; this module does not apply room-size rules to Scotland.',
    minRoomSize: null,
    mandatoryLicence: null,
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
    source: 'https://www.nidirect.gov.uk/',
    asOf: '2026-11-16',
    verified: false,
    note: 'Check nidirect and the local council. Room-size rules are not applied here.',
    minRoomSize: null,
    mandatoryLicence: null,
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
    note: rules.note || 'Room sizes and licence thresholds are NOT VERIFIED. Check the source on the day of use.',
  };
}
