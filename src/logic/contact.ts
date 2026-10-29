import { Linking, Platform } from 'react-native';

/**
 * Turns a phone number as people type it into the international digits WhatsApp needs.
 * "050-123-4567" → "972501234567". Numbers starting with a single 0 are treated as
 * Israeli (+972); write numbers from other countries with their + code.
 */
export function toInternational(phone: string, defaultCountryCode = '972'): string | null {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return defaultCountryCode + digits.slice(1);
  return digits;
}

/**
 * Links that open WhatsApp with the message typed in, best first. Without a number,
 * WhatsApp asks who to send it to. On phones we try the app directly; the web link
 * is the fallback. (The short wa.me link breaks emoji when it redirects, so we avoid it.)
 */
export function whatsappUrls(text: string, phone?: string): string[] {
  const number = phone ? toInternational(phone) : null;
  const query = `${number ? `phone=${number}&` : ''}text=${encodeURIComponent(text)}`;
  const web = `https://api.whatsapp.com/send?${query}`;
  return Platform.OS === 'web' ? [web] : [`whatsapp://send?${query}`, web];
}

/** Opens the phone's Messages app with the message typed in. iOS and Android use different separators. */
export function smsUrl(text: string, phone?: string): string {
  const number = phone ? phone.replace(/[^\d+]/g, '') : '';
  const sep = Platform.OS === 'ios' ? '&' : '?';
  return `sms:${number}${sep}body=${encodeURIComponent(text)}`;
}

/** Opens the first link that works. */
export async function openFirst(urls: string[]): Promise<boolean> {
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // App not installed or link not supported – try the next one.
    }
  }
  return false;
}
