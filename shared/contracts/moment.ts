import { z } from 'zod';

const isoDatetime = z.string().datetime();

export const MomentAudiencePolicySchema = z.object({
  /** Actor ids or template slugs allowed to view; empty means audience=public-within-graph. */
  allowedActorIds: z.array(z.string().uuid()).max(64),
  /** Visibility class: 'public-within-graph' | 'familiar' | 'restricted'. */
  class: z.enum(['public_within_graph', 'familiar', 'restricted']),
});
export type MomentAudiencePolicy = z.infer<typeof MomentAudiencePolicySchema>;

export const MomentSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid(),
  socialGraphId: z.string().uuid(),
  content: z.string().min(1).max(8000),
  mediaAssets: z
    .array(
      z.object({
        assetId: z.string().uuid(),
        altText: z.string().max(280).nullable(),
      }),
    )
    .max(8),
  audiencePolicy: MomentAudiencePolicySchema,
  sourceEventId: z.string().uuid().nullable(),
  createdAt: isoDatetime,
  deletedAt: isoDatetime.nullable(),
});
export type Moment = z.infer<typeof MomentSchema>;

export const MomentInteractionSchema = z.object({
  id: z.string().uuid(),
  momentId: z.string().uuid(),
  actorId: z.string().uuid(),
  type: z.enum(['view', 'reaction', 'comment', 'reply']),
  content: z.string().max(2000).nullable(),
  parentInteractionId: z.string().uuid().nullable(),
  createdAt: isoDatetime,
});
export type MomentInteraction = z.infer<typeof MomentInteractionSchema>;
