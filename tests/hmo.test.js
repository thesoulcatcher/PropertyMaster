import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hmoRoomCheck } from '../src/calc/hmo.js';

test('England: a room under the single-occupant minimum fails', () => {
  const r = hmoRoomCheck({ nation: 'england', rooms: [{ name: 'A', areaM2: 6.0, occupants: 1 }] });
  assert.equal(r.rooms[0].meetsMinimum, false);
  assert.deepEqual(r.failingRooms, ['A']);
});

test('England: a double room needs the larger minimum', () => {
  const r = hmoRoomCheck({ nation: 'england', rooms: [{ name: 'B', areaM2: 8, occupants: 2 }] });
  assert.equal(r.rooms[0].minimumM2, 10.22);
  assert.equal(r.rooms[0].meetsMinimum, false);
});

test('England: five occupants in two households needs a mandatory licence', () => {
  const rooms = [1, 2, 3, 4, 5].map((i) => ({ name: `R${i}`, areaM2: 12, occupants: 1 }));
  assert.equal(hmoRoomCheck({ nation: 'england', rooms, households: 2 }).mandatoryLicenceNeeded, true);
  assert.equal(hmoRoomCheck({ nation: 'england', rooms, households: 1 }).mandatoryLicenceNeeded, false);
});

test('Scotland: a licence is needed from 3 unrelated tenants, and room sizes are left to the council', () => {
  const rooms = [1, 2, 3].map((i) => ({ name: `R${i}`, areaM2: 9, occupants: 1 }));
  const r = hmoRoomCheck({ nation: 'scotland', rooms, households: 3 });
  assert.equal(r.mandatoryLicenceNeeded, true);
  assert.equal(r.rooms[0].meetsMinimum, null);
  assert.equal(r.verified, true);
  assert.match(r.note, /council/);
  assert.equal(hmoRoomCheck({ nation: 'scotland', rooms, households: 2 }).mandatoryLicenceNeeded, false);
});

test('Wales: the licence need is not guessed', () => {
  const r = hmoRoomCheck({ nation: 'wales', rooms: [{ areaM2: 12 }] });
  assert.equal(r.mandatoryLicenceNeeded, null);
  assert.equal(r.verified, false);
});

test('Northern Ireland: 3 people in more than 2 households need a licence', () => {
  const rooms = [1, 2, 3].map((i) => ({ name: `R${i}`, areaM2: 9, occupants: 1 }));
  assert.equal(hmoRoomCheck({ nation: 'northern_ireland', rooms, households: 3 }).mandatoryLicenceNeeded, true);
  assert.equal(hmoRoomCheck({ nation: 'northern_ireland', rooms, households: 2 }).mandatoryLicenceNeeded, false);
});

test('blank rooms, zero rooms and negative area are refused', () => {
  assert.throws(() => hmoRoomCheck({ nation: 'england', rooms: [] }), TypeError);
  assert.throws(() => hmoRoomCheck({ nation: 'england', rooms: [{ areaM2: -1 }] }), RangeError);
  assert.throws(() => hmoRoomCheck({ nation: 'england', rooms: [{ areaM2: '' }] }), TypeError);
  assert.throws(() => hmoRoomCheck({ nation: 'england', rooms: [{ areaM2: 12, occupants: 3 }] }), RangeError);
});

test('an absurd room area is refused', () => {
  assert.throws(() => hmoRoomCheck({ nation: 'england', rooms: [{ areaM2: 1e9 }] }), RangeError);
});

test('unknown nation is refused', () => {
  assert.throws(() => hmoRoomCheck({ nation: 'ireland', rooms: [{ areaM2: 12 }] }), RangeError);
});
