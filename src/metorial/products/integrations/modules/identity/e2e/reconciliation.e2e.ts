import { eventually, useOrganization } from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { createActor, createIdentity } from './_fixtures';

describe('module-identity reconciliation', () => {
  let org = useOrganization();

  it('keeps up with a burst of identity changes', async () => {
    let owner = await createActor(org);
    let identities = await Promise.all(
      Array.from({ length: 30 }, () => createIdentity(org, { actor: owner }))
    );

    await eventually(
      async () => {
        let pending = await subspaceDb.identity.count({
          where: {
            id: { in: identities.map(identity => identity.id) },
            needsReconciliation: true
          }
        });
        expect(pending).toBe(0);
      },
      { timeoutMs: 15_000 }
    );
  }, 60_000);
});
