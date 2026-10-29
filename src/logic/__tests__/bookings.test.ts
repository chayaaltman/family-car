import type { FamilyState } from '../../types';
import {
  RuleError,
  approveBooking,
  declineBooking,
  isConfirmed,
  requestsFor,
  upsertCar,
  cancelBooking,
  carStatus,
  deleteMember,
  findNextFreeSlot,
  overlaps,
  returnCar,
  saveBooking,
  validateBooking,
} from '../bookings';
import { DAY, HOUR, MINUTE } from '../time';

// A fixed "now" keeps the tests deterministic: 1 Jan 2030, 08:00 local time.
const NOW = new Date(2030, 0, 1, 8, 0).getTime();
const at = (h: number, m = 0) => new Date(2030, 0, 1, h, m).getTime();

function family(): FamilyState {
  return {
    familyName: 'Test',
    updatedAt: NOW,
    members: [
      { id: 'mom', name: 'Mom', color: '#000' },
      { id: 'noa', name: 'Noa', color: '#111' },
      { id: 'eli', name: 'Eli', color: '#222' },
    ],
    cars: [
      { id: 'car1', name: 'Corolla', color: '#333', insuredMemberIds: ['mom', 'noa'], insuranceExpires: NOW + 30 * DAY },
      { id: 'car2', name: 'Picanto', color: '#444', insuredMemberIds: ['mom', 'noa', 'eli'] },
    ],
    bookings: [{ id: 'b1', carId: 'car1', memberId: 'mom', start: at(10), end: at(12), createdAt: NOW }],
  };
}

const expectRule = (fn: () => unknown, text: RegExp) => {
  expect(fn).toThrow(RuleError);
  expect(fn).toThrow(text);
};

describe('overlaps', () => {
  it('treats touching intervals as free (half-open)', () => {
    expect(overlaps(at(10), at(12), at(12), at(13))).toBe(false);
    expect(overlaps(at(10), at(12), at(9), at(10))).toBe(false);
  });
  it('detects partial and full overlaps', () => {
    expect(overlaps(at(10), at(12), at(11, 59), at(13))).toBe(true);
    expect(overlaps(at(10), at(12), at(9), at(13))).toBe(true);
    expect(overlaps(at(10), at(12), at(10, 30), at(11))).toBe(true);
  });
});

describe('validateBooking', () => {
  it('accepts a free slot for an insured driver', () => {
    expect(() =>
      validateBooking(family(), { carId: 'car1', memberId: 'noa', start: at(12), end: at(14) }, NOW),
    ).not.toThrow();
  });

  it('rejects a clash and names who has the car', () => {
    expectRule(
      () => validateBooking(family(), { carId: 'car1', memberId: 'noa', start: at(11), end: at(13) }, NOW),
      /already booked by Mom/,
    );
  });

  it('suggests the next free slot with the same duration', () => {
    try {
      validateBooking(family(), { carId: 'car1', memberId: 'noa', start: at(11), end: at(13) }, NOW);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as RuleError).suggestion).toEqual({ start: at(12), end: at(14) });
    }
  });

  it('rejects drivers who are not insured on the car', () => {
    expectRule(
      () => validateBooking(family(), { carId: 'car1', memberId: 'eli', start: at(13), end: at(14) }, NOW),
      /isn't insured/,
    );
  });

  it('rejects bookings that end after the insurance expires', () => {
    expectRule(
      () => validateBooking(family(), { carId: 'car1', memberId: 'noa', start: NOW + 29 * DAY, end: NOW + 31 * DAY }, NOW),
      /insurance expires/,
    );
  });

  it('rejects one person holding two cars at once', () => {
    expectRule(
      () => validateBooking(family(), { carId: 'car2', memberId: 'mom', start: at(11), end: at(11, 30) }, NOW),
      /one car at a time/,
    );
  });

  it('rejects end before start, the past, and very long bookings', () => {
    expectRule(() => validateBooking(family(), { carId: 'car2', memberId: 'eli', start: at(14), end: at(13) }, NOW), /after the start/);
    expectRule(() => validateBooking(family(), { carId: 'car2', memberId: 'eli', start: at(6), end: at(7) }, NOW), /already passed/);
    expectRule(() => validateBooking(family(), { carId: 'car2', memberId: 'eli', start: at(9), end: at(9) + 15 * DAY }, NOW), /14 days/);
  });

  it('allows a few minutes of slack for "right now" bookings', () => {
    expect(() =>
      validateBooking(family(), { carId: 'car2', memberId: 'eli', start: NOW - 2 * MINUTE, end: NOW + HOUR }, NOW),
    ).not.toThrow();
  });

  it('does not clash a booking with itself when editing', () => {
    expect(() =>
      validateBooking(family(), { id: 'b1', carId: 'car1', memberId: 'mom', start: at(10, 30), end: at(12, 30) }, NOW),
    ).not.toThrow();
  });
});

describe('findNextFreeSlot', () => {
  it('skips over back-to-back bookings', () => {
    let s = family();
    s = saveBooking(s, { carId: 'car1', memberId: 'noa', start: at(12), end: at(13) }, NOW);
    expect(findNextFreeSlot(s, 'car1', at(10, 30), HOUR)).toEqual({ start: at(13), end: at(14) });
  });

  it('uses a gap if it is long enough', () => {
    let s = family();
    s = saveBooking(s, { carId: 'car1', memberId: 'noa', start: at(14), end: at(15) }, NOW);
    expect(findNextFreeSlot(s, 'car1', at(11), 2 * HOUR)).toEqual({ start: at(12), end: at(14) });
    expect(findNextFreeSlot(s, 'car1', at(11), 3 * HOUR)).toEqual({ start: at(15), end: at(18) });
  });
});

describe('state transitions', () => {
  it('returning a car early frees it for others', () => {
    let s = family();
    const tenThirty = at(10, 30);
    expect(carStatus(s, 'car1', tenThirty).kind).toBe('in-use');

    s = returnCar(s, 'b1', { parkedAt: 'Driveway', fuel: 'half' }, tenThirty);
    expect(carStatus(s, 'car1', tenThirty + MINUTE).kind).toBe('free');
    expect(s.cars[0].lastReport).toMatchObject({ parkedAt: 'Driveway', fuel: 'half', memberId: 'mom' });

    // Noa can now take it for the rest of the original slot.
    expect(() =>
      validateBooking(s, { carId: 'car1', memberId: 'noa', start: at(11), end: at(12) }, tenThirty),
    ).not.toThrow();
  });

  it('saves and edits the destination', () => {
    let s = saveBooking(family(), { carId: 'car2', memberId: 'eli', start: at(13), end: at(14), destination: 'Haifa' }, NOW);
    const added = s.bookings.find((b) => b.memberId === 'eli')!;
    expect(added.destination).toBe('Haifa');
    s = saveBooking(s, { id: added.id, carId: 'car2', memberId: 'eli', start: at(13), end: at(14), destination: 'Eilat' }, NOW);
    expect(s.bookings.find((b) => b.id === added.id)!.destination).toBe('Eilat');
  });

  it('cancelling removes the booking', () => {
    expect(cancelBooking(family(), 'b1').bookings).toHaveLength(0);
  });

  it('removing a member cleans up their insurance and bookings', () => {
    const s = deleteMember(family(), 'mom');
    expect(s.cars.every((c) => !c.insuredMemberIds.includes('mom'))).toBe(true);
    expect(s.bookings).toHaveLength(0);
  });

  it('never mutates the previous state', () => {
    const before = family();
    const snapshot = JSON.stringify(before);
    saveBooking(before, { carId: 'car2', memberId: 'eli', start: at(13), end: at(14) }, NOW);
    returnCar(before, 'b1', {}, at(11));
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('owner approval', () => {
  // Mom owns the Corolla: Noa's bookings on it need Mom's OK.
  const owned = (): FamilyState => {
    const s = family();
    s.cars[0] = { ...s.cars[0], ownerId: 'mom' };
    return s;
  };
  const request = (s: FamilyState, start: number, end: number, memberId = 'noa') =>
    saveBooking(s, { carId: 'car1', memberId, start, end }, NOW);
  const last = (s: FamilyState) => s.bookings[s.bookings.length - 1];

  it("a booking on someone else's car becomes a pending request", () => {
    const s = request(owned(), at(13), at(14));
    expect(last(s).status).toBe('pending');
    expect(requestsFor(s, 'mom', NOW).map((b) => b.id)).toEqual([last(s).id]);
  });

  it("the owner's own bookings are approved immediately", () => {
    const s = request(owned(), at(13), at(14), 'mom');
    expect(last(s).status).toBe('approved');
  });

  it('pending requests are not on the calendar and do not hold the car', () => {
    let s = request(owned(), at(13), at(14));
    expect(carStatus(s, 'car1', at(13, 30)).kind).toBe('free');
    // Mom can still take that time herself.
    expect(() => validateBooking(s, { carId: 'car1', memberId: 'mom', start: at(13), end: at(14) }, NOW)).not.toThrow();
    s = approveBooking(s, last(s).id, 'mom', NOW);
    expect(carStatus(s, 'car1', at(13, 30)).kind).toBe('in-use');
  });

  it('only the owner can approve or decline', () => {
    const s = request(owned(), at(13), at(14));
    expectRule(() => approveBooking(s, last(s).id, 'noa', NOW), /owner/);
    expectRule(() => declineBooking(s, last(s).id, 'eli', 'no', NOW), /owner/);
  });

  it('approving declines other requests for the same time', () => {
    let s = owned();
    s.cars[0].insuredMemberIds.push('eli');
    s = request(s, at(13), at(15), 'noa');
    const noas = last(s).id;
    s = request(s, at(14), at(16), 'eli');
    const elis = last(s).id;
    s = approveBooking(s, noas, 'mom', NOW);
    const eli = s.bookings.find((b) => b.id === elis)!;
    expect(eli.status).toBe('declined');
    expect(eli.declineReason).toMatch(/given to Noa/);
  });

  it('cannot approve a request that now clashes with the calendar', () => {
    let s = request(owned(), at(13), at(14));
    const id = last(s).id;
    s = saveBooking(s, { carId: 'car1', memberId: 'mom', start: at(13), end: at(15) }, NOW);
    expectRule(() => approveBooking(s, id, 'mom', NOW), /already booked by Mom/);
  });

  it('declining keeps the reason for the requester', () => {
    let s = request(owned(), at(13), at(14));
    s = declineBooking(s, last(s).id, 'mom', 'I need it for work', NOW);
    expect(last(s)).toMatchObject({ status: 'declined', declineReason: 'I need it for work', decidedBy: 'mom' });
    expect(isConfirmed(last(s))).toBe(false);
  });

  it('changing the time of an approved booking asks the owner again', () => {
    let s = request(owned(), at(13), at(14));
    const id = last(s).id;
    s = approveBooking(s, id, 'mom', NOW);
    s = saveBooking(s, { id, carId: 'car1', memberId: 'noa', start: at(13), end: at(14), purpose: 'Groceries' }, NOW);
    expect(last(s).status).toBe('approved'); // only the note changed
    s = saveBooking(s, { id, carId: 'car1', memberId: 'noa', start: at(13), end: at(15) }, NOW);
    expect(last(s).status).toBe('pending');
  });

  it('removing the owner settles requests that were waiting', () => {
    let s = request(owned(), at(13), at(14));
    s = upsertCar(s, { ...s.cars[0], ownerId: undefined }, NOW);
    expect(last(s).status).toBe('approved');
  });
});
