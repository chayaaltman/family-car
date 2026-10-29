import type { Booking, FamilyState } from '../types';
import { formatRange } from './time';

// Ready-made texts for WhatsApp / SMS. The user can still edit them before sending.

function parts(state: FamilyState, b: Booking) {
  const car = state.cars.find((c) => c.id === b.carId)?.name ?? 'the car';
  const who = state.members.find((m) => m.id === b.memberId)?.name ?? '';
  const owner = state.members.find((m) => m.id === state.cars.find((c) => c.id === b.carId)?.ownerId)?.name ?? '';
  const when = formatRange(b.start, b.end);
  const where = b.destination ? ` to ${b.destination}` : '';
  return { car, who, owner, when, where };
}

/** Requester → owner, right after asking (or as a reminder). */
export function requestMessage(state: FamilyState, b: Booking): string {
  const { car, who, owner, when, where } = parts(state, b);
  return `Hi ${owner}! I asked for the ${car} ${when}${where}. Can you approve it in Family Car? 🙏 – ${who}`;
}

/** Owner → requester, after deciding. */
export function decisionMessage(state: FamilyState, b: Booking, approved: boolean, reason?: string): string {
  const { car, who, owner, when } = parts(state, b);
  if (approved) return `Hi ${who}, I approved your ${car} booking ${when} 👍 Drive safe! – ${owner}`;
  return `Hi ${who}, sorry – I can't give you the ${car} ${when}.${reason?.trim() ? ` ${reason.trim()}.` : ''} – ${owner}`;
}

/** Anyone → the person who has the car booked. */
export function askAboutBookingMessage(state: FamilyState, b: Booking, fromName: string): string {
  const { car, who, when } = parts(state, b);
  return `Hi ${who}! I saw you have the ${car} ${when}. Any chance we can work something out? 🚗 – ${fromName}`;
}
