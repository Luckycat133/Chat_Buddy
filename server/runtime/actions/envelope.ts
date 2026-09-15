/**
 * Action envelope parser per DOMAIN_ARCHITECTURE §7.5.
 *
 * A model response may propose:
 *   - messages (with target)
 *   - memory_patches
 *   - relationship_patch
 *   - world_events
 *   - proactive_intents
 *   - tool_requests
 *   - social_actions
 *
 * The runtime validates actor IDs, recipients, and tools before persistence.
 * Models cannot supply authoritative IDs outside the permitted set.
 */
import { z } from 'zod';
import {
  AttentionAction,
  AttentionUrgency,
  MemoryConfidence,
  MemoryType,
} from '../../../shared/contracts/enums.js';

export const ActionEnvelopeSchema = z.object({
  messages: z
    .array(
      z.object({
        target: z.enum(['current_conversation', 'private_chat']),
        text: z.string().min(1).max(32_000),
        replyToMessageId: z.string().uuid().optional(),
      }),
    )
    .max(8),
  memory_patches: z
    .array(
      z.object({
        type: z.nativeEnum(MemoryType),
        objectiveFact: z.string().min(1).max(4000),
        subjectiveInterpretation: z.string().max(4000),
        confidence: z.nativeEnum(MemoryConfidence),
        sharePolicy: z.record(z.unknown()).optional(),
        visibilityPolicy: z.record(z.unknown()).optional(),
      }),
    )
    .max(16),
  relationship_patch: z
    .object({
      currentDynamic: z.string().max(4000),
      meaningfulHistory: z.array(z.string().max(800)).max(64).optional(),
      tensions: z.array(z.string().max(400)).max(32).optional(),
      openThreads: z.array(z.string().max(400)).max(32).optional(),
    })
    .nullable(),
  world_events: z
    .array(
      z.object({
        type: z.string().min(1).max(64),
        subjectActorIds: z.array(z.string().uuid()).max(64),
        payload: z.record(z.unknown()).optional(),
      }),
    )
    .max(16),
  proactive_intents: z
    .array(
      z.object({
        targetActorId: z.string().uuid(),
        reason: z.string().min(1).max(800),
        desiredEffect: z.string().max(800),
        notBefore: z.string().datetime(),
        expiresAt: z.string().datetime(),
        dedupeKey: z.string().min(8).max(128),
      }),
    )
    .max(8),
  tool_requests: z
    .array(
      z.object({
        toolName: z.string().min(1).max(64),
        arguments: z.record(z.unknown()),
        requiresConfirmation: z.boolean().default(true),
      }),
    )
    .max(8),
  social_actions: z
    .array(
      z.object({
        action: z.nativeEnum(AttentionAction),
        targetActorId: z.string().uuid().nullable(),
        urgency: z.nativeEnum(AttentionUrgency),
        decisionSummary: z.string().max(400),
      }),
    )
    .max(8),
});

export type ActionEnvelope = z.infer<typeof ActionEnvelopeSchema>;

/**
 * Validation result. The runtime MUST call this before persisting any
 * action. Decisions returned here are server-authoritative, not
 * model-authoritative.
 */
export interface ValidationIssue {
  path: string;
  message: string;
}

export function validateActionEnvelope(
  candidate: unknown,
  permittedActorIds: ReadonlySet<string>,
): { ok: true; envelope: ActionEnvelope } | { ok: false; issues: ValidationIssue[] } {
  const parsed = ActionEnvelopeSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  const issues: ValidationIssue[] = [];
  for (const intent of parsed.data.proactive_intents) {
    if (!permittedActorIds.has(intent.targetActorId)) {
      issues.push({
        path: `proactive_intents.targetActorId`,
        message: `target actor ${intent.targetActorId} not permitted`,
      });
    }
  }
  for (const ev of parsed.data.world_events) {
    for (const subj of ev.subjectActorIds) {
      if (!permittedActorIds.has(subj)) {
        issues.push({
          path: 'world_events.subjectActorIds',
          message: `subject ${subj} not permitted`,
        });
      }
    }
  }
  for (const social of parsed.data.social_actions) {
    if (social.targetActorId && !permittedActorIds.has(social.targetActorId)) {
      issues.push({
        path: 'social_actions.targetActorId',
        message: `target actor ${social.targetActorId} not permitted`,
      });
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, envelope: parsed.data };
}