import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

const appleClaimsSchema = z.object({
  sub: z.string().min(1).refine((subject) => subject.trim() === subject),
  email: z.string().optional(),
  email_verified: z.union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
  iss: z.literal(APPLE_ISSUER),
  aud: z.string().min(1),
  nonce: z.string().min(1),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});

export type AppleClaims = z.infer<typeof appleClaimsSchema>;

interface AppleVerificationContext {
  audience: string;
  expectedNonce: string;
}

/** Verify an identity assertion against the server's authentication attempt. */
export function createAppleIdentityTokenVerifier(resolveKey: JWTVerifyGetKey) {
  return async function verify(token: string, context: AppleVerificationContext): Promise<AppleClaims> {
    try {
      const { audience, expectedNonce } = context;
      if (!audience.trim() || !expectedNonce.trim()) throw new Error();
      const { payload } = await jwtVerify(token, resolveKey, {
        issuer: APPLE_ISSUER,
        audience,
        algorithms: ['RS256'],
      });
      const claims = appleClaimsSchema.parse(payload);
      const now = Math.floor(Date.now() / 1000);
      if (claims.nonce !== expectedNonce || claims.iat > now || claims.iat >= claims.exp) {
        throw new Error();
      }
      return claims;
    } catch {
      throw new Error('Apple identity token verification failed');
    }
  };
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
export const verifyAppleIdentityToken = createAppleIdentityTokenVerifier((header, token) => {
  jwks ??= createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  return jwks(header, token);
});
