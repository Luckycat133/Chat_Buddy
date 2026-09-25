import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  actorIdentityLinks,
  actorReports,
  actors,
  contactInvites,
  relationships,
  worldEvents,
} from '../../db/schema.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';
import { newId } from '../../shared/contracts/ids.js';

/**
 * P1 human friend completeness endpoints (WEB_IMPLEMENTATION §23 P1,
 * DEMO_EXPERIENCE §6):
 *   - invite links/codes: create, list, revoke, redeem (single-use,
 *     expiring; redemption creates an accepted human friendship);
 *   - block/unblock: distinct from unfriend — block severs and prevents
 *     re-contact; unfriend only ends the friendship;
 *   - report: moderation-internal record, never a public event;
 *   - same-template identity link resolution for public projections.
 */

const DEFAULT_GRAPH_ID = '00000000-0000-0000-0000-000000000001';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export async function requireHumanActor(
  db: Database,
  actorId: string | null,
): Promise<{ actorId: string; socialGraphId: string }> {
  if (!actorId) {
    throw new ApiError(ApiErrorCodes.Forbidden, 'No actor bound to session');
  }
  const [actor] = await db
    .select()
    .from(actors)
    .where(eq(actors.id, actorId))
    .limit(1);
  if (!actor || actor.type !== 'human') {
    throw new ApiError(ApiErrorCodes.Forbidden, 'Only human actors may do this');
  }
  return { actorId: actor.id, socialGraphId: actor.socialGraphId };
}

/** Canonical actor-pair ordering (DOMAIN_ARCHITECTURE §4.7). */
export function orderedPair(
  a: string,
  b: string,
): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function findRelationship(
  db: Database,
  a: string,
  b: string,
): Promise<{ id: string; state: string } | null> {
  const [x, y] = orderedPair(a, b);
  const [row] = await db
    .select({ id: relationships.id, state: relationships.state })
    .from(relationships)
    .where(
      and(eq(relationships.actorAId, x), eq(relationships.actorBId, y)),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Same-template identity link lookup: returns the canonical actor id for
 * `actorId` when an active link exists, else `actorId` itself. Public
 * projections (shared groups, listings) resolve through this so one
 * public identity is shown (DOMAIN_ARCHITECTURE §4.6).
 */
export async function resolveCanonicalActorId(
  db: Database,
  actorId: string,
): Promise<string> {
  const [link] = await db
    .select({ canonicalActorId: actorIdentityLinks.canonicalActorId })
    .from(actorIdentityLinks)
    .where(
      and(
        eq(actorIdentityLinks.linkedActorId, actorId),
        eq(actorIdentityLinks.status, 'active'),
      ),
    )
    .limit(1);
  return link?.canonicalActorId ?? actorId;
}

/**
 * Create the same-template identity link for two character actors when a
 * shared group contains both. Idempotent; emits one `identity_linked`
 * world event. Private relationships are never copied or merged.
 */
export async function ensureSameTemplateIdentityLink(
  db: Database,
  socialGraphId: string,
  actorAId: string,
  actorBId: string,
): Promise<{ linked: boolean; canonicalActorId: string; linkedActorId: string }> {
  if (actorAId === actorBId) {
    return { linked: false, canonicalActorId: actorAId, linkedActorId: actorBId };
  }
  const rows = await db
    .select({
      id: actors.id,
      templateId: actors.templateId,
      createdAt: actors.createdAt,
    })
    .from(actors)
    .where(inArray(actors.id, [actorAId, actorBId]));
  const a = rows.find((r) => r.id === actorAId);
  const b = rows.find((r) => r.id === actorBId);
  if (!a || !b || !a.templateId || !b.templateId || a.templateId !== b.templateId) {
    return { linked: false, canonicalActorId: actorAId, linkedActorId: actorBId };
  }
  // Deterministic canonical: earliest created actor wins; tie-break by id.
  const [canonical, linked] =
    a.createdAt < b.createdAt || (a.createdAt.getTime() === b.createdAt.getTime() && a.id < b.id)
      ? [a, b]
      : [b, a];

  const [existing] = await db
    .select({ id: actorIdentityLinks.id })
    .from(actorIdentityLinks)
    .where(
      and(
        eq(actorIdentityLinks.canonicalActorId, canonical.id),
        eq(actorIdentityLinks.linkedActorId, linked.id),
        eq(actorIdentityLinks.templateId, a.templateId),
        eq(actorIdentityLinks.status, 'active'),
      ),
    )
    .limit(1);
  if (existing) {
    return { linked: false, canonicalActorId: canonical.id, linkedActorId: linked.id };
  }

  const eventId = newId<string>();
  await db.transaction(async (tx) => {
    await tx.insert(actorIdentityLinks).values({
      id: newId<string>(),
      canonicalActorId: canonical.id,
      linkedActorId: linked.id,
      templateId: a.templateId!,
      createdByEventId: eventId,
      status: 'active',
      mergePolicyVersion: 'demo-v1',
    });
    await tx.insert(worldEvents).values({
      id: eventId,
      socialGraphId,
      type: 'identity_linked',
      actorId: canonical.id,
      subjectActorIds: [canonical.id, linked.id],
      payload: {
        templateId: a.templateId,
        mergePolicyVersion: 'demo-v1',
      },
      visibilityPolicy: { graph: socialGraphId },
      idempotencyKey: `identity_linked:${canonical.id}:${linked.id}`,
    });
  });
  return { linked: true, canonicalActorId: canonical.id, linkedActorId: linked.id };
}

export function registerSocialRoutes(app: FastifyInstance): void {
  /* ------------------------------ invite links ----------------------------- */

  app.post(
    '/v1/invites',
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = request.server.db as Database;
      const ctx = await requireHumanActor(db, request.requestContext.actorId);
      const id = newId<string>();
      const code = generateInviteCode();
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      await db.insert(contactInvites).values({
        id,
        socialGraphId: ctx.socialGraphId,
        code,
        createdByActorId: ctx.actorId,
        status: 'pending',
        expiresAt,
      });
      reply.code(201);
      return { id, code, inviteUrl: `/invite/${code}`, expiresAt: expiresAt.toISOString() };
    },
  );

  app.get('/v1/invites', { preHandler: requireAuth }, async (request) => {
    const db = request.server.db as Database;
    const ctx = await requireHumanActor(db, request.requestContext.actorId);
    const items = await db
      .select()
      .from(contactInvites)
      .where(eq(contactInvites.createdByActorId, ctx.actorId))
      .orderBy(desc(contactInvites.createdAt))
      .limit(50);
    return {
      items: items.map((row) => ({
        ...row,
        expired: row.expiresAt.getTime() < Date.now(),
      })),
    };
  });

  app.delete('/v1/invites/:id', { preHandler: requireAuth }, async (request) => {
    const db = request.server.db as Database;
    const ctx = await requireHumanActor(db, request.requestContext.actorId);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const updated = await db
      .update(contactInvites)
      .set({ status: 'revoked' })
      .where(
        and(
          eq(contactInvites.id, params.id),
          eq(contactInvites.createdByActorId, ctx.actorId),
          eq(contactInvites.status, 'pending'),
        ),
      )
      .returning({ id: contactInvites.id });
    if (updated.length === 0) {
      throw new ApiError(ApiErrorCodes.NotFound, 'Invite not found or not revocable');
    }
    return { ok: true };
  });

  app.post('/v1/invites/redeem', { preHandler: requireAuth }, async (request) => {
    const db = request.server.db as Database;
    const ctx = await requireHumanActor(db, request.requestContext.actorId);
    const body = z.object({ code: z.string().min(4).max(32) }).parse(request.body);

    const [invite] = await db
      .select()
      .from(contactInvites)
      .where(eq(contactInvites.code, body.code.trim().toUpperCase()))
      .limit(1);
    if (!invite) {
      throw new ApiError(ApiErrorCodes.NotFound, 'Invite code not found');
    }
    if (invite.createdByActorId === ctx.actorId) {
      throw new ApiError(
        ApiErrorCodes.ValidationFailed,
        'Cannot redeem your own invite code',
      );
    }
    if (invite.status === 'accepted') {
      if (invite.acceptedByActorId === ctx.actorId) {
        // Idempotent re-redeem by the same human.
        return { relationshipId: invite.relationshipId, idempotent: true };
      }
      throw new ApiError(ApiErrorCodes.Conflict, 'Invite code already used');
    }
    if (invite.status !== 'pending' || invite.expiresAt.getTime() < Date.now()) {
      throw new ApiError(ApiErrorCodes.Conflict, 'Invite code is not redeemable');
    }

    const existing = await findRelationship(
      db,
      invite.createdByActorId,
      ctx.actorId,
    );
    if (existing && existing.state === 'accepted') {
      await db
        .update(contactInvites)
        .set({ status: 'accepted', acceptedByActorId: ctx.actorId, relationshipId: existing.id })
        .where(eq(contactInvites.id, invite.id));
      return { relationshipId: existing.id, idempotent: true };
    }
    if (existing && existing.state === 'blocked') {
      throw new ApiError(ApiErrorCodes.Forbidden, 'Contact is blocked');
    }

    const [actorAId, actorBId] = orderedPair(invite.createdByActorId, ctx.actorId);
    const relationshipId = newId<string>();
    const requestedEventId = newId<string>();
    await db.transaction(async (tx) => {
      await tx.insert(relationships).values({
        id: relationshipId,
        socialGraphId: invite.socialGraphId,
        actorAId,
        actorBId,
        state: 'accepted',
        initiatedBy: invite.createdByActorId,
      });
      await tx.insert(worldEvents).values([
        {
          id: requestedEventId,
          socialGraphId: invite.socialGraphId,
          type: 'friendship_requested',
          actorId: ctx.actorId,
          subjectActorIds: [invite.createdByActorId, ctx.actorId],
          payload: { inviteId: invite.id, via: 'invite_code' },
          visibilityPolicy: {
            participants: [invite.createdByActorId, ctx.actorId],
          },
          idempotencyKey: `friend_requested:invite:${invite.id}`,
        },
        {
          id: newId<string>(),
          socialGraphId: invite.socialGraphId,
          type: 'friendship_accepted',
          actorId: invite.createdByActorId,
          subjectActorIds: [invite.createdByActorId, ctx.actorId],
          payload: { inviteId: invite.id, via: 'invite_code' },
          visibilityPolicy: {
            participants: [invite.createdByActorId, ctx.actorId],
          },
          idempotencyKey: `friend_accepted:invite:${invite.id}`,
        },
      ]);
      await tx
        .update(contactInvites)
        .set({
          status: 'accepted',
          acceptedByActorId: ctx.actorId,
          relationshipId,
        })
        .where(eq(contactInvites.id, invite.id));
    });
    return { relationshipId, idempotent: false };
  });

  /* --------------------------- block / report ------------------------------ */

  app.post('/v1/actors/:actorId/block', { preHandler: requireAuth }, async (request) => {
    const db = request.server.db as Database;
    const ctx = await requireHumanActor(db, request.requestContext.actorId);
    const params = z.object({ actorId: z.string().uuid() }).parse(request.params);
    if (params.actorId === ctx.actorId) {
      throw new ApiError(ApiErrorCodes.ValidationFailed, 'Cannot block yourself');
    }
    const [target] = await db
      .select({ id: actors.id })
      .from(actors)
      .where(eq(actors.id, params.actorId))
      .limit(1);
    if (!target) {
      throw new ApiError(ApiErrorCodes.NotFound, 'Actor not found');
    }
    const [actorAId, actorBId] = orderedPair(ctx.actorId, params.actorId);
    const now = new Date();
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: relationships.id, state: relationships.state })
        .from(relationships)
        .where(
          and(
            eq(relationships.actorAId, actorAId),
            eq(relationships.actorBId, actorBId),
          ),
        )
        .limit(1);
      if (existing) {
        if (existing.state === 'blocked') {
          return;
        }
        await tx
          .update(relationships)
          .set({ state: 'blocked', updatedAt: now })
          .where(eq(relationships.id, existing.id));
      } else {
        await tx.insert(relationships).values({
          id: newId<string>(),
          socialGraphId: ctx.socialGraphId || DEFAULT_GRAPH_ID,
          actorAId,
          actorBId,
          state: 'blocked',
          initiatedBy: ctx.actorId,
        });
      }
      await tx.insert(worldEvents).values({
        id: newId<string>(),
        socialGraphId: ctx.socialGraphId || DEFAULT_GRAPH_ID,
        type: 'actor_blocked',
        actorId: ctx.actorId,
        subjectActorIds: [ctx.actorId, params.actorId],
        payload: { blockedActorId: params.actorId },
        visibilityPolicy: { participants: [ctx.actorId] },
        idempotencyKey: `actor_blocked:${ctx.actorId}:${params.actorId}:${now.getTime()}`,
      });
    });
    return { ok: true, blockedActorId: params.actorId };
  });

  app.delete('/v1/actors/:actorId/block', { preHandler: requireAuth }, async (request) => {
    const db = request.server.db as Database;
    const ctx = await requireHumanActor(db, request.requestContext.actorId);
    const params = z.object({ actorId: z.string().uuid() }).parse(request.params);
    const [actorAId, actorBId] = orderedPair(ctx.actorId, params.actorId);
    const [existing] = await db
      .select({ id: relationships.id, state: relationships.state })
      .from(relationships)
      .where(
        and(
          eq(relationships.actorAId, actorAId),
          eq(relationships.actorBId, actorBId),
        ),
      )
      .limit(1);
    if (!existing || existing.state !== 'blocked') {
      return { ok: true, idempotent: true };
    }
    // Unblock severs the friendship (state deleted); re-request is allowed.
    await db
      .update(relationships)
      .set({ state: 'deleted', updatedAt: new Date() })
      .where(eq(relationships.id, existing.id));
    await db.insert(worldEvents).values({
      id: newId<string>(),
      socialGraphId: ctx.socialGraphId || DEFAULT_GRAPH_ID,
      type: 'relationship_changed',
      actorId: ctx.actorId,
      subjectActorIds: [ctx.actorId, params.actorId],
      payload: { from: 'blocked', to: 'deleted' },
      visibilityPolicy: { participants: [ctx.actorId] },
      idempotencyKey: `actor_unblocked:${ctx.actorId}:${params.actorId}`,
    });
    return { ok: true, idempotent: false };
  });

  app.post('/v1/actors/:actorId/report', { preHandler: requireAuth }, async (request, reply) => {
    const db = request.server.db as Database;
    const ctx = await requireHumanActor(db, request.requestContext.actorId);
    const params = z.object({ actorId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        reason: z.enum(['spam', 'harassment', 'inappropriate', 'other']),
        details: z.string().max(1000).optional(),
      })
      .parse(request.body);
    if (params.actorId === ctx.actorId) {
      throw new ApiError(ApiErrorCodes.ValidationFailed, 'Cannot report yourself');
    }
    const [target] = await db
      .select({ id: actors.id })
      .from(actors)
      .where(eq(actors.id, params.actorId))
      .limit(1);
    if (!target) {
      throw new ApiError(ApiErrorCodes.NotFound, 'Actor not found');
    }
    await db.insert(actorReports).values({
      id: newId<string>(),
      socialGraphId: ctx.socialGraphId || DEFAULT_GRAPH_ID,
      reporterActorId: ctx.actorId,
      reportedActorId: params.actorId,
      reason: body.reason,
      details: body.details ?? null,
    });
    reply.code(201);
    return { ok: true };
  });

  /* ------------------------------- unfriend -------------------------------- */

  app.delete('/v1/actors/:actorId/friend', { preHandler: requireAuth }, async (request) => {
    const db = request.server.db as Database;
    const ctx = await requireHumanActor(db, request.requestContext.actorId);
    const params = z.object({ actorId: z.string().uuid() }).parse(request.params);
    const [actorAId, actorBId] = orderedPair(ctx.actorId, params.actorId);
    const [existing] = await db
      .select({ id: relationships.id, state: relationships.state })
      .from(relationships)
      .where(
        and(
          eq(relationships.actorAId, actorAId),
          eq(relationships.actorBId, actorBId),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new ApiError(ApiErrorCodes.NotFound, 'Friendship not found');
    }
    if (existing.state === 'deleted') {
      return { ok: true, state: 'deleted', idempotent: true };
    }
    if (existing.state === 'blocked') {
      throw new ApiError(
        ApiErrorCodes.ValidationFailed,
        'Unblock before unfriending; blocking is a separate action',
      );
    }
    await db
      .update(relationships)
      .set({ state: 'deleted', updatedAt: new Date() })
      .where(eq(relationships.id, existing.id));
    await db.insert(worldEvents).values({
      id: newId<string>(),
      socialGraphId: ctx.socialGraphId || DEFAULT_GRAPH_ID,
      type: 'friendship_deleted',
      actorId: ctx.actorId,
      subjectActorIds: [ctx.actorId, params.actorId],
      payload: { formerState: existing.state },
      visibilityPolicy: { participants: [ctx.actorId, params.actorId] },
      idempotencyKey: `friendship_deleted:${ctx.actorId}:${params.actorId}:${Date.now()}`,
    });
    return { ok: true, state: 'deleted', idempotent: false };
  });
}
