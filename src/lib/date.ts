export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Local wall-clock time, formatted for an <input type="datetime-local">'s value/default —
// deliberately NOT toISOString(), which converts to UTC and would show the wrong local time
// back in the picker. The backend's LocalDateTime deserializer accepts this shape as-is.
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toISODate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The same wall-clock value as the backend should read it: with this device's UTC offset
// attached ("2026-09-30T08:00:00-05:00"). A bare datetime-local value would be read in the
// server's own zone (Bogotá), which is wrong for anyone whose device is set to another one —
// see the backend's ApiDateTimeConfig for the whole contract.
export function toOffsetDateTimeValue(datetimeLocal: string): string {
  const date = new Date(datetimeLocal);
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  return (
    `${toDatetimeLocalValue(date)}:${pad(date.getSeconds())}` +
    `${sign}${pad(offsetMinutes / 60)}:${pad(offsetMinutes % 60)}`
  );
}

// This device's IANA time zone (e.g. "Europe/Madrid") — sent as `tz` on calendar-day queries
// so "today" means the user's day, not the server's.
export function clientTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Adds N days to a datetime-local or plain date string and returns a plain YYYY-MM-DD date —
// what the backend's `endDate: LocalDate` field expects. Computed from wall-clock parts (not
// milliseconds) so it doesn't drift across a DST transition.
export function addDaysToDateString(isoDateTime: string, days: number): string {
  const date = new Date(isoDateTime);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

// A plain YYYY-MM-DD (no time, no zone) as "12 de octubre de 2026". Parsed as local midnight
// on purpose — new Date('2026-10-12') would be UTC midnight, i.e. the 11th in America.
export function formatDateOnly(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

const UNIT_LABELS: Record<'MINUTES' | 'HOURS' | 'DAYS', [string, string]> = {
  MINUTES: ['minuto', 'minutos'],
  HOURS: ['hora', 'horas'],
  DAYS: ['día', 'días']
};

export function formatFrequency(value: number, unit: 'MINUTES' | 'HOURS' | 'DAYS'): string {
  const [singular, plural] = UNIT_LABELS[unit];
  return `cada ${value} ${value === 1 ? singular : plural}`;
}
