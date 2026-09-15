import { z } from 'zod';
import {
  ActorStatus,
  ActorType,
  PersonaRightsStatus,
} from './enums.js';

const isoDatetime = z.string().datetime();

export const PersonaTemplateSchema = z.object({
  id: z.string().uuid(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/),
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  publicName: z.string().min(1).max(80),
  localizedNames: z.record(z.string().min(2).max(16), z.string().min(1).max(80)),
  nativeWorld: z.string().max(120),
  canonAnchor: z.string().min(1).max(4000),
  identityPrompt: z.string().min(1).max(8000),
  values: z.array(z.string().min(1).max(200)).max(32),
  flaws: z.array(z.string().min(1).max(200)).max(32),
  speakingStyle: z.string().min(1).max(2000),
  routines: z.array(z.string().min(1).max(200)).max(64),
  interests: z.array(z.string().min(1).max(200)).max(64),
  canonicalRelationships: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        role: z.string().min(1).max(80),
        note: z.string().max(400).optional(),
      }),
    )
    .max(64),
  capabilities: z.array(z.string().min(1).max(64)).max(64),
  antiDriftRules: z.array(z.string().min(1).max(400)).max(64),
  examples: z.array(z.string().min(1).max(2000)).max(32),
  rightsStatus: z.nativeEnum(PersonaRightsStatus),
  contentPolicyProfile: z.string().min(1).max(80),
  immutableRevision: z.number().int().min(1),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});
export type PersonaTemplate = z.infer<typeof PersonaTemplateSchema>;

export const ActorSchema = z.object({
  id: z.string().uuid(),
  socialGraphId: z.string().uuid(),
  type: z.nativeEnum(ActorType),
  publicName: z.string().min(1).max(80),
  avatarAssetId: z.string().uuid().nullable(),
  templateId: z.string().uuid().nullable(),
  status: z.nativeEnum(ActorStatus),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});
export type Actor = z.infer<typeof ActorSchema>;

export const CharacterActorSchema = z.object({
  actorId: z.string().uuid(),
  templateId: z.string().uuid(),
  templateRevision: z.number().int().min(1),
  socialGraphId: z.string().uuid(),
  publicState: z.record(z.unknown()),
  nativeWorldState: z.record(z.unknown()),
  availabilityState: z.record(z.unknown()),
  lastSimulatedAt: isoDatetime.nullable(),
  nextSimulationAfter: isoDatetime.nullable(),
});
export type CharacterActor = z.infer<typeof CharacterActorSchema>;

export const SocialGraphSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['active', 'archived']),
  createdAt: isoDatetime,
});
export type SocialGraph = z.infer<typeof SocialGraphSchema>;

export const ActorIdentityLinkSchema = z.object({
  id: z.string().uuid(),
  canonicalActorId: z.string().uuid(),
  linkedActorId: z.string().uuid(),
  templateId: z.string().uuid(),
  createdByEventId: z.string().uuid(),
  activeFrom: isoDatetime,
  status: z.enum(['active', 'inactive']),
  mergePolicyVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
});
export type ActorIdentityLink = z.infer<typeof ActorIdentityLinkSchema>;
