import { z } from 'zod';
import {
  ProactiveStatus,
  ToolExecutionStatus,
} from './enums.js';

const isoDatetime = z.string().datetime();

export const ProactiveIntentSchema = z.object({
  id: z.string().uuid(),
  sourceActorId: z.string().uuid(),
  targetActorId: z.string().uuid(),
  sourceEventId: z.string().uuid(),
  reason: z.string().min(1).max(800),
  privateContext: z.record(z.unknown()),
  desiredEffect: z.string().max(800),
  notBefore: isoDatetime,
  expiresAt: isoDatetime,
  priority: z.number().int().min(0).max(100),
  status: z.nativeEnum(ProactiveStatus),
  quietHoursPolicy: z.record(z.unknown()),
  dedupeKey: z.string().min(8).max(128),
});
export type ProactiveIntent = z.infer<typeof ProactiveIntentSchema>;

export const ToolExecutionSchema = z.object({
  id: z.string().uuid(),
  requestingActorId: z.string().uuid(),
  targetHumanActorId: z.string().uuid().nullable(),
  conversationId: z.string().uuid(),
  toolName: z.string().min(1).max(64),
  arguments: z.record(z.unknown()),
  permissionState: z.nativeEnum(ToolExecutionStatus),
  result: z.record(z.unknown()).nullable(),
  sourceMetadata: z.record(z.unknown()),
  requestedAt: isoDatetime,
  completedAt: isoDatetime.nullable(),
});
export type ToolExecution = z.infer<typeof ToolExecutionSchema>;

export const DeviceSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  platform: z.enum(['ios', 'android', 'web', 'macos', 'windows', 'linux']),
  pushTokenEncrypted: z.string().nullable(),
  appVersion: z.string().min(1).max(32),
  lastSeenAt: isoDatetime,
  notificationPermission: z.enum(['granted', 'denied', 'not_determined']),
});
export type Device = z.infer<typeof DeviceSchema>;
