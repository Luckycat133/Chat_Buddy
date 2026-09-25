import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/index.js';
import {
  actorIdentityLinks,
  actors,
  characterActors,
  personaTemplates,
} from '../../db/schema.js';
import {
  ActorSchema,
  CharacterActorSchema,
  PersonaTemplateSchema,
} from '../../shared/contracts/index.js';
import { requireAuth } from '../auth/middleware.js';
import { ApiError, ApiErrorCodes } from '../errors.js';

/**
 * Read-only actor endpoints used by the Web cloud cache.
 * These are intentionally minimal in the P0 foundation slice and
 * will grow as P0 social-demo lands.
 */
export function registerActorRoutes(app: FastifyInstance): void {
  app.get(
    '/v1/actors',
    { preHandler: requireAuth },
    async (request) => {
      const db = request.server.db as Database;
      const graphId = request.requestContext.socialGraphId;
      if (!graphId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No social graph bound to actor',
        );
      }
      const rows = await db
        .select({
          id: actors.id,
          type: actors.type,
          publicName: actors.publicName,
          avatarAssetId: actors.avatarAssetId,
          templateId: actors.templateId,
          status: actors.status,
        })
        .from(actors)
        .where(eq(actors.socialGraphId, graphId));

      // Public projection of same-template identity links: the linked
      // duplicate disappears from the list and the canonical actor remains
      // the single public identity (DOMAIN_ARCHITECTURE §4.6).
      const links = await db
        .select({
          canonicalActorId: actorIdentityLinks.canonicalActorId,
          linkedActorId: actorIdentityLinks.linkedActorId,
        })
        .from(actorIdentityLinks)
        .where(eq(actorIdentityLinks.status, 'active'));
      const canonicalOf = new Map(
        links.map((l) => [l.linkedActorId, l.canonicalActorId]),
      );
      const items = rows
        .filter((row) => !canonicalOf.has(row.id))
        .map((row) => ({
          ...row,
          identityLinkedTo: canonicalOf.get(row.id) ?? null,
        }));
      return { items };
    },
  );

  app.get(
    '/v1/actors/:actorId',
    { preHandler: requireAuth },
    async (request) => {
      const params = z
        .object({ actorId: z.string().uuid() })
        .parse(request.params);
      const db = request.server.db as Database;
      const graphId = request.requestContext.socialGraphId;
      if (!graphId) {
        throw new ApiError(
          ApiErrorCodes.Forbidden,
          'No social graph bound to actor',
        );
      }
      const [actor] = await db
        .select()
        .from(actors)
        .where(
          and(eq(actors.id, params.actorId), eq(actors.socialGraphId, graphId)),
        )
        .limit(1);
      if (!actor) {
        throw new ApiError(ApiErrorCodes.NotFound, 'Actor not found');
      }

      let character = null;
      let template = null;
      if (actor.templateId) {
        const [ch] = await db
          .select()
          .from(characterActors)
          .where(eq(characterActors.actorId, actor.id))
          .limit(1);
        const parsedChar = CharacterActorSchema.safeParse(ch ?? null);
        character = parsedChar.success ? parsedChar.data : null;
        const [tpl] = await db
          .select()
          .from(personaTemplates)
          .where(eq(personaTemplates.id, actor.templateId))
          .limit(1);
        const parsedTpl = PersonaTemplateSchema.safeParse(tpl ?? null);
        template = parsedTpl.success ? parsedTpl.data : null;
      }

      const parsedActor = ActorSchema.parse(actor);
      return { actor: parsedActor, character, template };
    },
  );
}
