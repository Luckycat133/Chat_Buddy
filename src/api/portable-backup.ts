import { MAX_PORTABLE_BACKUP_BYTES, PortableBackupReceiptSchema, PortableBackupSchema } from '../../shared/contracts/portable-backup.js';
import { getCloud } from './cloud-adapter.js';

const endpoint = '/v1/account/backup';

export function parsePortableBackup(document: string) {
  if (new TextEncoder().encode(document).length > MAX_PORTABLE_BACKUP_BYTES) throw Error('Backup exceeds 4 MiB');
  return PortableBackupSchema.parse(JSON.parse(document));
}

export async function requestPortableBackup(mode: 'stored' | 'live' | 'import', document?: string) {
  const client = getCloud();
  const token = client.getAccessToken();
  if (!token) throw Error('Sign in to the current account to transfer a backup');
  const response = await client.fetchImpl(client.baseUrl + endpoint + (mode === 'live' ? '/live' : ''), {
    method: mode === 'import' ? 'PUT' : 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(mode === 'import' ? { 'content-type': 'application/json' } : {}),
    },
    ...(mode === 'import' ? { body: JSON.stringify({ document }) } : {}),
    cache: 'no-store',
  });
  if (!response.ok) throw Error(`Account backup request failed (HTTP ${response.status})`);
  return response.text();
}

export async function restorePortableBackup(document: string) {
  parsePortableBackup(document);
  return PortableBackupReceiptSchema.parse(JSON.parse(await requestPortableBackup('import', document)));
}

export async function readPortableBackup(mode: 'stored' | 'live') {
  const document = await requestPortableBackup(mode);
  return { document, data: parsePortableBackup(document) };
}
