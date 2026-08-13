import { beforeEach, describe, expect, it, vi } from 'vitest';

let findManyFilters = vi.fn();
let findManySettings = vi.fn();
let findUniqueTenantSetting = vi.fn();

vi.mock('@metorial-subspace/db', () => ({
  db: {
    protoGuardFilter: {
      findMany: findManyFilters
    },
    protoGuardTenantFilterSetting: {
      findMany: findManySettings
    },
    protoGuardTenantSetting: {
      findUnique: findUniqueTenantSetting
    }
  },
  getId: (model: string) => ({ oid: BigInt(1), id: `${model}_1` })
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({
      build: factory
    })
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  resolveMetorialFacing: async () => ({
    tenant: { oid: BigInt(1) },
    environment: { oid: BigInt(2) }
  })
}));

describe('getProtoGuardConfigForEvaluation', () => {
  beforeEach(() => {
    vi.resetModules();
    findManyFilters.mockReset();
    findManySettings.mockReset();
    findUniqueTenantSetting.mockReset();
  });

  it('merges tenant overrides with filter defaults', async () => {
    let tenantOid = BigInt(123);
    let filterOid = BigInt(456);

    findManyFilters.mockResolvedValue([
      {
        oid: filterOid,
        key: 'instruction_override',
        defaultEnabled: true,
        alertConfidenceThreshold: 0.8
      }
    ]);
    findManySettings.mockResolvedValue([
      {
        filterOid,
        enabled: false,
        alertConfidenceThreshold: 0.92
      }
    ]);
    findUniqueTenantSetting.mockResolvedValue({
      alertFilterCountThreshold: 3
    });

    let { getProtoGuardConfigForEvaluation } = await import('./protoGuardConfig');
    let result = await getProtoGuardConfigForEvaluation({ tenantOid });

    expect(result.alertFilterCountThreshold).toBe(3);
    expect(result.filters).toEqual([
      {
        key: 'instruction_override',
        oid: filterOid,
        enabled: false,
        alertConfidenceThreshold: 0.92
      }
    ]);
  });
});
