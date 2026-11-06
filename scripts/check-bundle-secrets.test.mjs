import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { containsProviderKey, findProviderKeyFiles } from './check-bundle-secrets.mjs';

test('rejects provider-key-shaped tokens in minified JavaScript and JSON', () => {
  for (const prefix of ['sk-or-v1-', 'sk-cp-', 'tvly-']) {
    const fakeKey = prefix + 'a1B2c3D4'.repeat(4);
    assert.equal(containsProviderKey(`const key="${fakeKey}";`), true);
    assert.equal(containsProviderKey(JSON.stringify({ key: fakeKey })), true);
  }
});

test('ignores CSS properties and non-key placeholders', () => {
  for (const text of ['-webkit-mask-origin:content-box', 'mask-origin:border-box',
    'Add VITE_TAVILY_API_KEY=tvly-... to your .env file.', 'tvly-xxxx', 'sk-or-v1-...']) {
    assert.equal(containsProviderKey(text), false, text);
  }
});

test('scans nested output, skips absent optional roots, and does not print keys', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chat-buddy-bundle-scan-'));
  try {
    const nested = join(root, 'js');
    await mkdir(nested);
    const file = join(nested, 'bundle.js');
    const fakeKey = 'tvly-' + 'testonly'.repeat(4);
    await writeFile(file, `const key="${fakeKey}";`);
    assert.deepEqual(await findProviderKeyFiles([root, join(root, 'missing')]), [file]);
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL('./check-bundle-secrets.mjs', import.meta.url)), root,
    ], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Potential provider key/);
    assert.equal((result.stdout + result.stderr).includes(fakeKey), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
