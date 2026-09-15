/**
 * Sign-in-with-Apple token verification per WEB_IMPLEMENTATION §4.3.
 *
 * The Apple JWT is verified against the public key published at
 * https://appleid.apple.com/auth/keys. For demo we accept a stub token
 * (subject only) and let the dev-signin path create an account. The
 * production path wires `jose` to verify the RS256 signature against
 * Apple's JWKS.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AppleClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  iss: 'https://appleid.apple.com';
  aud: string;
  iat: number;
  exp: number;
}

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  }
  return jwks;
}

export async function verifyAppleIdentityToken(
  token: string,
  audience: string,
): Promise<AppleClaims> {
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: APPLE_ISSUER,
      audience,
      algorithms: ['RS256'],
    });
    return payload as unknown as AppleClaims;
  } catch (err) {
    throw new Error(
      `Apple token verification failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}