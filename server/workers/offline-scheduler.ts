/**
 * Offline scheduler per WEB_IMPLEMENTATION §14 / §23 "P0 — life".
 *
 * While the user is offline the character world must keep moving, but
 * sparsely: a jittered interval drives catch-up life ticks, and mutating
 * API activity (user came back, sent a message, posted) can pull the
 * next tick forward. Two hard properties:
 *
 *   - Event-driven + sparse: triggers inside the minimum gap coalesce
 *     into ONE trailing tick, so bursts of activity never cause burst
 *     simulation.
 *   - No forced events: the scheduler never publishes anything itself;
 *     it only invokes the life tick, which publishes nothing when the
 *     candidate generator finds nothing meaningful.
 *
 * Pure orchestration — no SQL here. Deterministic under vitest fake
 * timers (setTimeout/Date are the only externalities).
 */
import type { Database } from '../../db/index.js';
import {
  runLifeTick,
  type LifeCandidateGenerator,
  type LifeTickResult,
} from './life-scheduler.js';

export interface OfflineSchedulerStats {
  running: boolean;
  tickCount: number;
  triggerCount: number;
  lastTickAt: string | null;
  lastLifeResult: LifeTickResult | null;
  lastError: string | null;
}

export interface OfflineSchedulerOptions {
  db: Database;
  /** Base delay between scheduled ticks. Default 10 minutes. */
  intervalMs?: number;
  /** Random extra delay on top of the base interval. Default 10 minutes. */
  jitterMs?: number;
  /** Minimum gap between two ticks; triggers inside the gap coalesce.
   *  Default 60 seconds. */
  minGapMs?: number;
  /** Generator override for tests (defaults to the model gateway). */
  generate?: LifeCandidateGenerator;
  /** Whole-tick override for orchestration tests (defaults to runLifeTick). */
  lifeTick?: (db: Database, now: Date) => Promise<LifeTickResult>;
  onError?: (err: unknown) => void;
}

export interface OfflineSchedulerHandle {
  start(): void;
  stop(): void;
  /** Event-driven trigger (e.g. mutating API call). Coalesced. */
  trigger(reason: string): void;
  stats(): OfflineSchedulerStats;
}

export function createOfflineScheduler(
  options: OfflineSchedulerOptions,
): OfflineSchedulerHandle {
  const intervalMs = options.intervalMs ?? 10 * 60_000;
  const jitterMs = options.jitterMs ?? 10 * 60_000;
  const minGapMs = options.minGapMs ?? 60_000;

  const lifeTick = options.lifeTick ?? runLifeTick;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let trailingTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let ticking = false;
  let tickCount = 0;
  let triggerCount = 0;
  let lastTickAtMs: number | null = null;
  let lastLifeResult: LifeTickResult | null = null;
  let lastError: string | null = null;

  function clearTimers(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (trailingTimer !== null) {
      clearTimeout(trailingTimer);
      trailingTimer = null;
    }
  }

  async function runTick(): Promise<void> {
    if (!running || ticking) return;
    ticking = true;
    lastTickAtMs = Date.now();
    try {
      lastLifeResult = await lifeTick(options.db, new Date());
      tickCount += 1;
      lastError = null;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      options.onError?.(err);
    } finally {
      ticking = false;
    }
  }

  function scheduleNext(): void {
    if (!running) return;
    const delay = intervalMs + Math.random() * jitterMs;
    timer = setTimeout(() => {
      timer = null;
      void runTick().then(scheduleNext);
    }, delay);
  }

  function requestTick(): void {
    if (!running) return;
    const now = Date.now();
    const elapsed =
      lastTickAtMs === null ? Number.POSITIVE_INFINITY : now - lastTickAtMs;
    if (elapsed >= minGapMs && !ticking) {
      if (trailingTimer !== null) {
        clearTimeout(trailingTimer);
        trailingTimer = null;
      }
      void runTick();
      return;
    }
    // Inside the minimum gap (or a tick is in flight): coalesce into a
    // single trailing tick so event bursts never cause burst simulation.
    if (trailingTimer !== null) return;
    const wait = Math.max(1, minGapMs - (Number.isFinite(elapsed) ? elapsed : 0));
    trailingTimer = setTimeout(() => {
      trailingTimer = null;
      void runTick();
    }, wait);
  }

  return {
    start() {
      if (running) return;
      running = true;
      scheduleNext();
    },
    stop() {
      running = false;
      clearTimers();
    },
    trigger(_reason: string) {
      if (!running) return;
      triggerCount += 1;
      requestTick();
    },
    stats(): OfflineSchedulerStats {
      return {
        running,
        tickCount,
        triggerCount,
        lastTickAt:
          lastTickAtMs === null ? null : new Date(lastTickAtMs).toISOString(),
        lastLifeResult,
        lastError,
      };
    },
  };
}
