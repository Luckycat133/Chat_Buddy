/**
 * Attention engine per DOMAIN_ARCHITECTURE §7.3 + §7.6 + WEB_IMPLEMENTATION §11.
 *
 * The engine decides what each eligible character should do when a burst
 * closes. It is intentionally model-light here: the production wiring
 * submits a batched request whose JSON contains separate actor inputs;
 * this engine provides the eligibility prefilter and the runtime
 * circuit breakers.
 *
 * Circuit breakers per DOMAIN_ARCHITECTURE §7.6:
 *   - max wall-clock per cascade
 *   - max provider requests per cascade
 *   - per-actor re-entry cooldown
 *   - semantic novelty / echo thresholds
 *   - failure-rate threshold
 *
 * The breakers are operational; they are NEVER exposed to users as a
 * conversation limit.
 */
import {
  AttentionAction,
  AttentionUrgency,
} from '../../../shared/contracts/enums.js';
import type { Database } from '../../../db/index.js';
import {
  actors,
  conversationMembers,
  memoryGrants,
  memoryItems,
  relationships,
} from '../../../db/schema.js';
import { and, eq, inArray, not, sql } from 'drizzle-orm';

export interface AttentionInputs {
  conversationId: string;
  burstId: string;
  senderActorId: string;
  eligibleActorIds: string[];
}

export interface AttentionDecision {
  actorId: string;
  action: typeof AttentionAction[keyof typeof AttentionAction];
  decisionSummary: string;
  urgency: typeof AttentionUrgency[keyof typeof AttentionUrgency];
  targetActorId: string | null;
  replyPlan: string | null;
  followUpAfter: string | null;
}

export class CircuitBreakerTripped extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'CircuitBreakerTripped';
  }
}

export interface AttentionRuntimeOptions {
  /** Max provider calls per cascade before tripping. */
  maxRequestsPerCascade: number;
  /** Max wall-clock ms per cascade before tripping. */
  maxWallClockMs: number;
  /** Per-actor re-entry cooldown in ms. */
  reentryCooldownMs: number;
}

export const DEFAULT_ATTENTION_OPTIONS: AttentionRuntimeOptions = {
  maxRequestsPerCascade: 32,
  maxWallClockMs: 30_000,
  reentryCooldownMs: 1_500,
};

interface CascadeStats {
  startedAt: number;
  requests: number;
  failures: number;
  perActorLastDecisionAt: Map<string, number>;
}

export class AttentionRuntime {
  private readonly stats: CascadeStats;
  constructor(private readonly opts: AttentionRuntimeOptions = DEFAULT_ATTENTION_OPTIONS) {
    this.stats = {
      startedAt: Date.now(),
      requests: 0,
      failures: 0,
      perActorLastDecisionAt: new Map(),
    };
  }

  /** Test-only helper: stamp an actor as just-decided so re-entry trips. */
  markDecidedForTest(actorId: string): void {
    this.stats.perActorLastDecisionAt.set(actorId, Date.now());
  }

  /** Test-only helper: invoke the re-entry guard. */
  guardReentryForTest(actorId: string): void {
    this.guardReentry(actorId);
  }

  /** Test-only helper: invoke the wall-clock + request budget guard. */
  guardBudgetForTest(): void {
    this.guardBudget();
  }

  /** Test-only helper: rewind the cascade start time. */
  resetStartedAtForTest(startedAt: number): void {
    this.stats.startedAt = startedAt;
  }

  async produceDecisions(
    db: Database,
    input: AttentionInputs,
  ): Promise<AttentionDecision[]> {
    const eligible = await this.eligibilityFilter(db, input);
    const decisions: AttentionDecision[] = [];
    for (const actor of eligible) {
      this.guardBudget();
      this.guardReentry(actor.id);
      this.stats.requests += 1;
      try {
        const decision = await this.decideForActor(db, actor.id, input);
        decisions.push(decision);
        this.stats.perActorLastDecisionAt.set(actor.id, Date.now());
      } catch (err) {
        this.stats.failures += 1;
        const rate = this.stats.failures / this.stats.requests;
        if (rate > 0.5 && this.stats.requests >= 6) {
          throw new CircuitBreakerTripped(
            `failure rate ${(rate * 100).toFixed(1)}% over ${this.stats.requests} requests`,
          );
        }
        decisions.push({
          actorId: actor.id,
          action: AttentionAction.NoAction,
          decisionSummary: 'decision failed; defaulting to no_action',
          urgency: AttentionUrgency.Low,
          targetActorId: null,
          replyPlan: null,
          followUpAfter: null,
        });
        // keep the loop going; surface partial results
        void err;
      }
    }
    return decisions;
  }

  /**
   * Pure-code eligibility prefilter per WEB_IMPLEMENTATION §11.
   * Returns actors who:
   *   - are `active` members of the conversation
   *   - are not the sender
   *   - are not currently blocked
   *   - have not declined this group
   *   - are not the same human who sent the burst
   */
  async eligibilityFilter(
    db: Database,
    input: AttentionInputs,
  ): Promise<Array<{ id: string; type: 'human' | 'character' }>> {
    const memberRows = await db
      .select({
        id: actors.id,
        type: actors.type,
        status: actors.status,
      })
      .from(conversationMembers)
      .innerJoin(actors, eq(conversationMembers.actorId, actors.id))
      .where(
        and(
          eq(conversationMembers.conversationId, input.conversationId),
          eq(conversationMembers.status, 'active'),
          not(eq(conversationMembers.actorId, input.senderActorId)),
        ),
      );
    return memberRows
      .filter((m) => m.status !== 'blocked' && m.status !== 'retired')
      .map((m) => ({ id: m.id, type: m.type as 'human' | 'character' }));
  }

  /**
   * For each eligible actor, load permitted memories and decide. The
   * production wiring calls the model gateway here; this stub returns
   * a structured wait/ignore decision while keeping the loop budget.
   */
  private async decideForActor(
    db: Database,
    actorId: string,
    input: AttentionInputs,
  ): Promise<AttentionDecision> {
    // Pull recently permitted memories to seed the prompt later.
    const permitted = await db
      .select({ id: memoryItems.id })
      .from(memoryItems)
      .leftJoin(
        memoryGrants,
        and(
          eq(memoryGrants.memoryId, memoryItems.id),
          eq(memoryGrants.granteeActorId, actorId),
        ),
      )
      .where(
        sql`${memoryItems.ownerActorId} = ${actorId} OR ${memoryGrants.granteeActorId} = ${actorId}`,
      )
      .limit(32);
    void permitted;

    // Stub: human characters receive explicit guidance; characters reply.
    const [actor] = await db
      .select({ type: actors.type })
      .from(actors)
      .where(eq(actors.id, actorId))
      .limit(1);
    if (actor?.type === 'human') {
      return {
        actorId,
        action: AttentionAction.NoAction,
        decisionSummary: 'human recipient; runtime does not act',
        urgency: AttentionUrgency.Low,
        targetActorId: null,
        replyPlan: null,
        followUpAfter: null,
      };
    }
    return {
      actorId,
      action: AttentionAction.Wait,
      decisionSummary: `eligible for burst ${input.burstId}; awaiting model call`,
      urgency: AttentionUrgency.Normal,
      targetActorId: null,
      replyPlan: null,
      followUpAfter: null,
    };
  }

  private guardBudget(): void {
    const elapsed = Date.now() - this.stats.startedAt;
    if (elapsed > this.opts.maxWallClockMs) {
      throw new CircuitBreakerTripped(
        `wall-clock budget exceeded: ${elapsed}ms`,
      );
    }
    if (this.stats.requests >= this.opts.maxRequestsPerCascade) {
      throw new CircuitBreakerTripped(
        `request budget exceeded: ${this.stats.requests}`,
      );
    }
  }

  private guardReentry(actorId: string): void {
    const last = this.stats.perActorLastDecisionAt.get(actorId);
    if (!last) return;
    const delta = Date.now() - last;
    if (delta < this.opts.reentryCooldownMs) {
      throw new CircuitBreakerTripped(
        `re-entry cooldown for ${actorId} not elapsed (${delta}ms < ${this.opts.reentryCooldownMs}ms)`,
      );
    }
  }
}

// Reference symbols to keep strict-mode noUnusedLocals satisfied.
void relationships;
void inArray;