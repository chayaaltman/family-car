import { toInternational, whatsappUrls } from '../contact';

describe('toInternational', () => {
  it('converts local Israeli numbers', () => {
    expect(toInternational('050-123-4567')).toBe('972501234567');
    expect(toInternational('052 987 6543')).toBe('972529876543');
  });
  it('keeps numbers that already have a country code', () => {
    expect(toInternational('+1 (415) 555-0100')).toBe('14155550100');
    expect(toInternational('00972501234567')).toBe('972501234567');
  });
  it('rejects things that are not phone numbers', () => {
    expect(toInternational('12')).toBeNull();
    expect(toInternational('')).toBeNull();
  });
});

describe('whatsappUrls', () => {
  it('encodes the message (including emoji) and the number', () => {
    const urls = whatsappUrls('Hi 👍 & bye', '050-123-4567');
    const web = urls[urls.length - 1];
    expect(web).toBe('https://api.whatsapp.com/send?phone=972501234567&text=Hi%20%F0%9F%91%8D%20%26%20bye');
  });
  it('leaves the number out when there is none', () => {
    const urls = whatsappUrls('Hi');
    expect(urls[urls.length - 1]).toBe('https://api.whatsapp.com/send?text=Hi');
  });
});
