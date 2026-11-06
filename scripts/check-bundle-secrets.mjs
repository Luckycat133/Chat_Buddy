import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Require a token boundary and a plausible key body, rather than matching
// ordinary CSS such as mask-origin or documentation placeholders like tvly-....
const PROVIDER_KEY_PATTERN = /(?:^|[^A-Za-z0-9_])(?:sk-(?:or|cp)|tvly-)[A-Za-z0-9_-]{16,}/;

export function containsProviderKey(text) {
  return PROVIDER_KEY_PATTERN.test(text);
}

export async function findProviderKeyFiles(paths) {
  const matches = [];

  async function visit(path) {
    let info;
    try {
      info = await stat(path);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }

    if (info.isDirectory()) {
      for (const entry of (await readdir(path)).sort()) {
        await visit(resolve(path, entry));
      }
    } else if (info.isFile() && containsProviderKey(await readFile(path, 'utf8'))) {
      matches.push(path);
    }
  }

  for (const path of paths) await visit(path);
  return matches;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const paths = process.argv.slice(2);
  const matches = await findProviderKeyFiles(paths.length ? paths : ['dist', 'public', 'assets']);
  if (matches.length) {
    // Never print matching lines: a minified line could expose the entire key.
    for (const path of matches) console.error(`Potential provider key in ${path}`);
    process.exitCode = 1;
  } else {
    console.log('No provider-key-shaped tokens found in bundle paths.');
  }
}
