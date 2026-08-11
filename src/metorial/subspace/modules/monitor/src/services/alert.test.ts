import { beforeEach, describe, expect, it, vi } from 'vitest';

let monitorAlertFindMany = vi.fn();

vi.mock('@metorial-subspace/db', () => ({
  db: {
    monitorAlert: {
      findMany: monitorAlertFindMany
    }
  },
  getId: (model: string) => ({ oid: BigInt(1), id: `${model}_1` }),
  withTransaction: async (fn: (db: any) => Promise<unknown>) => await fn({})
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: (factory: any) => ({
      run: async () => await factory({ prisma: async (fn: any) => await fn({}) })
    })
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({
      build: factory
    })
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: async () => ({ oid: 3 }),
  resolveMetorialFacing: async () => ({
    tenant: { oid: BigInt(1) },
    environment: { oid: BigInt(2) }
  })
}));

vi.mock('./_shared', () => ({
  normalizeDateFilter: (filter: unknown) => filter,
  resolveMonitorOids: vi.fn(async () => undefined),
  resolveProtoGuardAlertOids: vi.fn(async () => undefined),
  resolveProtoGuardFilterOids: vi.fn(async () => undefined),
  resolveProtoGuardRunOids: vi.fn(async () => undefined),
  resolveProviderOids: vi.fn(async () => undefined),
  resolveProviderRunOids: vi.fn(async () => undefined),
  resolveSessionConnectionOids: vi.fn(async () => undefined),
  resolveSessionMessageOids: vi.fn(async () => undefined),
  resolveSessionOids: vi.fn(async () => undefined),
  resolveSpecNotificationOids: vi.fn(async () => undefined)
}));

describe('alertService', () => {
  beforeEach(() => {
    vi.resetModules();
    monitorAlertFindMany.mockReset();
    monitorAlertFindMany.mockResolvedValue([]);
  });

  it('scopes list queries by tenant, environment, and solution', async () => {
    let { alertService } = await import('./alert');

    let paginator = await alertService.listAlertsInternal({
      tenant: { oid: BigInt(1) },
      environment: { oid: BigInt(2) }
    } as any);

    await paginator.run({});

    expect(monitorAlertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantOid: BigInt(1),
          environmentOid: BigInt(2),
          solutionOid: 3
        })
      })
    );
  });
});
