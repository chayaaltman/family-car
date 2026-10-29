import type { Booking, BookingStatus, Car, CarReport, FamilyState, Id, Member } from '../types';
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

export function statusOf(b: Booking): BookingStatus {
  return b.status ?? 'approved';
}

/** Only approved bookings are on the calendar and hold the car. */
export function isConfirmed(b: Booking): boolean {
  return statusOf(b) === 'approved';
}

/** Does this person need the owner's OK to take this car? */
export function needsApproval(car: Car, memberId: Id): boolean {
  return car.ownerId !== undefined && car.ownerId !== memberId;
}

/** Approved bookings for a car, sorted by start time. */
export function bookingsForCar(state: FamilyState, carId: Id): Booking[] {
  return state.bookings
    .filter((b) => b.carId === carId && isConfirmed(b))
    .sort((a, b) => a.start - b.start);
}

/** Requests waiting for this member to approve (as owner of the car). */
export function requestsFor(state: FamilyState, ownerId: Id, now = Date.now()): Booking[] {
  const owned = new Set(state.cars.filter((c) => c.ownerId === ownerId).map((c) => c.id));
  return state.bookings
    .filter((b) => statusOf(b) === 'pending' && owned.has(b.carId) && b.end > now)
    .sort((a, b) => a.start - b.start);
}

/** Approved bookings that touch the given day, sorted by start time. */
export function bookingsOnDay(bookings: Booking[], day: number): Booking[] {
  const from = startOfDay(day);
  const to = endOfDay(day);
  return bookings
    .filter((b) => isConfirmed(b) && overlaps(b.start, effectiveEnd(b), from, to))
    .sort((a, b) => a.start - b.start);
}

export interface Draft {
  id?: Id; // present when editing an existing booking
  carId: Id;
  memberId: Id;
  start: number;
  end: number;
  purpose?: string;
  destination?: string;
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

  // Only approved bookings hold the car; pending requests don't block anyone.
  const clash = others.find(
    (b) => isConfirmed(b) && b.carId === car.id && overlaps(draft.start, draft.end, b.start, effectiveEnd(b)),
  );
  if (clash) {
    const who = state.members.find((m) => m.id === clash.memberId)?.name ?? 'Someone';
    const suggestion = findNextFreeSlot(state, car.id, draft.start, draft.end - draft.start, draft.id);
    throw new RuleError(
      `${car.name} is already booked by ${who} (${formatRange(clash.start, effectiveEnd(clash), now)}).`,
      suggestion ?? undefined,
    );
  }

  // Your own requests count too: no asking for two cars at once.
  const doubleBooked = others.find(
    (b) => statusOf(b) !== 'declined' && b.memberId === member.id && overlaps(draft.start, draft.end, b.start, effectiveEnd(b)),
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

/**
 * Creates or edits a booking. If the car has an owner and someone else is
 * driving, it becomes a request the owner must approve. Editing an approved
 * booking's car or times sends it back for approval; editing just the notes doesn't.
 */
export function saveBooking(state: FamilyState, draft: Draft, now = Date.now()): FamilyState {
  validateBooking(state, draft, now);
  const car = state.cars.find((c) => c.id === draft.carId)!;
  const askOwner = needsApproval(car, draft.memberId);

  if (draft.id) {
    return {
      ...state,
      bookings: state.bookings.map((b) => {
        if (b.id !== draft.id) return b;
        const changed =
          b.carId !== draft.carId || b.memberId !== draft.memberId || b.start !== draft.start || b.end !== draft.end;
        const keepApproval = isConfirmed(b) && !changed;
        return {
          ...b,
          carId: draft.carId,
          memberId: draft.memberId,
          start: draft.start,
          end: draft.end,
          purpose: draft.purpose,
          destination: draft.destination,
          ...(askOwner && !keepApproval
            ? { status: 'pending' as const, decidedBy: undefined, decidedAt: undefined, declineReason: undefined }
            : askOwner
              ? {}
              : { status: 'approved' as const, declineReason: undefined }),
        };
      }),
    };
  }
  const booking: Booking = {
    id: newId(),
    status: askOwner ? 'pending' : 'approved',
    carId: draft.carId,
    memberId: draft.memberId,
    start: draft.start,
    end: draft.end,
    purpose: draft.purpose,
    destination: draft.destination,
    createdAt: now,
  };
  return { ...state, bookings: [...state.bookings, booking] };
}

/** The car owner says yes. Overlapping requests for the same car are declined automatically. */
export function approveBooking(state: FamilyState, bookingId: Id, approverId: Id, now = Date.now()): FamilyState {
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new RuleError('That request no longer exists.');
  if (statusOf(booking) !== 'pending') throw new RuleError('This request was already answered.');
  const car = state.cars.find((c) => c.id === booking.carId);
  if (!car) throw new RuleError('That car no longer exists.');
  if (car.ownerId !== approverId) throw new RuleError(`Only ${car.name}'s owner can approve this.`);
  if (booking.end <= now) throw new RuleError('This request has already expired.');

  // Re-check against the latest calendar: someone may have been approved in the meantime.
  validateBooking(state, booking, now);

  const requester = state.members.find((m) => m.id === booking.memberId)?.name ?? 'someone';
  return {
    ...state,
    bookings: state.bookings.map((b) => {
      if (b.id === booking.id) {
        return { ...b, status: 'approved' as const, decidedBy: approverId, decidedAt: now };
      }
      if (
        statusOf(b) === 'pending' &&
        b.carId === booking.carId &&
        overlaps(b.start, b.end, booking.start, booking.end)
      ) {
        return {
          ...b,
          status: 'declined' as const,
          decidedBy: approverId,
          decidedAt: now,
          declineReason: `${car.name} was given to ${requester} for that time.`,
        };
      }
      return b;
    }),
  };
}

/** The car owner says no, optionally with a reason the requester will see. */
export function declineBooking(
  state: FamilyState,
  bookingId: Id,
  approverId: Id,
  reason?: string,
  now = Date.now(),
): FamilyState {
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new RuleError('That request no longer exists.');
  if (statusOf(booking) !== 'pending') throw new RuleError('This request was already answered.');
  const car = state.cars.find((c) => c.id === booking.carId);
  if (!car || car.ownerId !== approverId) throw new RuleError("Only the car's owner can decline this.");
  return {
    ...state,
    bookings: state.bookings.map((b) =>
      b.id === bookingId
        ? { ...b, status: 'declined' as const, decidedBy: approverId, decidedAt: now, declineReason: reason?.trim() || undefined }
        : b,
    ),
  };
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

export function upsertCar(state: FamilyState, car: Car, now = Date.now()): FamilyState {
  if (!car.name.trim()) throw new RuleError('Give the car a name.');
  const exists = state.cars.some((c) => c.id === car.id);
  return settleRequests(
    { ...state, cars: exists ? state.cars.map((c) => (c.id === car.id ? car : c)) : [...state.cars, car] },
    now,
  );
}

/**
 * After a car's owner changes (or is removed), requests that no longer need
 * approval are approved if they still fit the calendar, and declined if not.
 * Without this they'd wait forever for an owner who isn't there.
 */
function settleRequests(state: FamilyState, now: number): FamilyState {
  let next = state;
  for (const b of state.bookings) {
    const car = state.cars.find((c) => c.id === b.carId);
    if (statusOf(b) !== 'pending' || !car || needsApproval(car, b.memberId)) continue;
    try {
      validateBooking(next, b, now);
      next = { ...next, bookings: next.bookings.map((x) => (x.id === b.id ? { ...x, status: 'approved' as const } : x)) };
    } catch {
      next = {
        ...next,
        bookings: next.bookings.map((x) =>
          x.id === b.id ? { ...x, status: 'declined' as const, declineReason: 'The car is no longer free at that time.' } : x,
        ),
      };
    }
  }
  return next;
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

export function deleteMember(state: FamilyState, memberId: Id, now = Date.now()): FamilyState {
  if (state.members.length <= 1) throw new RuleError('A family needs at least one member.');
  return settleRequests({
    ...state,
    members: state.members.filter((m) => m.id !== memberId),
    cars: state.cars.map((c) => ({
      ...c,
      insuredMemberIds: c.insuredMemberIds.filter((id) => id !== memberId),
      ownerId: c.ownerId === memberId ? undefined : c.ownerId,
    })),
    bookings: state.bookings.filter((b) => b.memberId !== memberId),
  }, now);
}
