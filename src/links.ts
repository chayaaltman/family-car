import { Platform } from 'react-native';

// Links inside WhatsApp / SMS messages that open the right page in the app:
//   https://family-car-b7389.web.app/?f=ABCD-23&b=<bookingId>   a booking (approve, see who's driving…)
//   https://family-car-b7389.web.app/?f=ABCD-23&p=<requestId>   a pick-up request ("I'll pick you up")
//   https://family-car-b7389.web.app/?f=ABCD-23                 the family (an invite)
// The family code (f) is included so the link also works in a browser that isn't signed in yet,
// e.g. Safari on an iPhone whose home-screen app keeps its own storage: the app opens on
// "Join with a code" with the code filled in, and opens the page after they choose themselves.

const PUBLISHED = 'https://family-car-b7389.web.app';

export type LinkTarget = { kind: 'booking'; id: string } | { kind: 'pickup'; id: string } | { kind: 'family' };

let familyCode: string | undefined;

/** Called when the app connects to a shared family; demo mode has no code, so its messages get no links. */
export function setLinkFamilyCode(code: string | undefined): void {
  familyCode = code;
}

function origin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const o = window.location.origin;
    if (o.startsWith('https://')) return o; // the published site (not localhost while developing)
  }
  return PUBLISHED;
}

/** A link to `target`, or '' in demo mode (there's nothing to open on someone else's phone). */
export function appLink(target: LinkTarget): string {
  if (!familyCode) return '';
  const params = [`f=${encodeURIComponent(familyCode)}`];
  if (target.kind === 'booking') params.push(`b=${encodeURIComponent(target.id)}`);
  if (target.kind === 'pickup') params.push(`p=${encodeURIComponent(target.id)}`);
  return `${origin()}/?${params.join('&')}`;
}

export interface IncomingLink {
  familyCode?: string;
  bookingId?: string;
  pickupId?: string;
}

const KEY = 'familycar:link';
let incoming: IncomingLink | null | undefined;

function save(link: IncomingLink | null) {
  try {
    if (link && (link.familyCode || link.bookingId || link.pickupId)) sessionStorage.setItem(KEY, JSON.stringify(link));
    else sessionStorage.removeItem(KEY);
  } catch {
    // private mode etc.: the link still works for this page load
  }
}

/**
 * What the page was opened with. It's removed from the address bar (so a refresh doesn't reopen it)
 * but kept for this browser tab until used, because the app may reload itself once to update.
 */
export function incomingLink(): IncomingLink | null {
  if (incoming !== undefined) return incoming;
  incoming = null;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return incoming;
  const q = new URLSearchParams(window.location.search);
  const fromUrl: IncomingLink = {
    familyCode: q.get('f')?.toUpperCase() || undefined,
    bookingId: q.get('b') || undefined,
    pickupId: q.get('p') || undefined,
  };
  if (fromUrl.familyCode || fromUrl.bookingId || fromUrl.pickupId) {
    incoming = fromUrl;
    save(fromUrl);
    window.history.replaceState(null, '', window.location.pathname);
  } else {
    try {
      incoming = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    } catch {
      incoming = null;
    }
  }
  return incoming ?? null;
}

/** The booking or pick-up to open, handed out once. */
export function takeLinkTarget(): LinkTarget | null {
  const link = incomingLink();
  if (!link) return null;
  const target: LinkTarget | null = link.bookingId
    ? { kind: 'booking', id: link.bookingId }
    : link.pickupId
      ? { kind: 'pickup', id: link.pickupId }
      : null;
  incoming = { familyCode: link.familyCode };
  save(null);
  return target;
}
