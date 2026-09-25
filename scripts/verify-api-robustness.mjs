#!/usr/bin/env node
/**
 * Live API robustness verification (C1, C2, H1, H2, H4).
 *
 * Usage:
 *   node scripts/verify-api-robustness.mjs [baseUrl]
 *
 * Requires a freshly migrated database and a running server with
 * NODE_ENV != production so /v1/auth/dev-signin is enabled.
 */
const BASE = process.argv[2] ?? 'http://127.0.0.1:8199';

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`);
}

async function main() {
  // --- sign in -----------------------------------------------------------
  const signin = await fetch(`${BASE}/v1/auth/dev-signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: 'Robustness Bot' }),
  });
  if (signin.status !== 200) {
    throw new Error(`dev-signin failed: ${signin.status} ${await signin.text()}`);
  }
  const { accessToken, actorId } = await signin.json();
  const auth = { authorization: `Bearer ${accessToken}` };

  // --- create a conversation ---------------------------------------------
  const convRes = await fetch(`${BASE}/v1/conversations`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'group', publicName: 'robustness', inviteeActorIds: [actorId] }),
  });
  if (convRes.status !== 201) {
    throw new Error(`conversation create failed: ${convRes.status} ${await convRes.text()}`);
  }
  const conv = await convRes.json();
  const conversationId = conv.id;

  const postJson = (body, extraHeaders = {}) =>
    fetch(`${BASE}/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json', ...extraHeaders },
      body,
    });

  // --- C2a: 10 concurrent posts, SAME idempotency key ---------------------
  {
    const key = `same-key-${Date.now()}`;
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        postJson(JSON.stringify({ clientIdempotencyKey: key, content: 'same key' })),
      ),
    );
    const statuses = responses.map((r) => r.status);
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const ids = bodies.map((b) => b.id);
    const uniqueIds = new Set(ids);
    record(
      'C2a same-key x10 concurrent',
      statuses.every((s) => s === 201) && uniqueIds.size === 1,
      `status=${statuses.join(',')} uniqueIds=${uniqueIds.size} id=${ids[0]}`,
    );
  }

  // --- C2b: 10 concurrent posts, distinct keys ----------------------------
  {
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        postJson(
          JSON.stringify({ clientIdempotencyKey: `race-${Date.now()}-${i}`, content: `msg ${i}` }),
        ),
      ),
    );
    const statuses = responses.map((r) => r.status);
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const seqs = bodies.map((b) => b.sequence);
    const bad = responses.filter((r) => r.status !== 201);
    let badBodies = [];
    if (bad.length) badBodies = await Promise.all(bad.map((r) => r.text()));
    record(
      'C2b distinct-key x10 concurrent',
      statuses.every((s) => s === 201) && new Set(seqs).size === 10,
      `status=${statuses.join(',')} sequences=${seqs.sort((a, b) => a - b).join(',')}${badBodies.length ? ' errors=' + badBodies.join('|') : ''}`,
    );
  }

  // --- C1: /v1/sync five consecutive calls --------------------------------
  {
    const statuses = [];
    let cursor;
    for (let i = 0; i < 5; i++) {
      const url = new URL('/v1/sync', BASE);
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url, { headers: auth });
      const body = await res.json();
      statuses.push(res.status);
      if (i === 0) cursor = body.cursor;
    }
    record('C1 sync x5 consecutive', statuses.every((s) => s === 200), `status=${statuses.join(',')}`);
  }

  // --- H1: malformed JSON --------------------------------------------------
  {
    const res = await postJson('{"clientIdempotencyKey": "abcd1234", "content": ');
    record('H1 malformed JSON', res.status === 400 || res.status === 415, `status=${res.status} body=${await res.text()}`);
  }
  {
    const res = await postJson('', { 'content-type': 'application/json' });
    record('H1 empty body CT=json', res.status === 400 || res.status === 415, `status=${res.status} body=${await res.text()}`);
  }
  {
    // Raw buffer body => fetch sends no content-type header at all.
    const res = await fetch(`${BASE}/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: auth, // no content-type at all
      body: Buffer.from('raw body without content-type'),
    });
    record('H1 missing content-type', res.status === 400 || res.status === 415, `status=${res.status} body=${await res.text()}`);
  }

  // --- H2: NUL byte in content ---------------------------------------------
  {
    const res = await postJson(JSON.stringify({ clientIdempotencyKey: `nul-${Date.now()}`, content: 'bad\u0000content' }));
    record('H2 NUL in content -> 422', res.status === 422, `status=${res.status} body=${await res.text()}`);
  }

  // --- H4: sync query validation -------------------------------------------
  {
    const res = await fetch(`${BASE}/v1/sync?cursor=!!!bad!!!`, { headers: auth });
    record('H4 garbage cursor -> 422', res.status === 422, `status=${res.status}`);
  }
  {
    const res = await fetch(`${BASE}/v1/sync?limit=0`, { headers: auth });
    const res2 = await fetch(`${BASE}/v1/sync?limit=501`, { headers: auth });
    record('H4 limit out of range -> 422', res.status === 422 && res2.status === 422, `limit=0 status=${res.status}, limit=501 status=${res2.status}`);
  }

  // --- summary -------------------------------------------------------------
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('VERIFICATION ERROR:', err.message);
  process.exit(2);
});
