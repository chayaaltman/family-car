import type { FamilyState } from '../../types';
import { RuleError, deleteCar, deleteMember, driverOf, isConfirmed, saveBooking, statusOf } from '../bookings';
import { pickupRequestMessage, requestMessage } from '../messages';
import {
  cancelPickupRequest,
  carsForDriver,
  createPickupRequest,
  myPickupRequests,
  openPickupsFor,
  releasePickup,
  takePickup,
} from '../pickups';
import { DAY } from '../time';

const NOW = new Date(2030, 0, 1, 8, 0).getTime();
const at = (h: number, m = 0) => new Date(2030, 0, 1, h, m).getTime();

// Eli needs a ride. Mom is insured on both cars, Noa only on the Picanto, Eli on neither.
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
      { id: 'car1', name: 'Corolla', color: '#333', insuredMemberIds: ['mom'], insuranceExpires: NOW + 30 * DAY },
      { id: 'car2', name: 'Picanto', color: '#444', insuredMemberIds: ['mom', 'noa'] },
    ],
    bookings: [],
  };
}
const ask = (s: FamilyState, carIds = ['car1', 'car2']) =>
  createPickupRequest(s, { memberId: 'eli', carIds, start: at(19), end: at(20), place: 'the train station' }, NOW, 'r1');

describe('pick-up requests', () => {
  it("don't hold any car until someone says yes", () => {
    const s = ask(family());
    expect(s.pickups).toHaveLength(1);
    expect(s.bookings).toHaveLength(0);
    expect(myPickupRequests(s, 'eli', NOW)).toHaveLength(1);
  });

  it('are offered to everyone insured on at least one of the cars, with only their cars', () => {
    const s = ask(family());
    expect(carsForDriver(s, s.pickups![0], 'mom').map((c) => c.name)).toEqual(['Corolla', 'Picanto']);
    expect(carsForDriver(s, s.pickups![0], 'noa').map((c) => c.name)).toEqual(['Picanto']);
    expect(openPickupsFor(s, 'eli', NOW)).toHaveLength(0);
  });

  it('the driver picks the car, and only then is it reserved', () => {
    let s = ask(family());
    s = takePickup(s, 'r1', 'noa', 'car2', NOW, 'b1');
    expect(s.pickups).toHaveLength(0);
    expect(s.bookings).toHaveLength(1);
    expect(s.bookings[0]).toMatchObject({ carId: 'car2', memberId: 'eli', pickup: { driverId: 'noa' } });
    expect(isConfirmed(s.bookings[0])).toBe(true);
    expect(openPickupsFor(s, 'mom', NOW)).toHaveLength(0);
  });

  it("can't be taken with a car you're not insured on, or one they didn't ask for", () => {
    const s = ask(family(), ['car2']);
    expect(() => takePickup(ask(family()), 'r1', 'noa', 'car1', NOW)).toThrow(/Noa isn't insured/);
    expect(() => takePickup(s, 'r1', 'mom', 'car1', NOW)).toThrow(/isn't one of the cars/);
  });

  it('only the first yes wins', () => {
    let s = ask(family());
    s = takePickup(s, 'r1', 'noa', 'car2', NOW);
    expect(() => takePickup(s, 'r1', 'mom', 'car1', NOW)).toThrow(/already took/);
  });

  it("hides cars that are booked by then, and can't be taken with them", () => {
    let s = saveBooking(family(), { carId: 'car2', memberId: 'mom', start: at(18), end: at(21) }, NOW);
    s = ask(s);
    expect(carsForDriver(s, s.pickups![0], 'noa')).toHaveLength(0);
    expect(openPickupsFor(s, 'noa', NOW)).toHaveLength(0);
    expect(() => takePickup(s, 'r1', 'noa', 'car2', NOW)).toThrow(RuleError);
  });

  it("asks the owner when the driver isn't one", () => {
    const f = family();
    f.cars[1] = { ...f.cars[1], ownerIds: ['mom'] };
    const s = takePickup(ask(f), 'r1', 'noa', 'car2', NOW);
    expect(statusOf(s.bookings[0])).toBe('pending');
    expect(requestMessage(s, s.bookings[0])).toContain('– Noa'); // the driver is the one asking
  });

  it('a driver who drops out frees the car and reopens the request with the same cars', () => {
    let s = takePickup(ask(family()), 'r1', 'mom', 'car1', NOW, 'b1');
    s = releasePickup(s, 'b1', 'mom', NOW);
    expect(s.bookings).toHaveLength(0);
    expect(s.pickups![0]).toMatchObject({ memberId: 'eli', carIds: ['car1', 'car2'], place: 'the train station' });
  });

  it('needs a place, a car, a free car and someone to drive', () => {
    const d = { memberId: 'eli', carIds: ['car1'], start: at(19), end: at(20), place: 'x' };
    expect(() => createPickupRequest(family(), { ...d, place: ' ' }, NOW)).toThrow(/Where/);
    expect(() => createPickupRequest(family(), { ...d, carIds: [] }, NOW)).toThrow(/at least one car/);
    const busy = saveBooking(family(), { carId: 'car1', memberId: 'mom', start: at(18), end: at(21) }, NOW);
    expect(() => createPickupRequest(busy, d, NOW)).toThrow(/already booked/);
    expect(() => createPickupRequest(family(), { ...d, memberId: 'mom' }, NOW)).toThrow(/Nobody else/);
  });

  it('can be cancelled, and is cleaned up when a car or the rider is removed', () => {
    expect(cancelPickupRequest(ask(family()), 'r1').pickups).toHaveLength(0);
    expect(deleteCar(ask(family()), 'car1').pickups![0].carIds).toEqual(['car2']);
    expect(deleteMember(ask(family()), 'eli', NOW).pickups).toHaveLength(0);
  });

  it('removing the driver from the family reopens the request', () => {
    let s = takePickup(ask(family()), 'r1', 'noa', 'car2', NOW);
    s = deleteMember(s, 'noa', NOW);
    expect(s.bookings.filter((b) => b.pickup)).toHaveLength(0);
    expect(s.pickups).toHaveLength(1);
  });

  it('the message greets exactly the people you chose', () => {
    const s = ask(family());
    const r = s.pickups![0];
    expect(pickupRequestMessage(s, r, ['Mom'])).toMatch(/^Hi Mom!/);
    expect(pickupRequestMessage(s, r, ['Mom', 'Noa'])).toMatch(/^Hi Mom and Noa!/);
    expect(pickupRequestMessage(s, r, [])).toMatch(/^Hi everyone!/);
    expect(pickupRequestMessage(s, r)).toContain('Corolla or Picanto');
  });

  it('driverOf names the driver of a taken pick-up', () => {
    const s = takePickup(ask(family()), 'r1', 'mom', 'car1', NOW);
    expect(driverOf(s.bookings[0])).toBe('mom');
  });
});
