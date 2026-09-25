/**
 * Quiet-hours policy helpers per WEB_IMPLEMENTATION §15 ("apply quiet
 * hours") and DOMAIN_ARCHITECTURE §10 ("re-check ... quiet hours").
 *
 * Policy shape (stored in `proactive_intents.quiet_hours_policy` jsonb):
 *   { startMinute: 0..1440, endMinute: 0..1440, timeZone?: string }
 * Minutes are since local midnight in `timeZone` when provided (IANA
 * name, e.g. 'Asia/Shanghai' — the user's local timezone); absent or
 * invalid zones fall back to the historical UTC basis so a malformed
 * zone can never silently disable a configured quiet window. An empty
 * object or a window where start === end means "no quiet hours".
 *
 * Pure functions only — no DB, no clock reads — so the scheduler and the
 * API creation path share one deterministic implementation.
 */

export interface QuietHoursPolicy {
  startMinute: number;
  endMinute: number;
  /**
   * Optional IANA timezone for the user-local basis. Absent or invalid
   * values fall back to UTC (fail-closed: the window still applies).
   */
  timeZone?: string;
}

const DAY_MS = 86_400_000;

/** Cached Intl formatters; zone → formatter (validated at creation). */
const zoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Returns a formatter for the IANA zone, or null when the zone is not
 * supported by the runtime ICU database.
 */
function zoneFormatter(timeZone: string): Intl.DateTimeFormat | null {
  const cached = zoneFormatterCache.get(timeZone);
  if (cached) return cached;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    zoneFormatterCache.set(timeZone, formatter);
    return formatter;
  } catch {
    return null;
  }
}

/**
 * Validate an IANA timezone name. Returns the trimmed name, or null when
 * absent/empty/unsupported (callers then fall back to the UTC basis).
 */
export function parseTimeZone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return zoneFormatter(trimmed) ? trimmed : null;
}

interface ZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zoneParts(t: Date, timeZone: string): ZoneParts {
  const formatter = zoneFormatter(timeZone)!;
  const parts = formatter.formatToParts(t);
  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number.parseInt(part.value, 10) : 0;
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Offset (ms) that must be added to a UTC-based wall-clock reading in
 * `timeZone` to obtain the real instant. Two-pass handles DST edges.
 */
function zoneOffsetMs(t: Date, timeZone: string): number {
  const p = zoneParts(t, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - t.getTime();
}

/**
 * Parse an unknown policy value. Returns null when absent/empty/invalid,
 * meaning "no quiet hours apply". A valid window with an unsupported
 * timeZone keeps the window on the UTC basis (the zone is dropped, the
 * protection is not).
 */
export function parseQuietHoursPolicy(raw: unknown): QuietHoursPolicy | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const start = rec.startMinute;
  const end = rec.endMinute;
  const isMinute = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1440;
  if (!isMinute(start) || !isMinute(end)) return null;
  if (start === end) return null; // degenerate window = disabled
  const timeZone = parseTimeZone(rec.timeZone) ?? undefined;
  return timeZone ? { startMinute: start, endMinute: end, timeZone } : { startMinute: start, endMinute: end };
}

function minutesOfDay(t: Date, timeZone?: string): number {
  if (!timeZone) return t.getUTCHours() * 60 + t.getUTCMinutes();
  const p = zoneParts(t, timeZone);
  return p.hour * 60 + p.minute;
}

function startOfUtcDay(t: Date): number {
  return Date.UTC(
    t.getUTCFullYear(),
    t.getUTCMonth(),
    t.getUTCDate(),
    0,
    0,
    0,
    0,
  );
}

/** Epoch ms of local midnight in `timeZone` for the day containing `t`. */
function startOfZonedDay(t: Date, timeZone: string): number {
  const p = zoneParts(t, timeZone);
  const wallMidnightUtc = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0, 0);
  // Two-pass correction for DST edges: recompute from the original wall
  // clock each pass (never cumulative) until the offset reading is stable.
  let candidate = wallMidnightUtc;
  for (let i = 0; i < 2; i += 1) {
    candidate = wallMidnightUtc - zoneOffsetMs(new Date(candidate), timeZone);
  }
  return candidate;
}

/** True when `t` falls inside the quiet window (user-local basis). */
export function inQuietHours(t: Date, policy: QuietHoursPolicy): boolean {
  const m = minutesOfDay(t, policy.timeZone);
  if (policy.startMinute < policy.endMinute) {
    return m >= policy.startMinute && m < policy.endMinute;
  }
  // Wrapping window (e.g. 23:00 -> 07:00).
  return m >= policy.startMinute || m < policy.endMinute;
}

/**
 * The instant the quiet window containing `t` ends. Returns `t` itself
 * when `t` is not inside a quiet window.
 */
export function nextQuietEnd(t: Date, policy: QuietHoursPolicy): Date {
  if (!inQuietHours(t, policy)) return t;
  const m = minutesOfDay(t, policy.timeZone);
  const dayStart = policy.timeZone
    ? startOfZonedDay(t, policy.timeZone)
    : startOfUtcDay(t);
  const todayEnd = new Date(dayStart + policy.endMinute * 60_000);
  if (policy.startMinute < policy.endMinute) {
    // Same-day window: it necessarily ends today.
    return todayEnd;
  }
  // Wrapping window.
  if (m >= policy.startMinute) {
    // Window started today, ends tomorrow.
    return new Date(dayStart + DAY_MS + policy.endMinute * 60_000);
  }
  // Window started yesterday, ends today.
  return todayEnd;
}

/**
 * Push `notBefore` forward until it is outside the quiet window.
 * Bounded iterations guard against pathological policies.
 */
export function shiftOutOfQuietHours(
  notBefore: Date,
  policy: QuietHoursPolicy | null,
): Date {
  if (!policy) return notBefore;
  let current = notBefore;
  for (let i = 0; i < 3; i += 1) {
    if (!inQuietHours(current, policy)) return current;
    current = nextQuietEnd(current, policy);
  }
  return current;
}
