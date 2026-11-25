import type { FamilyState } from '../../types';
import { appLink, setLinkFamilyCode } from '../../links';
import { pickupRequestMessage, requestMessage } from '../messages';

const fam: FamilyState = {
  familyName: 'Test',
  updatedAt: 0,
  members: [{ id: 'mom', name: 'Mom', color: '#000' }],
  cars: [{ id: 'car1', name: 'Corolla', color: '#333', insuredMemberIds: ['mom'] }],
  bookings: [],
};
const booking = { id: 'b1', carId: 'car1', memberId: 'mom', start: 0, end: 3600000, createdAt: 0 };

describe('links in messages', () => {
  afterEach(() => setLinkFamilyCode(undefined));

  it('adds no link in demo mode', () => {
    expect(appLink({ kind: 'booking', id: 'b1' })).toBe('');
    expect(requestMessage(fam, booking)).not.toContain('http');
  });

  it('links a request to its booking, with the family code', () => {
    setLinkFamilyCode('ABCD-23');
    expect(requestMessage(fam, booking)).toMatch(/\nhttps:\/\/family-car-b7389\.web\.app\/\?f=ABCD-23&b=b1$/);
  });

  it('links a pick-up request to the request', () => {
    setLinkFamilyCode('ABCD-23');
    const r = { id: 'r9', memberId: 'mom', carIds: ['car1'], start: 0, end: 1, place: 'the station', createdAt: 0 };
    expect(pickupRequestMessage(fam, r)).toContain('?f=ABCD-23&p=r9');
  });

  it('an invite link carries just the family code', () => {
    setLinkFamilyCode('ABCD-23');
    expect(appLink({ kind: 'family' })).toBe('https://family-car-b7389.web.app/?f=ABCD-23');
  });
});
