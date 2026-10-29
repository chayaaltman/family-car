import type { FamilyState } from '../types';
import { DAY, HOUR, addDays, startOfDay, withTime } from '../logic/time';

export const MEMBER_COLORS = ['#E8505B', '#2D9CDB', '#27AE60', '#F2994A', '#9B51E0', '#EB5FA5', '#219E9E', '#6D6875'];
export const CAR_COLORS = ['#3D5AFE', '#00A676', '#FF7043', '#8E24AA', '#546E7A', '#FBC02D'];

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
      { id: 'b1', carId: 'corolla', memberId: 'dad', start: at(0, 7, 30), end: at(0, 9, 15), purpose: 'Work', createdAt: now },
      { id: 'b2', carId: 'corolla', memberId: 'noa', start: at(0, 17, 0), end: at(0, 22, 30), purpose: "Friend's birthday", createdAt: now },
      { id: 'b3', carId: 'picanto', memberId: 'maya', start: at(0, 12, 0), end: at(0, 14, 45), purpose: 'Driving lesson practice', createdAt: now },
      { id: 'b4', carId: 'picanto', memberId: 'mom', start: at(1, 8, 0), end: at(1, 16, 0), purpose: 'Work', createdAt: now },
      { id: 'b5', carId: 'corolla', memberId: 'eli', start: at(1, 19, 0), end: at(1, 23, 0), purpose: 'Basketball', createdAt: now },
      { id: 'b6', carId: 'corolla', memberId: 'mom', start: at(2, 10, 0), end: at(2, 12, 30), purpose: 'Grandma', createdAt: now },
      { id: 'b7', carId: 'picanto', memberId: 'noa', start: at(3, 9, 0), end: at(5, 18, 0), purpose: 'Trip up north', createdAt: now },
      { id: 'b8', carId: 'corolla', memberId: 'dad', start: at(4, 7, 30), end: at(4, 18, 0), purpose: 'Work', createdAt: now },
    ],
  };
}

/** A fresh family for someone creating their own (Firebase mode). */
export function emptyFamily(founderName: string, now = Date.now()): FamilyState {
  return {
    familyName: `${founderName}'s family`,
    updatedAt: now,
    members: [{ id: 'm' + now.toString(36), name: founderName, color: MEMBER_COLORS[0] }],
    cars: [],
    bookings: [],
  };
}
