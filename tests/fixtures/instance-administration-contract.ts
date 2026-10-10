import { preparedAudit } from './prepared-audit-fixture.ts';
import { expect } from 'vitest';
import type { AccountAdministrationStore } from '@hyperbug/application';
import { nextId } from './repository-contract.ts';

export async function instanceAdministrationContract(
  query: (
    sql: string,
    values?: (string | number)[],
  ) => Promise<Record<string, unknown>[]>,
  store: AccountAdministrationStore,
) {
  const admins = [nextId(), nextId()];
  const plainStaff = nextId(),
    now = Date.now();
  for (const id of [...admins, plainStaff])
    await query(
      "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'staff', 'Instance fixture', ?)",
      [id, now],
    );
  for (const id of admins)
    await query(
      "INSERT INTO instance_roles (principal_id, role, granted_at) VALUES (?, 'instance-administrator', ?)",
      [id, now],
    );
  expect(await store.loadInstanceRole(plainStaff)).toBeNull();
  expect(
    await store.suspendPrincipal(
      plainStaff,
      preparedAudit('principal.suspended', plainStaff, admins[0]!),
    ),
  ).toBe(true);
  // Cross-row concurrency must serialize before evaluating the active count.
  const results = await Promise.all(
    admins.map((id) =>
      store.suspendPrincipal(
        id,
        preparedAudit('principal.suspended', id, plainStaff),
      ),
    ),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
  const active = await query(
    "SELECT p.id FROM principals p JOIN instance_roles r ON r.principal_id = p.id WHERE p.status = 'active'",
  );
  expect(active).toHaveLength(1);
  expect(
    await store.suspendPrincipal(
      String(active[0]!.id),
      preparedAudit('principal.suspended', String(active[0]!.id), plainStaff),
    ),
  ).toBe(false);
  const suspended = admins.find((id) => id !== active[0]!.id)!;
  expect(
    await store.activatePrincipal(
      suspended,
      preparedAudit('principal.activated', suspended, plainStaff),
    ),
  ).toBe(true);
  expect(
    await store.suspendPrincipal(
      String(active[0]!.id),
      preparedAudit('principal.suspended', String(active[0]!.id), plainStaff),
    ),
  ).toBe(true);
  expect(
    await store.suspendPrincipal(
      suspended,
      preparedAudit('principal.suspended', suspended, plainStaff),
    ),
  ).toBe(false);
}
