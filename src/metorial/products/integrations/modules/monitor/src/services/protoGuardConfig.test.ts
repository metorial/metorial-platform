import { beforeEach, describe, expect, it, vi } from 'vitest';

let findManyFilters = vi.fn();
let findManySettings = vi.fn();
let findUniqueTenantSetting = vi.fn();
let findFirstFilter = vi.fn();
let upsertFilterSetting = vi.fn();
let upsertTenantSetting = vi.fn();

vi.mock('@metorial-subspace/db', () => ({
  db: {
    protoGuardFilter: {
      findMany: findManyFilters,
      findFirst: findFirstFilter
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
        alertConfidenceThreshold: 0.8,
        scoreWeight: 3,
        stage: 'active'
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
      enabled: true,
      alertFilterCountThreshold: 3,
      alertProbabilityThreshold: null
    });

    let { getProtoGuardConfigForEvaluation } = await import('./protoGuardConfig');
    let result = await getProtoGuardConfigForEvaluation({ tenantOid });

    expect(result.enabled).toBe(true);
    expect(result.alertFilterCountThreshold).toBe(3);
    expect(result.alertProbabilityThreshold).toBe(0.8);
    expect(result.filters).toEqual([
      {
        key: 'instruction_override',
        oid: filterOid,
        stage: 'active',
        scoreWeight: 3,
        enabled: false,
        alertConfidenceThreshold: 0.92
      }
    ]);
  });

  it('treats a tenant without a setting row as enabled with default thresholds', async () => {
    findManyFilters.mockResolvedValue([]);
    findManySettings.mockResolvedValue([]);
    findUniqueTenantSetting.mockResolvedValue(null);

    let { getProtoGuardConfigForEvaluation } = await import('./protoGuardConfig');
    let result = await getProtoGuardConfigForEvaluation({ tenantOid: BigInt(9) });

    expect(result).toMatchObject({
      enabled: true,
      alertProbabilityThreshold: 0.8,
      alertFilterCountThreshold: 2
    });
  });

  it('reports a disabled tenant', async () => {
    findManyFilters.mockResolvedValue([]);
    findManySettings.mockResolvedValue([]);
    findUniqueTenantSetting.mockResolvedValue({
      enabled: false,
      alertFilterCountThreshold: null,
      alertProbabilityThreshold: 0.65
    });

    let { getProtoGuardConfigForEvaluation } = await import('./protoGuardConfig');
    let result = await getProtoGuardConfigForEvaluation({ tenantOid: BigInt(10) });

    expect(result).toMatchObject({
      enabled: false,
      alertProbabilityThreshold: 0.65,
      alertFilterCountThreshold: 2
    });
  });

  it('reads the global filter list once across tenants', async () => {
    findManyFilters.mockResolvedValue([
      {
        oid: BigInt(456),
        key: 'instruction_override',
        defaultEnabled: true,
        alertConfidenceThreshold: 0.8
      }
    ]);
    findManySettings.mockResolvedValue([]);
    findUniqueTenantSetting.mockResolvedValue(null);

    let { getProtoGuardConfigForEvaluation } = await import('./protoGuardConfig');

    await getProtoGuardConfigForEvaluation({ tenantOid: BigInt(1) });
    await getProtoGuardConfigForEvaluation({ tenantOid: BigInt(2) });
    await getProtoGuardConfigForEvaluation({ tenantOid: BigInt(1) });

    expect(findManyFilters).toHaveBeenCalledTimes(1);
    expect(findManySettings).toHaveBeenCalledTimes(2);
  });
});

describe('protoGuardConfigService', () => {
  beforeEach(() => {
    vi.resetModules();
    findFirstFilter.mockReset();
    upsertFilterSetting.mockReset();
    upsertTenantSetting.mockReset();

    findFirstFilter.mockResolvedValue({
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

  it('rejects an unknown filter with a not found error', async () => {
    let { protoGuardConfigService } = await import('./protoGuardConfig');
    findFirstFilter.mockResolvedValue(null);

    await expect(
      protoGuardConfigService.setTenantFilterEnabledInternal({
        tenant: { oid: BigInt(1), id: 'tenant_1', projectOid: null },
        filterId: 'missing_filter',
        enabled: false
      } as any)
    ).rejects.toMatchObject({ data: { code: 'not_found' } });
    expect(upsertFilterSetting).not.toHaveBeenCalled();
  });

  it('rejects out-of-range thresholds before writing a setting', async () => {
    let { protoGuardConfigService } = await import('./protoGuardConfig');
    let tenant = { oid: BigInt(1), id: 'tenant_1', projectOid: null };

    for (let threshold of [-0.1, 1.5, Number.NaN]) {
      await expect(
        protoGuardConfigService.setTenantFilterAlertConfidenceThresholdInternal({
          tenant,
          filterId: 'instruction_override',
          threshold
        } as any)
      ).rejects.toMatchObject({ data: { code: 'invalid_alert_confidence_threshold' } });
    }

    for (let threshold of [0, 1.5, -2]) {
      await expect(
        protoGuardConfigService.setTenantAlertFilterCountThresholdInternal({
          tenant,
          threshold
        } as any)
      ).rejects.toMatchObject({ data: { code: 'invalid_alert_filter_count_threshold' } });
    }

    for (let threshold of [0, -0.2, 1.01, Number.POSITIVE_INFINITY]) {
      await expect(
        protoGuardConfigService.updateTenantSettingsInternal({
          tenant,
          input: { alertProbabilityThreshold: threshold }
        } as any)
      ).rejects.toMatchObject({ data: { code: 'invalid_alert_probability_threshold' } });
    }

    expect(upsertFilterSetting).not.toHaveBeenCalled();
    expect(upsertTenantSetting).not.toHaveBeenCalled();
  });

  it('clears the count threshold without deleting the tenant setting', async () => {
    let { protoGuardConfigService } = await import('./protoGuardConfig');

    await protoGuardConfigService.setTenantAlertFilterCountThresholdInternal({
      tenant: { oid: BigInt(1), id: 'tenant_1', projectOid: null },
      threshold: null
    } as any);

    let call = upsertTenantSetting.mock.calls[0][0];

    expect(call.update).toMatchObject({ alertFilterCountThreshold: null });
    expect(call.update.enabled).toBeUndefined();
  });

  it('only writes the tenant setting fields that were provided', async () => {
    let { protoGuardConfigService } = await import('./protoGuardConfig');

    await protoGuardConfigService.updateTenantSettingsInternal({
      tenant: { oid: BigInt(1), id: 'tenant_1', projectOid: BigInt(11) },
      input: { enabled: false }
    } as any);

    let call = upsertTenantSetting.mock.calls[0][0];

    expect(call.update.enabled).toBe(false);
    expect(call.update.alertProbabilityThreshold).toBeUndefined();
    expect(call.update.alertFilterCountThreshold).toBeUndefined();
    expect(call.create).toMatchObject({ enabled: false, projectOid: BigInt(11) });
  });
});
