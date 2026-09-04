import { beforeEach, describe, expect, it, vi } from 'vitest';

let findManyFilters = vi.fn();
let findManySettings = vi.fn();
let findUniqueTenantSetting = vi.fn();
let findFirstOrThrowFilter = vi.fn();
let upsertFilterSetting = vi.fn();
let upsertTenantSetting = vi.fn();

vi.mock('@metorial-subspace/db', () => ({
  db: {
    protoGuardFilter: {
      findMany: findManyFilters,
      findFirstOrThrow: findFirstOrThrowFilter
    },
    protoGuardTenantFilterSetting: {
      findMany: findManySettings,
      upsert: upsertFilterSetting
    },
    protoGuardTenantSetting: {
      findUnique: findUniqueTenantSetting,
      upsert: upsertTenantSetting
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

describe('protoGuardConfigService', () => {
  beforeEach(() => {
    vi.resetModules();
    findFirstOrThrowFilter.mockReset();
    upsertFilterSetting.mockReset();
    upsertTenantSetting.mockReset();

    findFirstOrThrowFilter.mockResolvedValue({
      oid: BigInt(456),
      key: 'instruction_override',
      defaultEnabled: true,
      alertConfidenceThreshold: 0.8
    });
    upsertFilterSetting.mockResolvedValue({ oid: BigInt(1) });
    upsertTenantSetting.mockResolvedValue({ oid: BigInt(1) });
  });

  // ProtoGuard tenant settings are tenant-scoped only, so they mirror the project
  // without an instance counterpart.
  it('mirrors the tenant project onto new filter settings', async () => {
    let { protoGuardConfigService } = await import('./protoGuardConfig');

    await protoGuardConfigService.setTenantFilterEnabledInternal({
      tenant: { oid: BigInt(1), id: 'tenant_1', projectOid: BigInt(11) },
      filterId: 'instruction_override',
      enabled: false
    } as any);

    let create = upsertFilterSetting.mock.calls[0][0].create;

    expect(create.tenantOid).toBe(BigInt(1));
    expect(create.projectOid).toBe(BigInt(11));
    expect(create).not.toHaveProperty('instanceOid');
  });

  it('leaves the mirrored project null for an unlinked tenant', async () => {
    let { protoGuardConfigService } = await import('./protoGuardConfig');

    await protoGuardConfigService.setTenantAlertFilterCountThresholdInternal({
      tenant: { oid: BigInt(1), id: 'tenant_1', projectOid: null },
      threshold: 4
    } as any);

    let create = upsertTenantSetting.mock.calls[0][0].create;

    expect(create.tenantOid).toBe(BigInt(1));
    expect(create.projectOid).toBeNull();
    expect(create).not.toHaveProperty('instanceOid');
  });
});
