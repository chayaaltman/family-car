import type { Booking, Car, CarReport, FamilyState, Id, Member } from '../types';
import { DAY, MINUTE, endOfDay, formatDate, formatRange, startOfDay } from './time';

/** Thrown when an action breaks a family rule. The message is shown to the user as-is. */
export class RuleError extends Error {
  constructor(message: string, public readonly suggestion?: { start: number; end: number }) {
    super(message);
    this.name = 'RuleError';
  }
}

export const MAX_BOOKING_LENGTH = 14 * DAY;
/** Lets someone book "right now" even if a minute passed while they filled the form. */
export const PAST_GRACE = 5 * MINUTE;

/** When the booking actually stops blocking the car (earlier if it was returned early). */
export function effectiveEnd(b: Booking): number {
  return b.returnedAt !== undefined ? Math.min(b.returnedAt, b.end) : b.end;
}

/** Half-open intervals: a booking ending at 10:00 doesn't clash with one starting at 10:00. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isInsured(car: Car, memberId: Id, at: number): boolean {
  if (!car.insuredMemberIds.includes(memberId)) return false;
  return car.insuranceExpires === undefined || car.insuranceExpires >= at;
}

export function bookingsForCar(state: FamilyState, carId: Id): Booking[] {
  return state.bookings
    .filter((b) => b.carId === carId)
    .sort((a, b) => a.start - b.start);
}

/** Bookings that touch the given day, sorted by start time. */
export function bookingsOnDay(bookings: Booking[], day: number): Booking[] {
  const from = startOfDay(day);
  const to = endOfDay(day);
  return bookings
    .filter((b) => overlaps(b.start, effectiveEnd(b), from, to))
    .sort((a, b) => a.start - b.start);
}

export interface Draft {
  id?: Id; // present when editing an existing booking
  carId: Id;
  memberId: Id;
  start: number;
  end: number;
  purpose?: string;
}

/**
 * Checks a booking against every family rule. Returns nothing when valid,
 * otherwise throws a RuleError explaining what's wrong (and, for clashes,
 * the nearest free slot of the same length).
 */
export function validateBooking(state: FamilyState, draft: Draft, now = Date.now()): void {
  const car = state.cars.find((c) => c.id === draft.carId);
  if (!car) throw new RuleError('That car no longer exists.');
  const member = state.members.find((m) => m.id === draft.memberId);
  if (!member) throw new RuleError('That family member no longer exists.');

  if (draft.end <= draft.start) throw new RuleError('The end time must be after the start time.');
  if (draft.end - draft.start > MAX_BOOKING_LENGTH) {
    throw new RuleError('A booking can be at most 14 days long.');
  }
  if (!draft.id && draft.start < now - PAST_GRACE) {
    throw new RuleError("You can't book a time that has already passed.");
  }

  if (!car.insuredMemberIds.includes(member.id)) {
    throw new RuleError(`${member.name} isn't insured to drive ${car.name}.`);
  }
  if (car.insuranceExpires !== undefined && car.insuranceExpires < draft.end) {
    throw new RuleError(
      `${car.name}'s insurance expires on ${formatDate(car.insuranceExpires)}, before this booking ends.`,
    );
  }

  const others = state.bookings.filter((b) => b.id !== draft.id);

  const clash = others.find(
    (b) => b.carId === car.id && overlaps(draft.start, draft.end, b.start, effectiveEnd(b)),
  );
  if (clash) {
    const who = state.members.find((m) => m.id === clash.memberId)?.name ?? 'Someone';
    const suggestion = findNextFreeSlot(state, car.id, draft.start, draft.end - draft.start, draft.id);
    throw new RuleError(
      `${car.name} is already booked by ${who} (${formatRange(clash.start, effectiveEnd(clash), now)}).`,
      suggestion ?? undefined,
    );
  }

  const doubleBooked = others.find(
    (b) => b.memberId === member.id && overlaps(draft.start, draft.end, b.start, effectiveEnd(b)),
  );
  if (doubleBooked) {
    const other = state.cars.find((c) => c.id === doubleBooked.carId)?.name ?? 'another car';
    throw new RuleError(`${member.name} already has ${other} at that time — one car at a time!`);
  }
}

/**
 * Earliest start >= `from` where the car is free for `duration` ms.
 * Returns null if nothing is free within the next 30 days.
 */
export function findNextFreeSlot(
  state: FamilyState,
  carId: Id,
  from: number,
  duration: number,
  ignoreBookingId?: Id,
): { start: number; end: number } | null {
  const busy = bookingsForCar(state, carId)
    .filter((b) => b.id !== ignoreBookingId && effectiveEnd(b) > from)
    .map((b) => ({ start: b.start, end: effectiveEnd(b) }));

  let candidate = from;
  for (const slot of busy) {
    if (candidate + duration <= slot.start) break; // fits in the gap before this booking
    candidate = Math.max(candidate, slot.end);
  }
  if (candidate - from > 30 * DAY) return null;
  return { start: candidate, end: candidate + duration };
}

export type CarStatus =
  | { kind: 'in-use'; booking: Booking }
  | { kind: 'free'; next?: Booking };

export function carStatus(state: FamilyState, carId: Id, now = Date.now()): CarStatus {
  const bookings = bookingsForCar(state, carId);
  const current = bookings.find((b) => b.start <= now && now < effectiveEnd(b));
  if (current) return { kind: 'in-use', booking: current };
  return { kind: 'free', next: bookings.find((b) => b.start > now) };
}

export function insuranceWarning(car: Car, now = Date.now()): string | null {
  if (car.insuranceExpires === undefined) return null;
  const left = car.insuranceExpires - now;
  if (left < 0) return 'Insurance expired!';
  if (left < 30 * DAY) return `Insurance expires in ${Math.ceil(left / DAY)} days`;
  return null;
}

// ---------------------------------------------------------------------------
// State transitions. Each takes the current state and returns the next one,
// or throws a RuleError. The stores run these inside a transaction, so the
// rules are checked against the latest data even when two phones act at once.
// ---------------------------------------------------------------------------

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function saveBooking(state: FamilyState, draft: Draft, now = Date.now()): FamilyState {
  validateBooking(state, draft, now);
  if (draft.id) {
    return {
      ...state,
      bookings: state.bookings.map((b) =>
        b.id === draft.id
          ? { ...b, carId: draft.carId, memberId: draft.memberId, start: draft.start, end: draft.end, purpose: draft.purpose }
          : b,
      ),
    };
  }
  const booking: Booking = {
    id: newId(),
    carId: draft.carId,
    memberId: draft.memberId,
    start: draft.start,
    end: draft.end,
    purpose: draft.purpose,
    createdAt: now,
  };
  return { ...state, bookings: [...state.bookings, booking] };
}

export function cancelBooking(state: FamilyState, bookingId: Id): FamilyState {
  return { ...state, bookings: state.bookings.filter((b) => b.id !== bookingId) };
}

/** "I'm back": frees the car from now on and records where it was left. */
export function returnCar(
  state: FamilyState,
  bookingId: Id,
  report: Omit<CarReport, 'at' | 'memberId'>,
  now = Date.now(),
): FamilyState {
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new RuleError('That booking no longer exists.');
  return {
    ...state,
    bookings: state.bookings.map((b) => (b.id === bookingId ? { ...b, returnedAt: now } : b)),
    cars: state.cars.map((c) =>
      c.id === booking.carId ? { ...c, lastReport: { ...report, memberId: booking.memberId, at: now } } : c,
    ),
  };
}

export function upsertCar(state: FamilyState, car: Car): FamilyState {
  if (!car.name.trim()) throw new RuleError('Give the car a name.');
  const exists = state.cars.some((c) => c.id === car.id);
  return {
    ...state,
    cars: exists ? state.cars.map((c) => (c.id === car.id ? car : c)) : [...state.cars, car],
  };
}

export function deleteCar(state: FamilyState, carId: Id): FamilyState {
  return {
    ...state,
    cars: state.cars.filter((c) => c.id !== carId),
    bookings: state.bookings.filter((b) => b.carId !== carId),
  };
}

export function upsertMember(state: FamilyState, member: Member): FamilyState {
  if (!member.name.trim()) throw new RuleError('Enter a name.');
  const exists = state.members.some((m) => m.id === member.id);
  return {
    ...state,
    members: exists ? state.members.map((m) => (m.id === member.id ? member : m)) : [...state.members, member],
  };
}

export function deleteMember(state: FamilyState, memberId: Id): FamilyState {
  if (state.members.length <= 1) throw new RuleError('A family needs at least one member.');
  return {
    ...state,
    members: state.members.filter((m) => m.id !== memberId),
    cars: state.cars.map((c) => ({
      ...c,
      insuredMemberIds: c.insuredMemberIds.filter((id) => id !== memberId),
    })),
    bookings: state.bookings.filter((b) => b.memberId !== memberId),
  };
}
