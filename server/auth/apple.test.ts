import { beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { createAppleIdentityTokenVerifier } from './apple.js';

const issuer = 'https://appleid.apple.com';
const audience = 'org.example.chatbuddy.fixture';
const nonce = 'synthetic-server-challenge';
const context = { audience, expectedNonce: nonce };
const kid = 'fixture';
const failure = 'Apple identity token verification failed';
let verify: ReturnType<typeof createAppleIdentityTokenVerifier>;
let privateKey: CryptoKey;

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256', { extractable: true });
  privateKey = keyPair.privateKey;
  const publicJwk = await exportJWK(keyPair.publicKey);
  verify = createAppleIdentityTokenVerifier(createLocalJWKSet({
    keys: [{ ...publicJwk, kid, alg: 'RS256' }],
  }));
});

function claims(): JWTPayload {
  const iat = Math.floor(Date.now() / 1000) - 5;
  return { iss: issuer, aud: audience, sub: 'fixture-apple-subject', nonce, iat, exp: iat + 300 };
}

function sign(payload: JWTPayload, key = privateKey): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid }).sign(key);
}

describe('Apple identity assertion', () => {
  it.each([true, 'true', false, 'false'])('verifies RS256 and normalizes email_verified %s', async (verified) => {
    const payload = { ...claims(), email: '', email_verified: verified, internalFixture: 'discarded' };
    const token = await sign(payload);
    expect(await verify(token, context)).toEqual({
      iss: issuer,
      aud: audience,
      sub: payload.sub,
      nonce,
      iat: payload.iat,
      exp: payload.exp,
      email: '',
      email_verified: verified === true || verified === 'true',
    });
  });

  it.each([
    ['issuer', { iss: 'https://invalid.example' }],
    ['audience', { aud: 'org.example.other' }],
    ['array audience', { aud: [audience, 'org.example.other'] }],
    ['missing subject', { sub: undefined }],
    ['blank subject', { sub: '  ' }],
    ['missing nonce', { nonce: undefined }],
    ['different nonce', { nonce: 'another-attempt' }],
    ['missing expiry', { exp: undefined }],
    ['expired', { exp: 1 }],
    ['missing issued time', { iat: undefined }],
    ['future issued time', { iat: 4_000_000_000 }],
    ['invalid email verification claim', { email_verified: 'yes' }],
  ] as const)('rejects %s with a stable error', async (_label, override) => {
    const token = await sign({ ...claims(), ...override } as JWTPayload);
    await expect(verify(token, context)).rejects.toThrow(failure);
  });

  it('rejects an unrelated signing key, a different algorithm, and an empty expected nonce', async () => {
    const unrelated = await generateKeyPair('RS256');
    const otherSignature = await sign(claims(), unrelated.privateKey);
    const otherAlgorithm = await new SignJWT(claims())
      .setProtectedHeader({ alg: 'HS256', kid })
      .sign(new Uint8Array(32).fill(1));
    const token = await sign(claims());
    await expect(verify(otherSignature, context)).rejects.toThrow(failure);
    await expect(verify(otherAlgorithm, context)).rejects.toThrow(failure);
    await expect(verify(token, { ...context, expectedNonce: '' })).rejects.toThrow(failure);
  });
});
