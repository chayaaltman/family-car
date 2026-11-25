// Core data model. Times are stored as epoch milliseconds so they compare
// cheaply and serialize the same way to AsyncStorage and Firestore.

export type Id = string;

export interface Member {
  id: Id;
  name: string;
  color: string; // used for avatars and booking blocks in the calendar
  phone?: string;
  /** 4–6 digits. Needed to choose this person on a new phone, so nobody can pretend to be someone else. */
  pin?: string;
}

export type FuelLevel = 'empty' | 'quarter' | 'half' | 'three-quarters' | 'full';

export interface CarReport {
  // Filled in when someone returns the car: "where is it and what state is it in?"
  memberId: Id;
  at: number;
  parkedAt?: string;
  fuel?: FuelLevel;
  note?: string;
}

export interface Car {
  id: Id;
  name: string; // "Mom's Corolla"
  model?: string;
  plate?: string;
  color: string;
  seats?: number;
  insuredMemberIds: Id[];
  /** The car's owners. If there are any, other people's bookings need one of them to approve. */
  ownerIds?: Id[];
  /** Older data: a single owner. Read it through `ownersOf(car)`. */
  ownerId?: Id;
  insuranceCompany?: string;
  insuranceExpires?: number; // epoch ms
  lastReport?: CarReport;
}

/**
 * pending  – waiting for the car owner; not on the calendar and doesn't block the car.
 * approved – on the calendar (bookings without a status are approved; older data has none).
 * declined – the owner said no; only the requester still sees it.
 */
export type BookingStatus = 'pending' | 'approved' | 'declined';

/** On a booking that came from a pick-up request: where to go, and who's driving. */
export interface Pickup {
  place: string; // where to pick them up, e.g. "the train station"
  driverId?: Id;
  carIds?: Id[]; // the cars the person asked for, so the request can be reopened if the driver drops out
  requestId?: Id; // the pick-up request it came from, so an old link to the request can find it
}

/**
 * "Can someone pick me up?" — holds no car. Whoever says yes picks one of `carIds`
 * (insured and free), and only then does it become a booking.
 */
export interface PickupRequest {
  id: Id;
  memberId: Id; // the person who needs a ride
  carIds: Id[];
  start: number;
  end: number;
  place: string;
  createdAt: number;
}

export interface Booking {
  id: Id;
  status?: BookingStatus;
  decidedBy?: Id;
  decidedAt?: number;
  declineReason?: string;
  carId: Id;
  memberId: Id;
  start: number;
  end: number;
  purpose?: string;
  destination?: string; // where the driver is going, e.g. "Grandma's house, Haifa"
  createdAt: number;
  returnedAt?: number; // set if the car came back before `end`
  /** Set when this booking is a pick-up: `memberId` is the person being picked up, `pickup.driverId` drives. */
  pickup?: Pickup;
}

export interface FamilyState {
  familyName: string;
  members: Member[];
  cars: Car[];
  bookings: Booking[];
  /** Open pick-up requests nobody has said yes to yet. */
  pickups?: PickupRequest[];
  updatedAt: number;
  /** The only person who can add, edit or remove people and cars. Older families have none: the first member is admin. */
  adminId?: Id;
  /** Old admin-only PIN; now each member has their own `pin`. Still honored for the admin if they have no `pin`. */
  adminPin?: string;
}
