// Small, dependency-free date helpers. Everything works in the device's local time zone.

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(24, 0, 0, 0); // midnight that starts the next day
  return d.getTime();
}

export function addDays(t: number, days: number): number {
  // setDate keeps the wall-clock time stable across daylight-saving changes.
  const d = new Date(t);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function addMonths(t: number, months: number): number {
  const d = new Date(t);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** Replace the time of day of `t`, keeping its date. */
export function withTime(t: number, hours: number, minutes: number): number {
  const d = new Date(t);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

/** Replace the date of `t`, keeping its time of day. */
export function withDate(t: number, day: number): number {
  const src = new Date(t);
  const d = new Date(day);
  d.setHours(src.getHours(), src.getMinutes(), 0, 0);
  return d.getTime();
}

/** Round up to the next multiple of `step` minutes. */
export function roundUpToMinutes(t: number, step: number): number {
  const ms = step * MINUTE;
  return Math.ceil(t / ms) * ms;
}

/** 6x7 grid of day timestamps for a month calendar, starting on Sunday. */
export function monthGrid(monthAnchor: number): number[] {
  const first = new Date(monthAnchor);
  first.setDate(1);
  first.setHours(0, 0, 0, 0);
  const gridStart = addDays(first.getTime(), -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function formatTime(t: number): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(t: number): string {
  const d = new Date(t);
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function formatDayLabel(t: number, now = Date.now()): string {
  if (isSameDay(t, now)) return 'Today';
  if (isSameDay(t, addDays(now, 1))) return 'Tomorrow';
  if (isSameDay(t, addDays(now, -1))) return 'Yesterday';
  return formatDate(t);
}

export function formatRange(start: number, end: number, now = Date.now()): string {
  if (isSameDay(start, end) || end === endOfDay(start)) {
    return `${formatDayLabel(start, now)} · ${formatTime(start)}–${formatTime(end)}`;
  }
  return `${formatDayLabel(start, now)} ${formatTime(start)} → ${formatDayLabel(end, now)} ${formatTime(end)}`;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / MINUTE);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(' ');
}
