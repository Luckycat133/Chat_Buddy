import { z } from 'zod';
import { AccountStatus } from './enums.js';

export const AccountSchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(AccountStatus),
  primaryEmail: z.string().email().nullable(),
  appleSubject: z.string().nullable(),
  displayName: z.string().min(1).max(80),
  locale: z.string().min(2).max(16),
  timezone: z.string().min(1).max(64),
  createdAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Account = z.infer<typeof AccountSchema>;

/** Public Account projection: never expose appleSubject / deletedAt over the wire. */
export const PublicAccountSchema = AccountSchema.pick({
  id: true,
  status: true,
  primaryEmail: true,
  displayName: true,
  locale: true,
  timezone: true,
  createdAt: true,
});
export type PublicAccount = z.infer<typeof PublicAccountSchema>;
