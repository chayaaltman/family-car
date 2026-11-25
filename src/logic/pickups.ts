import type { Booking, Car, FamilyState, Id, Member, PickupRequest } from '../types';
import {
  MAX_BOOKING_LENGTH,
  PAST_GRACE,
  RuleError,
  effectiveEnd,
  involves,
  isConfirmed,
  needsApproval,
  newId,
  overlaps,
  statusOf,
  validateBooking,
} from './bookings';
import { L } from '../i18n';

// Pick-up requests: "Can someone pick me up from the train at 19:00? Any of these cars is fine."
// A request holds no car. When someone says yes, they choose one of the cars (one they're insured
// on and that's free), and only then does it become a real booking on the calendar.

export type PickupDraft = Pick<PickupRequest, 'memberId' | 'carIds' | 'start' | 'end' | 'place'>;

const requestsOf = (state: FamilyState) => state.pickups ?? [];

/** No approved booking holds this car at that time. */
export function isCarFree(state: FamilyState, carId: Id, start: number, end: number): boolean {
  return !state.bookings.some((b) => isConfirmed(b) && b.carId === carId && overlaps(start, end, b.start, effectiveEnd(b)));
}

/** The cars on the request this person could take: insured on it, insurance still valid, and free. */
export function carsForDriver(state: FamilyState, req: PickupDraft, driverId: Id): Car[] {
  return req.carIds
    .map((id) => state.cars.find((c) => c.id === id))
    .filter(
      (c): c is Car =>
        !!c &&
        c.insuredMemberIds.includes(driverId) &&
        (c.insuranceExpires === undefined || c.insuranceExpires >= req.end) &&
        isCarFree(state, c.id, req.start, req.end),
    );
}

/** Everyone who could do this pick-up with at least one of the cars. */
export function driversFor(state: FamilyState, req: PickupDraft): Member[] {
  return state.members.filter((m) => m.id !== req.memberId && carsForDriver(state, req, m.id).length > 0);
}

export function validatePickupRequest(state: FamilyState, d: PickupDraft, now = Date.now()): void {
  const rider = state.members.find((m) => m.id === d.memberId);
  if (!rider) throw new RuleError(L('That family member no longer exists.', 'בן המשפחה הזה כבר לא קיים.'));
  if (!d.place.trim()) throw new RuleError(L('Where should they pick you up?', 'מאיפה לאסוף אותך?'));
  if (d.end <= d.start) throw new RuleError(L('The end time must be after the start time.', 'שעת הסיום חייבת להיות אחרי שעת ההתחלה.'));
  if (d.end - d.start > MAX_BOOKING_LENGTH) throw new RuleError(L('A pick-up can be at most 14 days long.', 'איסוף יכול להיות באורך של 14 ימים לכל היותר.'));
  if (d.start < now - PAST_GRACE) throw new RuleError(L("You can't ask for a time that has already passed.", 'אי אפשר לבקש זמן שכבר עבר.'));
  if (d.carIds.length === 0) throw new RuleError(L('Choose at least one car.', 'צריך לבחור לפחות רכב אחד.'));
  if (d.carIds.some((id) => !state.cars.some((c) => c.id === id))) throw new RuleError(L('One of those cars no longer exists.', 'אחד הרכבים כבר לא קיים.'));

  if (!d.carIds.some((id) => isCarFree(state, id, d.start, d.end))) {
    throw new RuleError(
      d.carIds.length === 1
        ? L('That car is already booked then.', 'הרכב הזה כבר מוזמן בזמן הזה.')
        : L('None of the cars you chose is free then.', 'אף אחד מהרכבים שבחרת לא פנוי בזמן הזה.'),
    );
  }
  if (driversFor(state, d).length === 0) {
    throw new RuleError(
      L(
        `Nobody else is insured on ${d.carIds.length === 1 ? 'that car' : 'those cars'} to pick ${rider.name} up then.`,
        `אין מישהו אחר עם ביטוח על ${d.carIds.length === 1 ? 'הרכב הזה' : 'הרכבים האלה'} שיכול לאסוף את ${rider.name} בזמן הזה.`,
      ),
    );
  }

  const busy = state.bookings.find(
    (b) => statusOf(b) !== 'declined' && involves(b, rider.id) && overlaps(d.start, d.end, b.start, effectiveEnd(b)),
  );
  if (busy) {
    const car = state.cars.find((c) => c.id === busy.carId)?.name ?? L('another car', 'רכב אחר');
    throw new RuleError(L(`${rider.name} already has ${car} at that time.`, `${car} כבר אצל ${rider.name} בזמן הזה.`));
  }
  if (requestsOf(state).some((r) => r.memberId === rider.id && overlaps(d.start, d.end, r.start, r.end))) {
    throw new RuleError(L(`${rider.name} already asked for a pick-up at that time.`, `כבר יש בקשת איסוף של ${rider.name} בזמן הזה.`));
  }
}

export function createPickupRequest(state: FamilyState, d: PickupDraft, now = Date.now(), id: Id = newId()): FamilyState {
  validatePickupRequest(state, d, now);
  const req: PickupRequest = { id, memberId: d.memberId, carIds: [...new Set(d.carIds)], start: d.start, end: d.end, place: d.place.trim(), createdAt: now };
  // Drop requests whose time has passed while we're here.
  return { ...state, pickups: [...requestsOf(state).filter((r) => r.end > now), req] };
}

export function cancelPickupRequest(state: FamilyState, requestId: Id): FamilyState {
  return { ...state, pickups: requestsOf(state).filter((r) => r.id !== requestId) };
}

/** Requests this person could say yes to. */
export function openPickupsFor(state: FamilyState, memberId: Id, now = Date.now()): PickupRequest[] {
  return requestsOf(state)
    .filter((r) => r.memberId !== memberId && r.end > now && carsForDriver(state, r, memberId).length > 0)
    .sort((a, b) => a.start - b.start);
}

/** This person's own requests that nobody has taken yet. */
export function myPickupRequests(state: FamilyState, memberId: Id, now = Date.now()): PickupRequest[] {
  return requestsOf(state)
    .filter((r) => r.memberId === memberId && r.end > now)
    .sort((a, b) => a.start - b.start);
}

/**
 * "I'll pick you up with the Corolla": the request becomes a booking on that car, driven by them.
 * If the car has owners and the driver isn't one, it waits for an owner's OK like any booking.
 */
export function takePickup(
  state: FamilyState,
  requestId: Id,
  driverId: Id,
  carId: Id,
  now = Date.now(),
  bookingId: Id = newId(),
): FamilyState {
  const req = requestsOf(state).find((r) => r.id === requestId);
  if (!req) throw new RuleError(L('Someone already took this pick-up, or it was cancelled.', 'מישהו כבר לקח את האיסוף הזה, או שהוא בוטל.'));
  if (req.end <= now) throw new RuleError(L('That pick-up time has passed.', 'זמן האיסוף כבר עבר.'));
  if (driverId === req.memberId) throw new RuleError(L("You can't pick yourself up.", 'אי אפשר לאסוף את עצמך.'));
  if (!req.carIds.includes(carId)) throw new RuleError(L("That car isn't one of the cars they asked for.", 'הרכב הזה לא אחד מהרכבים שביקשו.'));
  const car = state.cars.find((c) => c.id === carId);
  if (!car) throw new RuleError(L('That car no longer exists.', 'הרכב הזה כבר לא קיים.'));

  const booking: Booking = {
    id: bookingId,
    status: needsApproval(car, driverId) ? 'pending' : 'approved',
    carId,
    memberId: req.memberId,
    start: req.start,
    end: req.end,
    pickup: { place: req.place, driverId, carIds: req.carIds },
    createdAt: now,
  };
  validateBooking(state, booking, now); // the driver is insured, the car is free, nobody is double-booked
  return {
    ...state,
    pickups: requestsOf(state).filter((r) => r.id !== requestId),
    bookings: [...state.bookings, booking],
  };
}

/** Turns a pick-up booking back into an open request (its driver dropped out). */
export function toRequest(b: Booking, now: number): PickupRequest {
  return {
    id: newId(),
    memberId: b.memberId,
    carIds: b.pickup?.carIds ?? [b.carId],
    start: b.start,
    end: b.end,
    place: b.pickup?.place ?? '',
    createdAt: now,
  };
}

/** The driver can't make it after all: the car is freed and the request goes back to everyone. */
export function releasePickup(state: FamilyState, bookingId: Id, driverId: Id, now = Date.now()): FamilyState {
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking?.pickup || booking.pickup.driverId !== driverId) throw new RuleError(L("You're not the driver for this pick-up.", 'לא את/ה הנהג/ת באיסוף הזה.'));
  return {
    ...state,
    bookings: state.bookings.filter((b) => b.id !== bookingId),
    pickups: booking.end > now ? [...requestsOf(state), toRequest(booking, now)] : requestsOf(state),
  };
}
