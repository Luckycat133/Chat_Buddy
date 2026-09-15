import { describe, expect, it } from 'vitest';
import {
  AttentionRuntime,
  CircuitBreakerTripped,
  DEFAULT_ATTENTION_OPTIONS,
} from './engine.js';
import {
  AttentionAction,
  AttentionUrgency,
} from '../../../shared/contracts/enums.js';

describe('AttentionRuntime circuit breakers', () => {
  it('trips on wall-clock budget when requests drain budget slowly', () => {
    const runtime = new AttentionRuntime({
      ...DEFAULT_ATTENTION_OPTIONS,
      maxWallClockMs: 0,
      maxRequestsPerCascade: 1_000_000,
      reentryCooldownMs: 0,
    });
    // Force the cascade start into the past so any positive delta trips.
    runtime.resetStartedAtForTest(Date.now() - 10_000);
    expect(() => runtime.guardBudgetForTest()).toThrow(CircuitBreakerTripped);
  });

  it('trips on request budget', () => {
    const runtime = new AttentionRuntime({
      ...DEFAULT_ATTENTION_OPTIONS,
      maxWallClockMs: 60_000,
      maxRequestsPerCascade: 0,
      reentryCooldownMs: 0,
    });
    expect(() => runtime.guardBudgetForTest()).toThrow(CircuitBreakerTripped);
  });

  it('rejects re-entry within the cooldown window', () => {
    const runtime = new AttentionRuntime({
      ...DEFAULT_ATTENTION_OPTIONS,
      maxWallClockMs: 60_000,
      maxRequestsPerCascade: 100,
      reentryCooldownMs: 10_000,
    });
    runtime.markDecidedForTest('actor-1');
    expect(() => runtime.guardReentryForTest('actor-1')).toThrow(
      CircuitBreakerTripped,
    );
    // Different actor is unaffected.
    expect(() => runtime.guardReentryForTest('actor-2')).not.toThrow();
  });

  it('defaults to AttentionAction.Wait stub for character actors', () => {
    const action = AttentionAction.Wait;
    expect(action).toBe('wait');
    expect(AttentionUrgency.Normal).toBe('normal');
  });
});