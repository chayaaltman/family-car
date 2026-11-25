import type { FamilyState } from '../types';
import { DAY, HOUR, addDays, startOfDay, withTime } from '../logic/time';
import { L, getLanguage } from '../i18n';

// Pastels that match the app icon: coral, sky, mint, peach, lavender, pink, teal, slate.
export const MEMBER_COLORS = ['#F2A097', '#8EC5EC', '#8FD3B6', '#F7C08A', '#B9A7E8', '#F4A7C8', '#7CCFCB', '#A9B4C8'];
export const CAR_COLORS = ['#7FB3E6', '#86D1B5', '#F5A98C', '#B7A4E6', '#AEB9C9', '#F5D27A'];

// The bright colors the app used before, mapped to their pastel versions, so families
// that picked colors earlier get the new look too.
const OLD_TO_PASTEL: Record<string, string> = {
  '#e8505b': '#F2A097', '#2d9cdb': '#8EC5EC', '#27ae60': '#8FD3B6', '#f2994a': '#F7C08A',
  '#9b51e0': '#B9A7E8', '#eb5fa5': '#F4A7C8', '#219e9e': '#7CCFCB', '#6d6875': '#A9B4C8',
  '#3d5afe': '#7FB3E6', '#00a676': '#86D1B5', '#ff7043': '#F5A98C', '#8e24aa': '#B7A4E6',
  '#546e7a': '#AEB9C9', '#fbc02d': '#F5D27A',
};
const pastel = (c: string) => OLD_TO_PASTEL[c.toLowerCase()] ?? c;

export function withPastelColors(state: FamilyState): FamilyState {
  return {
    ...state,
    members: state.members.map((m) => ({ ...m, color: pastel(m.color) })),
    cars: state.cars.map((c) => ({ ...c, color: pastel(c.color) })),
  };
}

/** A realistic demo family so the app looks alive on first launch. */
export function demoFamily(now = Date.now()): FamilyState {
  const today = startOfDay(now);
  const at = (dayOffset: number, h: number, m = 0) => withTime(addDays(today, dayOffset), h, m);

  return {
    familyName: 'The Demo Family',
    updatedAt: now,
    members: [
      { id: 'mom', name: 'Mom', color: MEMBER_COLORS[0] },
      { id: 'dad', name: 'Dad', color: MEMBER_COLORS[1] },
      { id: 'noa', name: 'Noa', color: MEMBER_COLORS[2] },
      { id: 'eli', name: 'Eli', color: MEMBER_COLORS[3] },
      { id: 'maya', name: 'Maya', color: MEMBER_COLORS[4] },
    ],
    cars: [
      {
        id: 'corolla',
        name: 'Corolla',
        model: 'Toyota Corolla 2019',
        plate: '12-345-67',
        color: CAR_COLORS[0],
        seats: 5,
        insuredMemberIds: ['mom', 'dad', 'noa', 'eli'],
        ownerIds: ['dad'], // Dad approves other people's Corolla bookings
        insuranceCompany: 'Harel',
        insuranceExpires: now + 120 * DAY,
        lastReport: {
          memberId: 'dad',
          at: now - 3 * HOUR,
          parkedAt: 'Driveway',
          fuel: 'half',
        },
      },
      {
        id: 'picanto',
        name: 'Picanto',
        model: 'Kia Picanto 2016',
        plate: '89-012-34',
        color: CAR_COLORS[1],
        seats: 4,
        insuredMemberIds: ['mom', 'noa', 'maya'],
        ownerIds: ['mom'],
        insuranceCompany: 'Migdal',
        insuranceExpires: now + 21 * DAY, // shows the "expires soon" warning
        lastReport: {
          memberId: 'noa',
          at: now - 20 * HOUR,
          parkedAt: 'Street, across from the grocery',
          fuel: 'quarter',
          note: 'Tire pressure light is on',
        },
      },
    ],
    bookings: [
      { id: 'b1', carId: 'corolla', memberId: 'dad', start: at(0, 7, 30), end: at(0, 9, 15), purpose: 'Work', destination: 'Office, Azrieli Center', createdAt: now },
      { id: 'b2', carId: 'corolla', memberId: 'noa', start: at(0, 17, 0), end: at(0, 22, 30), purpose: "Friend's birthday", destination: 'Tel Aviv Port', createdAt: now },
      { id: 'b3', carId: 'picanto', memberId: 'maya', start: at(0, 12, 0), end: at(0, 14, 45), purpose: 'Driving lesson practice', destination: 'Around the neighborhood', createdAt: now },
      { id: 'b4', carId: 'picanto', memberId: 'mom', start: at(1, 8, 0), end: at(1, 16, 0), purpose: 'Work', createdAt: now },
      { id: 'b5', carId: 'corolla', memberId: 'eli', start: at(1, 19, 0), end: at(1, 23, 0), purpose: 'Basketball', destination: 'Community center gym', createdAt: now },
      { id: 'b6', carId: 'corolla', memberId: 'mom', start: at(2, 10, 0), end: at(2, 12, 30), purpose: 'Visiting', destination: "Grandma's house, Haifa", createdAt: now },
      { id: 'b7', carId: 'picanto', memberId: 'noa', start: at(3, 9, 0), end: at(5, 18, 0), purpose: 'Trip up north', destination: 'Rosh Pina', createdAt: now },
      // Requests waiting for the owner (sign in as Dad or Mom to approve them).
      { id: 'r1', status: 'pending', carId: 'corolla', memberId: 'eli', start: at(1, 14, 0), end: at(1, 16, 30), purpose: 'Pick up friends', destination: 'Grand Mall', createdAt: now },
      { id: 'r2', status: 'pending', carId: 'picanto', memberId: 'maya', start: at(2, 16, 0), end: at(2, 18, 0), purpose: 'Study group', destination: "Tamar's house", createdAt: now },
      { id: 'b8', carId: 'corolla', memberId: 'dad', start: at(4, 7, 30), end: at(4, 18, 0), purpose: 'Work', createdAt: now },
    ],
  };
}

// The demo family's sample text in Hebrew. The demo is saved on the device in English, so it's
// translated as it's shown (see FamilyContext): switching language never needs a reset.
const DEMO_HE: Record<string, string> = {
  'The Demo Family': 'משפחת ההדגמה',
  Mom: 'אמא',
  Dad: 'אבא',
  Noa: 'נועה',
  Eli: 'אלי',
  Maya: 'מאיה',
  Corolla: 'קורולה',
  Picanto: 'פיקנטו',
  'Toyota Corolla 2019': 'טויוטה קורולה 2019',
  'Kia Picanto 2016': 'קיה פיקנטו 2016',
  Harel: 'הראל',
  Migdal: 'מגדל',
  Driveway: 'בחנייה של הבית',
  'Street, across from the grocery': 'ברחוב, מול המכולת',
  'Tire pressure light is on': 'נורת לחץ האוויר בצמיגים דולקת',
  Work: 'עבודה',
  'Office, Azrieli Center': 'המשרד, מרכז עזריאלי',
  "Friend's birthday": 'יום הולדת של חברה',
  'Tel Aviv Port': 'נמל תל אביב',
  'Driving lesson practice': 'תרגול נהיגה',
  'Around the neighborhood': 'מסביב לשכונה',
  Basketball: 'כדורסל',
  'Community center gym': 'אולם המתנ״ס',
  Visiting: 'ביקור',
  "Grandma's house, Haifa": 'אצל סבתא, חיפה',
  'Trip up north': 'טיול בצפון',
  'Rosh Pina': 'ראש פינה',
  'Pick up friends': 'לאסוף חברים',
  'Grand Mall': 'הגרנד קניון',
  'Study group': 'קבוצת לימוד',
  "Tamar's house": 'אצל תמר',
};

/** Shows the demo family in Hebrew when the app is in Hebrew. Anything the user typed is left as is. */
export function localizeDemo(state: FamilyState): FamilyState {
  if (getLanguage() !== 'he') return state;
  const t = <T extends string | undefined>(s: T): T => (s !== undefined && DEMO_HE[s] ? (DEMO_HE[s] as T) : s);
  return {
    ...state,
    familyName: t(state.familyName),
    members: state.members.map((m) => ({ ...m, name: t(m.name) })),
    cars: state.cars.map((c) => ({
      ...c,
      name: t(c.name),
      model: t(c.model),
      insuranceCompany: t(c.insuranceCompany),
      lastReport: c.lastReport && { ...c.lastReport, parkedAt: t(c.lastReport.parkedAt), note: t(c.lastReport.note) },
    })),
    bookings: state.bookings.map((b) => ({ ...b, purpose: t(b.purpose), destination: t(b.destination) })),
  };
}

/** A fresh family for someone creating their own (Firebase mode). */
export function emptyFamily(founderName: string, now = Date.now()): FamilyState {
  const founderId = 'm' + now.toString(36);
  return {
    familyName: L(`${founderName}'s family`, `המשפחה של ${founderName}`),
    updatedAt: now,
    adminId: founderId,
    members: [{ id: founderId, name: founderName, color: MEMBER_COLORS[0] }],
    cars: [],
    bookings: [],
  };
}
