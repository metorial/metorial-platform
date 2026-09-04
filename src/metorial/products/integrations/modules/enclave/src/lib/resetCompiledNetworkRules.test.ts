import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@metorial-subspace/db';

let enclaveUpdateMany = vi.fn();

vi.mock('@metorial-subspace/db', () => ({
  Prisma: {
    JsonNull: Symbol('JsonNull')
  },
  db: {
    enclave: {
      updateMany: (...args: unknown[]) => enclaveUpdateMany(...args)
    }
  }
}));

import { resetCompiledNetworkRulesForBindingTargets } from './resetCompiledNetworkRules';

describe('resetCompiledNetworkRulesForBindingTargets', () => {
  beforeEach(() => {
    enclaveUpdateMany.mockReset();
  });

  it('sets needsEnclaveReconciliation when invalidating compiled rules', async () => {
    await resetCompiledNetworkRulesForBindingTargets({
      networkOid: 1n,
      tenantOid: 2n,
      environmentOid: 3n,
      bindings: [{ enclaveOid: 4n, providerOid: null, networkOid: null }]
    });

    expect(enclaveUpdateMany).toHaveBeenCalledWith({
      where: {
        networkOid: 1n,
        tenantOid: 2n,
        environmentOid: 3n,
        OR: [{ oid: { in: [4n] } }]
      },
      data: {
        compiledNetworkRules: Prisma.JsonNull,
        needsEnclaveReconciliation: true
      }
    });
  });
});
