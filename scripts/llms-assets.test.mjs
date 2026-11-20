import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { build } from 'vite';
import projectConfig from '../vite.config.js';

const names = ['llms.txt', 'llms-full.txt'];

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'chat-buddy-llms-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'index.html'), '<!doctype html><title>Fixture</title>');
  return root;
}

async function buildFixture(root) {
  // Select the plugin from the real project config so removing its wiring
  // fails this regression rather than leaving a detached helper test green.
  const plugin = projectConfig({ mode: 'production' }).plugins
    .find(({ name }) => name === 'chat-buddy-llms-assets');
  assert.ok(plugin, 'the production config must publish the LLM references');
  await build({
    configFile: false,
    root,
    base: '/demo/',
    publicDir: false,
    plugins: [plugin],
    logLevel: 'silent',
    build: { outDir: 'site-output' },
  });
}

test('emits only the two public references, byte-for-byte, with stable URLs', async (t) => {
  const root = await fixture(t);
  for (const name of names) await writeFile(join(root, name), `# ${name}\n中文参考\n`);
  for (const name of ['AGENTS.md', 'CLAUDE.md', '.env', 'internal-runbook.md']) {
    await writeFile(join(root, name), 'PRIVATE_FIXTURE_MUST_NOT_BE_PUBLISHED');
  }

  await buildFixture(root);

  assert.deepEqual((await readdir(join(root, 'site-output'))).sort(), ['index.html', ...names].sort());
  for (const name of names) {
    assert.deepEqual(await readFile(join(root, 'site-output', name)), await readFile(join(root, name)));
  }
});

test('rebuild reads the root reference rather than a stale public copy', async (t) => {
  const root = await fixture(t);
  for (const name of names) await writeFile(join(root, name), 'first version\n');
  await buildFixture(root);
  await writeFile(join(root, 'llms-full.txt'), 'updated source\n');

  await buildFixture(root);

  assert.equal(await readFile(join(root, 'site-output', 'llms-full.txt'), 'utf8'), 'updated source\n');
  assert.equal(await readFile(join(root, 'site-output', 'llms.txt'), 'utf8'), 'first version\n');
});

test('build fails rather than silently omitting a missing reference', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'llms.txt'), 'short reference\n');

  await assert.rejects(buildFixture(root), /llms-full\.txt/);
});
