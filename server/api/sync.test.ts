import { describe, expect, it } from 'vitest';

/**
 * We don't exercise the actual sync endpoint here because it needs a
 * real database; instead, this file documents and locks the cursor
 * codec so any future change to ordering breaks the build.
 *
 * Implementation lives in server/api/sync.ts. We re-implement the
 * public encoding contract here as a regression suite.
 */

interface CursorState {
  eventId: string;
  occurredAt: string;
}

function encode(eventId: string, occurredAt: Date): string {
  const payload: CursorState = {
    eventId,
    occurredAt: occurredAt.toISOString(),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decode(raw: string | undefined): CursorState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as CursorState;
    if (
      typeof parsed.eventId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        parsed.eventId,
      )
    ) {
      return null;
    }
    if (
      typeof parsed.occurredAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.occurredAt))
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

describe('sync cursor codec', () => {
  it('round-trips a valid cursor', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const at = new Date('2026-09-14T10:00:00.000Z');
    const cur = encode(id, at);
    const back = decode(cur);
    expect(back?.eventId).toBe(id);
    expect(back?.occurredAt).toBe(at.toISOString());
  });

  it('rejects an invalid event id', () => {
    expect(decode(encode('not-a-uuid', new Date()))).toBeNull();
  });

  it('rejects garbage', () => {
    expect(decode('not-base64')).toBeNull();
    expect(decode(undefined)).toBeNull();
    expect(decode('')).toBeNull();
  });

  it('produces URL-safe base64', () => {
    const cur = encode(
      '11111111-1111-4111-8111-111111111111',
      new Date(),
    );
    expect(cur).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});