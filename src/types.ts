// Core data model. Times are stored as epoch milliseconds so they compare
// cheaply and serialize the same way to AsyncStorage and Firestore.

export type Id = string;

export interface Member {
  id: Id;
  name: string;
  color: string; // used for avatars and booking blocks in the calendar
  phone?: string;
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
  /** If set, other people's bookings need this person's approval. */
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
}

export interface FamilyState {
  familyName: string;
  members: Member[];
  cars: Car[];
  bookings: Booking[];
  updatedAt: number;
}
