import { MAX_PORTABLE_BACKUP_BYTES, PortableBackupReceiptSchema, PortableBackupSchema, PortableMergePreviewSchema, PortableMergeResultSchema } from '../../shared/contracts/portable-backup.js';
import { boundCloudFetch, loadTokens } from './cloud-adapter.js';

const endpoint = '/v1/account/backup';

export function parsePortableBackup(document: string) {
  if (new TextEncoder().encode(document).length > MAX_PORTABLE_BACKUP_BYTES) throw Error('Backup exceeds 4 MiB');
  return PortableBackupSchema.parse(JSON.parse(document));
}

export async function requestPortableBackup(mode: 'stored' | 'live' | 'import', document?: string) {
  const before = loadTokens();
  const response = await boundCloudFetch(endpoint + (mode === 'live' ? '/live' : ''), {
    method: mode === 'import' ? 'PUT' : 'GET',
    headers: {
      accept: 'application/json',
      ...(mode === 'import' ? { 'content-type': 'application/json' } : {}),
    },
    ...(mode === 'import' ? { body: JSON.stringify({ document }) } : {}),
    cache: 'no-store',
  });
  if (!response.ok) throw Error(`Account backup request failed (HTTP ${response.status})`);
  const body = await response.text();
  const after = loadTokens();
  if (after.accountId !== before.accountId || after.actorId !== before.actorId) throw Error('The signed-in account changed');
  return body;
}

export async function restorePortableBackup(document: string) {
  parsePortableBackup(document);
  const receipt = PortableBackupReceiptSchema.parse(JSON.parse(await requestPortableBackup('import', document)));
  const sha256 = await portableArchiveHash(document);
  if (receipt.sha256 !== sha256) throw Error('The stored backup does not match this file');
  return receipt;
}

export async function readPortableBackup(mode: 'stored' | 'live') {
  const document = await requestPortableBackup(mode);
  return { document, data: parsePortableBackup(document) };
}


export class StaleMergePreviewError extends Error {}

export async function requestPortableMerge(previewToken?: string) {
  const before = loadTokens();
  const response = await boundCloudFetch(endpoint + '/merge/' + (previewToken === undefined ? 'preview' : 'commit'), {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(previewToken === undefined ? {} : { previewToken, confirm: true }), cache: 'no-store',
  });
  if (response.status === 409) throw new StaleMergePreviewError('Archive or online data changed. Preview again.');
  if (!response.ok) throw Error(`Account merge request failed (HTTP ${response.status})`);
  const result: unknown = await response.json();
  const after = loadTokens();
  if (after.accountId !== before.accountId || after.actorId !== before.actorId) throw Error('The signed-in account changed');
  return previewToken === undefined ? PortableMergePreviewSchema.parse(result) : PortableMergeResultSchema.parse(result);
}

export async function portableArchiveHash(document: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(document));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
