import type { Booking, FamilyState, Id, PickupRequest } from '../types';
import { driverOf, ownerNames } from './bookings';
import { joinNames } from './labels';
import { formatRange } from './time';
import { L } from '../i18n';

// Ready-made texts for WhatsApp / SMS, in English or Hebrew. The user can still edit them before sending.
// The Hebrew is worded so it works whoever is writing (no gendered verbs where avoidable).

function parts(state: FamilyState, b: Booking) {
  const car = state.cars.find((c) => c.id === b.carId)?.name ?? L('the car', 'הרכב');
  const who = state.members.find((m) => m.id === (driverOf(b) ?? b.memberId))?.name ?? '';
  const carObj = state.cars.find((c) => c.id === b.carId);
  const owner = carObj ? ownerNames(state, carObj, 'and') : '';
  const when = formatRange(b.start, b.end);
  const where = b.destination ? L(` to ${b.destination}`, ` (יעד: ${b.destination})`) : '';
  return { car, who, owner, when, where };
}

/** Requester → owner, right after asking (or as a reminder). */
export function requestMessage(state: FamilyState, b: Booking, toNames: string[] = []): string {
  const { car, who, owner, when, where } = parts(state, b);
  const hi = toNames.length ? joinNames(toNames) : owner;
  return L(
    `Hi ${hi}! I asked for the ${car} ${when}${where}. Can you approve it in Family Car? 🙏 – ${who}`,
    `היי ${hi}! ביקשתי את ${car} ${when}${where}. אפשר לאשר ב-Family Car? 🙏 – ${who}`,
  );
}

/** Owner → requester, after deciding. */
export function decisionMessage(state: FamilyState, b: Booking, approved: boolean, reason?: string, fromId?: Id): string {
  const { car, who, when, owner: owners } = parts(state, b);
  // Signed by whoever decided (a car can have several owners).
  const owner = state.members.find((m) => m.id === fromId)?.name ?? owners;
  const why = reason?.trim() ? ` ${reason.trim()}.` : '';
  if (approved) {
    return L(
      `Hi ${who}, I approved your ${car} booking ${when} 👍 Drive safe! – ${owner}`,
      `היי ${who}, אישרתי לך את ${car} ${when} 👍 נסיעה טובה! – ${owner}`,
    );
  }
  return L(
    `Hi ${who}, sorry – I can't give you the ${car} ${when}.${why} – ${owner}`,
    `היי ${who}, סליחה – לא אוכל לתת לך את ${car} ${when}.${why} – ${owner}`,
  );
}

/** Person who needs a ride → the people who could drive (or a group chat: no names = "everyone"). */
export function pickupRequestMessage(state: FamilyState, r: PickupRequest, toNames: string[] = []): string {
  const who = state.members.find((m) => m.id === r.memberId)?.name ?? '';
  const cars = r.carIds.map((id) => state.cars.find((c) => c.id === id)?.name).filter(Boolean) as string[];
  const carText =
    cars.length > 1
      ? L(` Any of these cars is fine: ${joinNames(cars, 'or')}.`, ` אפשר לקחת כל אחד מהרכבים: ${joinNames(cars, 'or')}.`)
      : cars.length
        ? L(` You can take the ${cars[0]}.`, ` אפשר לקחת את ${cars[0]}.`)
        : '';
  const hi = toNames.length ? joinNames(toNames) : L('everyone', 'כולם');
  const when = formatRange(r.start, r.end);
  return L(
    `Hi ${hi}! Can someone pick me up from ${r.place} ${when}?${carText} Tap "I'll pick you up" in Family Car 🙏 – ${who}`,
    `היי ${hi}! מישהו יכול לאסוף אותי מ${r.place} ${when}?${carText} אפשר ללחוץ על "אני אאסוף" ב-Family Car 🙏 – ${who}`,
  );
}

/** Driver → the person being picked up, right after saying yes. */
export function pickupTakenMessage(state: FamilyState, b: Booking, driverId: Id): string {
  const rider = state.members.find((m) => m.id === b.memberId)?.name ?? '';
  const car = state.cars.find((c) => c.id === b.carId)?.name ?? L('the car', 'הרכב');
  const driver = state.members.find((m) => m.id === driverId)?.name ?? '';
  const place = b.pickup?.place ?? '';
  const when = formatRange(b.start, b.end);
  return L(
    `Hi ${rider}, I'll pick you up from ${place || 'there'} ${when} with the ${car} 🚗 – ${driver}`,
    `היי ${rider}, אני אאסוף אותך${place ? ` מ${place}` : ''} ${when} עם ${car} 🚗 – ${driver}`,
  );
}

/** Anyone → the person who has the car booked. */
export function askAboutBookingMessage(state: FamilyState, b: Booking, fromName: string): string {
  const { car, who, when } = parts(state, b);
  return L(
    `Hi ${who}! I saw you have the ${car} ${when}. Any chance we can work something out? 🚗 – ${fromName}`,
    `היי ${who}! ראיתי ש${car} אצלך ${when}. יש סיכוי שנסתדר? 🚗 – ${fromName}`,
  );
}
