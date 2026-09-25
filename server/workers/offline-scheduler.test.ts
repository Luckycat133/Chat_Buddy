import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOfflineScheduler, type OfflineSchedulerHandle } from './offline-scheduler.js';
import type { LifeTickResult } from './life-scheduler.js';
import type { Database } from '../../db/index.js';

/**
 * Contract tests for the offline scheduler (WEB_IMPLEMENTATION §23
 * "P0 — life"): sparse interval simulation, event-driven triggers that
 * coalesce under bursts, and strictly no publication of its own — the
 * scheduler only relays whatever the life tick reports (including
 * "generated: 0" when nothing meaningful exists).
 */

const db = { fake: true } as unknown as Database;

const IDLE_RESULT: LifeTickResult = {
  considered: 0,
  generated: 0,
  spendCapped: 0,
  rejected: 0,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeHarness(result: LifeTickResult = IDLE_RESULT) {
  const lifeTick = vi.fn(async () => result);
  const scheduler = createOfflineScheduler({
    db,
    lifeTick,
    intervalMs: 600_000, // 10 min
    jitterMs: 600_000,
    minGapMs: 60_000,
  });
  return { scheduler, lifeTick };
}

describe('offline scheduler: sparse interval', () => {
  it('does not tick before start or after stop', async () => {
    const { scheduler, lifeTick } = makeHarness();
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(lifeTick).not.toHaveBeenCalled();

    scheduler.start();
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    const afterStart = lifeTick.mock.calls.length;
    expect(afterStart).toBeGreaterThanOrEqual(1);

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(lifeTick.mock.calls.length).toBe(afterStart);
    expect(scheduler.stats().running).toBe(false);
  });

  it('ticks on the jittered interval and records results', async () => {
    const result: LifeTickResult = {
      considered: 2,
      generated: 1,
      spendCapped: 0,
      rejected: 0,
    };
    const { scheduler, lifeTick } = makeHarness(result);
    scheduler.start();
    await vi.advanceTimersByTimeAsync(30 * 60_000);

    const stats = scheduler.stats();
    expect(stats.running).toBe(true);
    expect(lifeTick.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(stats.tickCount).toBe(lifeTick.mock.calls.length);
    expect(stats.lastLifeResult).toEqual(result);
    // Randomness stays within [interval, interval + jitter].
    expect(lifeTick.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe('offline scheduler: event-driven triggers coalesce', () => {
  it('runs an immediate tick on trigger when the gap has elapsed', async () => {
    const { scheduler, lifeTick } = makeHarness();
    scheduler.start();
    scheduler.trigger('user_reconnect');
    await vi.advanceTimersByTimeAsync(0);
    expect(lifeTick).toHaveBeenCalledTimes(1);
    expect(scheduler.stats().triggerCount).toBe(1);
  });

  it('coalesces a burst of triggers into a single trailing tick', async () => {
    const { scheduler, lifeTick } = makeHarness();
    scheduler.start();
    scheduler.trigger('a');
    await vi.advanceTimersByTimeAsync(0);
    expect(lifeTick).toHaveBeenCalledTimes(1);

    // Burst inside the minimum gap: one trailing tick, not five.
    scheduler.trigger('b');
    scheduler.trigger('c');
    scheduler.trigger('d');
    scheduler.trigger('e');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(lifeTick).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(31_000);
    expect(lifeTick).toHaveBeenCalledTimes(2);
    expect(scheduler.stats().tickCount).toBe(2);
    expect(scheduler.stats().triggerCount).toBe(5);
  });

  it('allows a fresh immediate tick after the minimum gap passes', async () => {
    const { scheduler, lifeTick } = makeHarness();
    scheduler.start();
    scheduler.trigger('first');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(61_000);
    scheduler.trigger('second');
    await vi.advanceTimersByTimeAsync(0);
    expect(lifeTick).toHaveBeenCalledTimes(2);
  });
});

describe('offline scheduler: no forced events and error containment', () => {
  it('relays idle life ticks without publishing anything itself', async () => {
    const { scheduler } = makeHarness({
      considered: 3,
      generated: 0,
      spendCapped: 1,
      rejected: 0,
    });
    scheduler.start();
    scheduler.trigger('quiet_night');
    await vi.advanceTimersByTimeAsync(0);
    const stats = scheduler.stats();
    expect(stats.lastLifeResult).toEqual({
      considered: 3,
      generated: 0,
      spendCapped: 1,
      rejected: 0,
    });
    expect(stats.lastError).toBeNull();
  });

  it('keeps scheduling after a tick throws', async () => {
    const onError = vi.fn();
    const lifeTick = vi.fn(async () => {
      throw new Error('db unavailable');
    });
    const scheduler: OfflineSchedulerHandle = createOfflineScheduler({
      db,
      lifeTick,
      intervalMs: 600_000,
      jitterMs: 0,
      minGapMs: 60_000,
      onError,
    });
    scheduler.start();
    scheduler.trigger('boom');
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(scheduler.stats().lastError).toBe('db unavailable');

    await vi.advanceTimersByTimeAsync(600_000);
    expect(lifeTick.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
