import type { Booking, BookingStatus, Car, CarReport, FamilyState, Id, Member, Pickup } from '../types';
import { DAY, MINUTE, endOfDay, formatDate, formatRange, startOfDay } from './time';
import { L } from '../i18n';
import { joinNames } from './labels';

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

/** The car's owners (older cars stored a single `ownerId`). */
export function ownersOf(car: Car): Id[] {
  return car.ownerIds ?? (car.ownerId ? [car.ownerId] : []);
}

export function isOwner(car: Car, memberId: Id): boolean {
  return ownersOf(car).includes(memberId);
}

/** "Dad", "Dad or Mom", "Dad, Mom or Noa" (use joiner "and" for "Dad and Mom"). */
export function ownerNames(state: FamilyState, car: Car, joiner: 'or' | 'and' = 'or', exclude?: Id): string {
  const names = ownersOf(car)
    .filter((id) => id !== exclude)
    .map((id) => state.members.find((m) => m.id === id)?.name)
    .filter((n): n is string => !!n);
  return joinNames(names, joiner);
}

/** Does this person need an owner's OK to take this car? */
export function needsApproval(car: Car, memberId: Id): boolean {
  const owners = ownersOf(car);
  return owners.length > 0 && !owners.includes(memberId);
}

/** Approved bookings for a car, sorted by start time. */
export function bookingsForCar(state: FamilyState, carId: Id): Booking[] {
  return state.bookings
    .filter((b) => b.carId === carId && isConfirmed(b))
    .sort((a, b) => a.start - b.start);
}

/** Requests waiting for this member to approve (as owner of the car). */
export function requestsFor(state: FamilyState, ownerId: Id, now = Date.now()): Booking[] {
  const owned = new Set(state.cars.filter((c) => isOwner(c, ownerId)).map((c) => c.id));
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
  pickup?: Pickup;
}

/** Who drives: the booker, or for a pick-up whoever took it (nobody yet = undefined). */
export function driverOf(b: Pick<Booking, 'memberId' | 'pickup'>): Id | undefined {
  return b.pickup ? b.pickup.driverId : b.memberId;
}

/** Is this person in this booking, as the driver or as the one being picked up? */
export function involves(b: Pick<Booking, 'memberId' | 'pickup'>, memberId: Id): boolean {
  return b.memberId === memberId || b.pickup?.driverId === memberId;
}

/** Everyone who could do a pick-up on this car: insured, and not the person being picked up. */
export function possibleDrivers(state: FamilyState, car: Car, riderId: Id): Member[] {
  return state.members.filter((m) => m.id !== riderId && car.insuredMemberIds.includes(m.id));
}

/**
 * Checks a booking against every family rule. Returns nothing when valid,
 * otherwise throws a RuleError explaining what's wrong (and, for clashes,
 * the nearest free slot of the same length).
 */
export function validateBooking(state: FamilyState, draft: Draft, now = Date.now()): void {
  const car = state.cars.find((c) => c.id === draft.carId);
  if (!car) throw new RuleError(L('That car no longer exists.', 'הרכב הזה כבר לא קיים.'));
  const member = state.members.find((m) => m.id === draft.memberId);
  if (!member) throw new RuleError(L('That family member no longer exists.', 'בן המשפחה הזה כבר לא קיים.'));

  if (draft.end <= draft.start) throw new RuleError(L('The end time must be after the start time.', 'שעת הסיום חייבת להיות אחרי שעת ההתחלה.'));
  if (draft.end - draft.start > MAX_BOOKING_LENGTH) {
    throw new RuleError(L('A booking can be at most 14 days long.', 'הזמנה יכולה להיות באורך של 14 ימים לכל היותר.'));
  }
  if (!draft.id && draft.start < now - PAST_GRACE) {
    throw new RuleError(L("You can't book a time that has already passed.", 'אי אפשר להזמין זמן שכבר עבר.'));
  }

  const driverId = draft.pickup ? draft.pickup.driverId : member.id;
  const driver = driverId ? state.members.find((m) => m.id === driverId) : undefined;
  if (draft.pickup) {
    // The person being picked up doesn't drive, so they don't need to be insured. Someone else does.
    if (!draft.pickup.place.trim()) throw new RuleError(L('Where should they pick you up?', 'מאיפה לאסוף אותך?'));
    if (possibleDrivers(state, car, member.id).length === 0) {
      throw new RuleError(L(`Nobody else is insured on ${car.name} to pick ${member.name} up.`, `אין עוד מישהו עם ביטוח על ${car.name} שיכול לאסוף את ${member.name}.`));
    }
    if (driverId && !driver) throw new RuleError(L('That driver is no longer in the family.', 'הנהג הזה כבר לא במשפחה.'));
    if (driverId === member.id) throw new RuleError(L("You can't pick yourself up.", 'אי אפשר לאסוף את עצמך.'));
  }
  if (driver && !car.insuredMemberIds.includes(driver.id)) {
    throw new RuleError(L(`${driver.name} isn't insured to drive ${car.name}.`, `ל${driver.name} אין ביטוח לנהוג ב${car.name}.`));
  }
  if (car.insuranceExpires !== undefined && car.insuranceExpires < draft.end) {
    throw new RuleError(
      L(
        `${car.name}'s insurance expires on ${formatDate(car.insuranceExpires)}, before this booking ends.`,
        `הביטוח של ${car.name} נגמר ב${formatDate(car.insuranceExpires)}, לפני סוף ההזמנה.`,
      ),
    );
  }

  const others = state.bookings.filter((b) => b.id !== draft.id);

  // Only approved bookings hold the car; pending requests don't block anyone.
  const clash = others.find(
    (b) => isConfirmed(b) && b.carId === car.id && overlaps(draft.start, draft.end, b.start, effectiveEnd(b)),
  );
  if (clash) {
    const who = state.members.find((m) => m.id === (clash.pickup?.driverId ?? clash.memberId))?.name ?? L('Someone', 'מישהו');
    const suggestion = findNextFreeSlot(state, car.id, draft.start, draft.end - draft.start, draft.id);
    throw new RuleError(
      L(
        `${car.name} is already booked by ${who} (${formatRange(clash.start, effectiveEnd(clash), now)}).`,
        `${car.name} כבר מוזמן על ידי ${who} (${formatRange(clash.start, effectiveEnd(clash), now)}).`,
      ),
      suggestion ?? undefined,
    );
  }

  // Your own requests count too: no asking for two cars at once. That goes for drivers doing a
  // pick-up and for the person being picked up.
  for (const person of [member, driver]) {
    if (!person) continue;
    const doubleBooked = others.find(
      (b) => statusOf(b) !== 'declined' && involves(b, person.id) && overlaps(draft.start, draft.end, b.start, effectiveEnd(b)),
    );
    if (doubleBooked) {
      const other = state.cars.find((c) => c.id === doubleBooked.carId)?.name ?? L('another car', 'רכב אחר');
      throw new RuleError(
        L(`${person.name} already has ${other} at that time — one car at a time!`, `${other} כבר אצל ${person.name} בזמן הזה. רכב אחד בכל פעם!`),
      );
    }
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
  if (left < 0) return L('Insurance expired!', 'הביטוח נגמר!');
  if (left < 30 * DAY) return L(`Insurance expires in ${Math.ceil(left / DAY)} days`, `הביטוח נגמר בעוד ${Math.ceil(left / DAY)} ימים`);
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
  if (!booking) throw new RuleError(L('That request no longer exists.', 'הבקשה הזאת כבר לא קיימת.'));
  if (statusOf(booking) !== 'pending') throw new RuleError(L('This request was already answered.', 'כבר ענו על הבקשה הזאת.'));
  const car = state.cars.find((c) => c.id === booking.carId);
  if (!car) throw new RuleError(L('That car no longer exists.', 'הרכב הזה כבר לא קיים.'));
  if (!isOwner(car, approverId)) throw new RuleError(L(`Only ${car.name}'s owners can approve this.`, `רק הבעלים של ${car.name} יכולים לאשר את זה.`));
  if (booking.end <= now) throw new RuleError(L('This request has already expired.', 'הזמן של הבקשה הזאת כבר עבר.'));

  // Re-check against the latest calendar: someone may have been approved in the meantime.
  validateBooking(state, booking, now);

  const requester = state.members.find((m) => m.id === booking.memberId)?.name ?? L('someone', 'מישהו');
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
          declineReason: L(`${car.name} was given to ${requester} for that time.`, `${car.name} ניתן ל${requester} בזמן הזה.`),
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
  if (!booking) throw new RuleError(L('That request no longer exists.', 'הבקשה הזאת כבר לא קיימת.'));
  if (statusOf(booking) !== 'pending') throw new RuleError(L('This request was already answered.', 'כבר ענו על הבקשה הזאת.'));
  const car = state.cars.find((c) => c.id === booking.carId);
  if (!car || !isOwner(car, approverId)) throw new RuleError(L("Only the car's owners can decline this.", 'רק הבעלים של הרכב יכולים לדחות את זה.'));
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
  if (!booking) throw new RuleError(L('That booking no longer exists.', 'ההזמנה הזאת כבר לא קיימת.'));
  return {
    ...state,
    bookings: state.bookings.map((b) => (b.id === bookingId ? { ...b, returnedAt: now } : b)),
    cars: state.cars.map((c) =>
      c.id === booking.carId ? { ...c, lastReport: { ...report, memberId: booking.memberId, at: now } } : c,
    ),
  };
}

export function upsertCar(state: FamilyState, car: Car, now = Date.now()): FamilyState {
  if (!car.name.trim()) throw new RuleError(L('Give the car a name.', 'צריך לתת שם לרכב.'));
  const exists = state.cars.some((c) => c.id === car.id);
  // Always store owners as a list; drop the old single-owner field.
  const { ownerId: _old, ...rest } = car;
  const saved: Car = { ...rest, ownerIds: [...new Set(ownersOf(car))] };
  return settleRequests(
    { ...state, cars: exists ? state.cars.map((c) => (c.id === car.id ? saved : c)) : [...state.cars, saved] },
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
    if (statusOf(b) !== 'pending' || !car || needsApproval(car, driverOf(b) ?? b.memberId)) continue;
    try {
      validateBooking(next, b, now);
      next = { ...next, bookings: next.bookings.map((x) => (x.id === b.id ? { ...x, status: 'approved' as const } : x)) };
    } catch {
      next = {
        ...next,
        bookings: next.bookings.map((x) =>
          x.id === b.id ? { ...x, status: 'declined' as const, declineReason: L('The car is no longer free at that time.', 'הרכב כבר לא פנוי בזמן הזה.') } : x,
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
    // Pick-up requests lose that car; a request with no cars left is dropped.
    pickups: (state.pickups ?? [])
      .map((r) => ({ ...r, carIds: r.carIds.filter((id) => id !== carId) }))
      .filter((r) => r.carIds.length > 0),
  };
}

export function upsertMember(state: FamilyState, member: Member): FamilyState {
  if (!member.name.trim()) throw new RuleError(L('Enter a name.', 'צריך להזין שם.'));
  const exists = state.members.some((m) => m.id === member.id);
  return {
    ...state,
    members: exists ? state.members.map((m) => (m.id === member.id ? member : m)) : [...state.members, member],
  };
}

export function deleteMember(state: FamilyState, memberId: Id, now = Date.now()): FamilyState {
  if (state.members.length <= 1) throw new RuleError(L('A family needs at least one member.', 'במשפחה צריך להיות לפחות אדם אחד.'));
  return settleRequests({
    ...state,
    members: state.members.filter((m) => m.id !== memberId),
    cars: state.cars.map(({ ownerId: _old, ...c }) => ({
      ...c,
      insuredMemberIds: c.insuredMemberIds.filter((id) => id !== memberId),
      ownerIds: ownersOf({ ownerId: _old, ...c }).filter((id) => id !== memberId),
    })),
    // Their bookings go, and pick-ups they were going to drive go back to everyone as open requests.
    bookings: state.bookings.filter((b) => b.memberId !== memberId && b.pickup?.driverId !== memberId),
    pickups: [
      ...(state.pickups ?? []).filter((r) => r.memberId !== memberId),
      ...state.bookings
        .filter((b) => b.pickup?.driverId === memberId && b.memberId !== memberId && b.end > now)
        .map((b) => ({
          id: newId(),
          memberId: b.memberId,
          carIds: b.pickup!.carIds ?? [b.carId],
          start: b.start,
          end: b.end,
          place: b.pickup!.place,
          createdAt: now,
        })),
    ],
  }, now);
}
