import {
  processUploadIntent,
  scanVerifiedUpload,
  type UploadDependencies,
  type AttachmentScanner,
} from '@hyperbug/application';
export type BrowserUploadQuery = (
  sql: string,
  values?: (string | number)[],
) => Promise<Record<string, unknown>[]>;
/** Internal disposable fixture driver only; actual byte/scan/release helpers and store guards remain active. */
export async function browserUploadAction(
  deps: UploadDependencies,
  query: BrowserUploadQuery,
  scanner: AttachmentScanner | null,
  id: string,
  operation: string,
) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid fixture upload');
  const rows = await query(
    'SELECT project_id, principal_id FROM upload_intents WHERE id=?',
    [id],
  );
  if (!rows[0]) throw new Error('Missing fixture upload');
  const scope = {
    id,
    projectId: String(rows[0].project_id),
    principalId: String(rows[0].principal_id),
  };
  const authorize = async () => {
    const active = await query(
      'SELECT p.status AS principal_status, x.status AS project_status, x.visibility FROM principals p JOIN projects x ON x.id=? WHERE p.id=?',
      [scope.projectId, scope.principalId],
    );
    if (
      active[0]?.principal_status !== 'active' ||
      active[0]?.project_status !== 'active' ||
      active[0]?.visibility !== 'public'
    )
      throw new Error('Fixture background authorization denied');
  };
  const lease = () => ({
    ...scope,
    leaseId: crypto.randomUUID(),
    now: Date.now(),
    leaseExpiresAt: Date.now() + 60000,
  });
  if (operation === 'process')
    return processUploadIntent(deps, authorize, lease());
  if (operation === 'scan')
    return scanVerifiedUpload(
      { ...deps, scanner: scanner ?? null },
      authorize,
      lease(),
    );
  if (operation === 'expire') {
    await query(
      "UPDATE upload_intents SET created_at=?, expires_at=? WHERE id=? AND state IN ('pending','uploaded')",
      [Date.now() - 901000, Date.now() - 1000, id],
    );
    return null;
  }
  if (operation === 'quota') {
    const before = await deps.intents.get(scope);
    if (!before) throw new Error('Missing quota fixture scope');
    for (let count = 0; count < 16; count++) {
      const suffix = crypto.randomUUID().replaceAll('-', '').repeat(2);
      // oxlint-disable-next-line no-await-in-loop -- Sequential reservations exercise the actual unchanged quota.
      try {
        await deps.intents.reserve({
          ...scope,
          id: crypto.randomUUID(),
          now: Date.now(),
          expiresAt: Date.now() + 900000,
          stagingKey: `staging/${suffix}`,
          finalKey: `objects/${suffix}`,
          filename: 'quota.txt',
          contentType: 'text/plain',
          maxBytes: 1,
          association: before.association,
        });
      } catch {
        break;
      }
    }
    return null;
  }
  throw new Error('Unknown fixture operation');
}
