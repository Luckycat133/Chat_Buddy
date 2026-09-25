import { describe, expect, it } from 'vitest';
import {
  inQuietHours,
  nextQuietEnd,
  parseQuietHoursPolicy,
  parseTimeZone,
  shiftOutOfQuietHours,
} from './quiet-hours.js';

/**
 * Pure-function contract for the quiet-hours policy shared by the
 * proactive creation API (§15 "apply quiet hours") and the execution
 * worker (§10 "re-check ... quiet hours").
 */
describe('parseQuietHoursPolicy', () => {
  it('accepts a valid window', () => {
    expect(parseQuietHoursPolicy({ startMinute: 0, endMinute: 420 })).toEqual({
      startMinute: 0,
      endMinute: 420,
    });
  });

  it('treats absent/empty/degenerate as disabled', () => {
    expect(parseQuietHoursPolicy(undefined)).toBeNull();
    expect(parseQuietHoursPolicy(null)).toBeNull();
    expect(parseQuietHoursPolicy({})).toBeNull();
    expect(parseQuietHoursPolicy({ startMinute: 60, endMinute: 60 })).toBeNull();
  });

  it('rejects malformed values', () => {
    expect(parseQuietHoursPolicy('night')).toBeNull();
    expect(parseQuietHoursPolicy([1, 2])).toBeNull();
    expect(parseQuietHoursPolicy({ startMinute: -1, endMinute: 60 })).toBeNull();
    expect(parseQuietHoursPolicy({ startMinute: 0, endMinute: 1441 })).toBeNull();
    expect(
      parseQuietHoursPolicy({ startMinute: 0.5, endMinute: 60 }),
    ).toBeNull();
    expect(
      parseQuietHoursPolicy({ startMinute: '0', endMinute: 60 }),
    ).toBeNull();
  });
});

describe('inQuietHours', () => {
  const morning = { startMinute: 0, endMinute: 420 };
  const nightWrap = { startMinute: 1380, endMinute: 420 }; // 23:00 → 07:00

  it('same-day window boundaries', () => {
    expect(inQuietHours(new Date('2026-09-25T00:00:00Z'), morning)).toBe(true);
    expect(inQuietHours(new Date('2026-09-25T06:59:00Z'), morning)).toBe(true);
    expect(inQuietHours(new Date('2026-09-25T07:00:00Z'), morning)).toBe(false);
    expect(inQuietHours(new Date('2026-09-25T12:00:00Z'), morning)).toBe(false);
  });

  it('wrapping window spans midnight', () => {
    expect(inQuietHours(new Date('2026-09-25T23:30:00Z'), nightWrap)).toBe(true);
    expect(inQuietHours(new Date('2026-09-25T03:00:00Z'), nightWrap)).toBe(true);
    expect(inQuietHours(new Date('2026-09-25T07:00:00Z'), nightWrap)).toBe(false);
    expect(inQuietHours(new Date('2026-09-25T22:59:00Z'), nightWrap)).toBe(false);
  });
});

describe('nextQuietEnd', () => {
  const morning = { startMinute: 0, endMinute: 420 };
  const nightWrap = { startMinute: 1380, endMinute: 420 };

  it('returns the instant when not quiet', () => {
    const t = new Date('2026-09-25T12:00:00Z');
    expect(nextQuietEnd(t, morning)).toBe(t);
  });

  it('ends the same-day window today', () => {
    expect(
      nextQuietEnd(new Date('2026-09-25T01:00:00Z'), morning),
    ).toEqual(new Date('2026-09-25T07:00:00Z'));
  });

  it('ends a window started yesterday (early morning side)', () => {
    expect(
      nextQuietEnd(new Date('2026-09-25T03:00:00Z'), nightWrap),
    ).toEqual(new Date('2026-09-25T07:00:00Z'));
  });

  it('ends a window started today late at night, tomorrow', () => {
    expect(
      nextQuietEnd(new Date('2026-09-25T23:30:00Z'), nightWrap),
    ).toEqual(new Date('2026-09-26T07:00:00Z'));
  });
});

describe('shiftOutOfQuietHours', () => {
  const morning = { startMinute: 0, endMinute: 420 };

  it('keeps a not-before already outside the window', () => {
    const t = new Date('2026-09-25T09:00:00Z');
    expect(shiftOutOfQuietHours(t, morning)).toBe(t);
  });

  it('pushes a not-before out of the window', () => {
    expect(
      shiftOutOfQuietHours(new Date('2026-09-25T01:00:00Z'), morning),
    ).toEqual(new Date('2026-09-25T07:00:00Z'));
  });

  it('returns the input unchanged when disabled', () => {
    const t = new Date('2026-09-25T01:00:00Z');
    expect(shiftOutOfQuietHours(t, null)).toBe(t);
  });
});

describe('user-local timezone basis (timeZone policy field)', () => {
  // 00:00-07:00 in Asia/Shanghai equals 16:00-23:00 UTC (previous day's
  // wall clock carries into the next UTC day) — the quiet window must
  // follow the user's wall clock, not UTC.
  const shanghaiMorning = { startMinute: 0, endMinute: 420, timeZone: 'Asia/Shanghai' };
  const shanghaiNightWrap = { startMinute: 1380, endMinute: 420, timeZone: 'Asia/Shanghai' };

  it('validates IANA zone names', () => {
    expect(parseTimeZone('Asia/Shanghai')).toBe('Asia/Shanghai');
    expect(parseTimeZone('  Europe/Paris  ')).toBe('Europe/Paris');
    expect(parseTimeZone('')).toBeNull();
    expect(parseTimeZone('Mars/Olympus')).toBeNull();
    expect(parseTimeZone(42)).toBeNull();
    expect(parseTimeZone(undefined)).toBeNull();
  });

  it('drops an unsupported zone but keeps the window on the UTC basis', () => {
    // Fail-closed: a bogus zone must not disable the quiet window.
    expect(parseQuietHoursPolicy({ startMinute: 0, endMinute: 420, timeZone: 'Mars/Olympus' }))
      .toEqual({ startMinute: 0, endMinute: 420 });
    expect(parseQuietHoursPolicy({ startMinute: 0, endMinute: 420, timeZone: 'Asia/Shanghai' }))
      .toEqual({ startMinute: 0, endMinute: 420, timeZone: 'Asia/Shanghai' });
  });

  it('evaluates a same-day window against the local wall clock', () => {
    // 15:00Z = 23:00 +08 (previous wall-clock day): outside 00:00-07:00.
    expect(inQuietHours(new Date('2026-09-25T15:00:00Z'), shanghaiMorning)).toBe(false);
    // 16:00Z = 00:00 +08: inside.
    expect(inQuietHours(new Date('2026-09-25T16:00:00Z'), shanghaiMorning)).toBe(true);
    // 22:59Z = 06:59 +08: still inside.
    expect(inQuietHours(new Date('2026-09-25T22:59:00Z'), shanghaiMorning)).toBe(true);
    // 23:00Z = 07:00 +08: window ended.
    expect(inQuietHours(new Date('2026-09-25T23:00:00Z'), shanghaiMorning)).toBe(false);
  });

  it('evaluates a wrapping window against the local wall clock', () => {
    // 15:30Z = 23:30 +08: inside 23:00→07:00 (window started that local day).
    expect(inQuietHours(new Date('2026-09-25T15:30:00Z'), shanghaiNightWrap)).toBe(true);
    // 16:30Z = 00:30 +08 (next local day): inside the yesterday-started window.
    expect(inQuietHours(new Date('2026-09-25T16:30:00Z'), shanghaiNightWrap)).toBe(true);
    // 14:59Z = 22:59 +08: before the window opens.
    expect(inQuietHours(new Date('2026-09-25T14:59:00Z'), shanghaiNightWrap)).toBe(false);
  });

  it('ends a same-day local window at the local end minute', () => {
    // 17:00Z = 01:00 +08 → window ends 07:00 +08 = 23:00Z.
    expect(nextQuietEnd(new Date('2026-09-25T17:00:00Z'), shanghaiMorning))
      .toEqual(new Date('2026-09-25T23:00:00Z'));
  });

  it('ends a wrapping local window on the correct local day', () => {
    // 23:30 +08 (15:30Z) on local 09-25: the window opened 23:00 +08 that
    // same local day and ends 07:00 +08 on local 09-26 = 2026-09-25T23:00Z.
    expect(nextQuietEnd(new Date('2026-09-25T15:30:00Z'), shanghaiNightWrap))
      .toEqual(new Date('2026-09-25T23:00:00Z'));
    // 00:30 +08 (16:30Z) on local 09-26: the window opened the previous
    // local evening and ends the same local morning = 2026-09-25T23:00Z.
    expect(nextQuietEnd(new Date('2026-09-25T16:30:00Z'), shanghaiNightWrap))
      .toEqual(new Date('2026-09-25T23:00:00Z'));
    // Sanity: both instants are 07:00 +08 on their respective local days.
    expect(
      inQuietHours(new Date('2026-09-25T23:00:00Z'), shanghaiNightWrap),
    ).toBe(false);
  });

  it('shifts a not-before out of the local window', () => {
    // 16:30Z = 00:30 +08, inside 00:00-07:00 → shifted to 07:00 +08.
    expect(shiftOutOfQuietHours(new Date('2026-09-25T16:30:00Z'), shanghaiMorning))
      .toEqual(new Date('2026-09-25T23:00:00Z'));
  });

  it('keeps UTC-basis behavior when the zone is absent (backward compatible)', () => {
    const utcMorning = { startMinute: 0, endMinute: 420 };
    expect(inQuietHours(new Date('2026-09-25T01:00:00Z'), utcMorning)).toBe(true);
    expect(inQuietHours(new Date('2026-09-25T15:00:00Z'), utcMorning)).toBe(false);
  });
});
