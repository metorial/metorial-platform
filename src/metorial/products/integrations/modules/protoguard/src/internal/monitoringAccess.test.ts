import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  tenant: vi.fn(),
  project: vi.fn(),
  coreProject: vi.fn(),
  allowed: vi.fn(),
  consume: vi.fn()
}));

vi.mock('@lowerdeck/cache', () => ({
  createLocallyCachedFunction: (d: { provider: unknown }) => d.provider
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    tenant: { findUniqueOrThrow: mocks.tenant },
    project: { findUniqueOrThrow: mocks.project }
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  metorialDb: { project: { findUniqueOrThrow: mocks.coreProject } }
}));

vi.mock('@metorial/module-flags', () => ({
  flagService: { isFlagEnabledForScope: mocks.allowed }
}));

vi.mock('@metorial/module-rate-limit', () => ({
  rateLimitService: { tryConsume: mocks.consume }
}));

import { protoGuardMonitoringAccessService } from './monitoringAccess';

let project = { id: 'prj_1', oid: 300n, organization: { id: 'org_1', oid: 400n } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenant.mockResolvedValue({ oid: 1n, projectOid: 2n });
  mocks.project.mockResolvedValue({ oid: 2n, id: 'prj_1' });
  mocks.coreProject.mockResolvedValue(project);
  mocks.allowed.mockResolvedValue(true);
  mocks.consume.mockResolvedValue({ allowed: true });
});

describe('ProtoGuard monitoring access', () => {
  it('denies Free before consuming any rate allowance', async () => {
    mocks.allowed.mockResolvedValue(false);

    expect(await protoGuardMonitoringAccessService.tryStartScan({ tenantOid: 1n })).toBeNull();
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it('resolves portable project identity before checking access and rate limits', async () => {
    let scope = await protoGuardMonitoringAccessService.tryStartScan({ tenantOid: 1n });

    expect(mocks.coreProject).toHaveBeenCalledWith({
      where: { id: 'prj_1' },
      include: { organization: true }
    });
    expect(mocks.allowed).toHaveBeenCalledWith({
      project,
      organization: project.organization,
      flag: 'paid-protoguard'
    });
    expect(mocks.consume).toHaveBeenCalledWith({
      project,
      organization: project.organization,
      usages: [{ key: 'protoguard.message_scans' }]
    });
    expect(scope).toEqual({ project, organization: project.organization });
  });

  it('denies scanning when the project rate allowance is exhausted', async () => {
    mocks.consume.mockResolvedValue({ allowed: false });

    expect(await protoGuardMonitoringAccessService.tryStartScan({ tenantOid: 1n })).toBeNull();
  });
});
