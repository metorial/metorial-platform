import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findUniqueTenant: vi.fn(),
  findUniqueEnvironment: vi.fn(),
  updateManySkill: vi.fn(),
  updateManyProviderRun: vi.fn(),
  getPlan: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    tenant: { findUnique: mocks.findUniqueTenant },
    environment: { findUnique: mocks.findUniqueEnvironment },
    skill: { updateMany: mocks.updateManySkill },
    providerRun: { updateMany: mocks.updateManyProviderRun }
  }
}));

vi.mock('../lib/mirrorReferences', () => ({
  getMirrorReferencePlan: mocks.getPlan
}));

import { backfillMirrorReferencesService } from './backfillMirrorReferences';

beforeEach(() => {
  vi.clearAllMocks();

  mocks.getPlan.mockReturnValue({
    fromTenant: [
      {
        model: 'Skill',
        delegate: 'skill',
        legacyField: 'tenantOid',
        mirrorField: 'projectOid'
      }
    ],
    fromEnvironment: [
      {
        model: 'Skill',
        delegate: 'skill',
        legacyField: 'environmentOid',
        mirrorField: 'instanceOid'
      },
      {
        model: 'ProviderRun',
        delegate: 'providerRun',
        legacyField: 'environmentOid',
        mirrorField: 'metorialInstanceOid'
      }
    ]
  });

  mocks.findUniqueTenant.mockResolvedValue({ oid: 10n, projectOid: 11n });
  mocks.findUniqueEnvironment.mockResolvedValue({ oid: 20n, instanceOid: 21n });
  mocks.updateManySkill.mockResolvedValue({ count: 3 });
  mocks.updateManyProviderRun.mockResolvedValue({ count: 4 });
});

describe('backfillTenantReferences', () => {
  it('only touches rows whose mirror is still unset', async () => {
    await backfillMirrorReferencesService.backfillTenantReferences({ tenantOid: 10n });

    expect(mocks.updateManySkill).toHaveBeenCalledWith({
      where: { tenantOid: 10n, projectOid: null },
      data: { projectOid: 11n }
    });
  });

  it('does nothing while the tenant has no project reference of its own', async () => {
    mocks.findUniqueTenant.mockResolvedValue({ oid: 10n, projectOid: null });

    let result = await backfillMirrorReferencesService.backfillTenantReferences({
      tenantOid: 10n
    });

    expect(mocks.updateManySkill).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });

  it('does nothing when the tenant is gone', async () => {
    mocks.findUniqueTenant.mockResolvedValue(null);

    await backfillMirrorReferencesService.backfillTenantReferences({ tenantOid: 10n });

    expect(mocks.updateManySkill).not.toHaveBeenCalled();
  });
});

describe('backfillEnvironmentReferences', () => {
  it('writes each model through the mirror column named by the plan', async () => {
    await backfillMirrorReferencesService.backfillEnvironmentReferences({
      environmentOid: 20n
    });

    expect(mocks.updateManySkill).toHaveBeenCalledWith({
      where: { environmentOid: 20n, instanceOid: null },
      data: { instanceOid: 21n }
    });
    expect(mocks.updateManyProviderRun).toHaveBeenCalledWith({
      where: { environmentOid: 20n, metorialInstanceOid: null },
      data: { metorialInstanceOid: 21n }
    });
  });

  it('reports the total number of rows linked', async () => {
    let result = await backfillMirrorReferencesService.backfillEnvironmentReferences({
      environmentOid: 20n
    });

    expect(result.updated).toBe(7);
  });

  it('does nothing while the environment has no instance reference of its own', async () => {
    mocks.findUniqueEnvironment.mockResolvedValue({ oid: 20n, instanceOid: null });

    await backfillMirrorReferencesService.backfillEnvironmentReferences({
      environmentOid: 20n
    });

    expect(mocks.updateManySkill).not.toHaveBeenCalled();
    expect(mocks.updateManyProviderRun).not.toHaveBeenCalled();
  });
});
