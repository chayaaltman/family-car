import type { Booking, FamilyState, Id } from '../types';
import { L, getLanguage } from '../i18n';

/**
 * Who a booking is for, from the viewer's point of view:
 * "You", "Noa", "Dad picking up you", "Pick-up for Eli · driver needed".
 */
export function whoLabel(state: Pick<FamilyState, 'members'>, b: Pick<Booking, 'memberId' | 'pickup'>, meId: Id): string {
  const name = (id: Id) => (id === meId ? L('You', 'אני') : state.members.find((m) => m.id === id)?.name ?? L('Someone', 'מישהו'));
  if (!b.pickup) return name(b.memberId);
  const mine = b.memberId === meId;
  const rider = mine ? 'you' : name(b.memberId);
  const riderHe = mine ? 'עבורי' : `עבור ${name(b.memberId)}`;
  const driverId = b.pickup.driverId;
  if (!driverId) return L(`Pick-up for ${rider} · driver needed`, `איסוף ${riderHe} · צריך נהג/ת`);
  if (driverId === meId) return L(`You're picking up ${rider}`, `איסוף ${riderHe} · נוהג/ת: אני`);
  return L(`${name(driverId)} picking up ${rider}`, `איסוף ${riderHe} · נוהג/ת: ${name(driverId)}`);
}

/** "Mom", "Mom and Ezra", "Mom, Ezra and Noa" (Hebrew: "אמא ועזרא", "אמא או עזרא"). */
export function joinNames(names: string[], joiner: 'and' | 'or' = 'and'): string {
  if (names.length <= 1) return names[0] ?? '';
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(', ');
  if (getLanguage() === 'he') return joiner === 'and' ? `${rest} ו${last}` : `${rest} או ${last}`;
  return `${rest} ${joiner} ${last}`;
}
