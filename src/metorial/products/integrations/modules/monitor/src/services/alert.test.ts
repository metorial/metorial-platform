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
  }),
  resolveMetorialFacingWithOptionalActor: async () => ({
    tenant: { oid: BigInt(1) },
    environment: { oid: BigInt(2) },
    actor: { oid: BigInt(4), id: 'actor_1' }
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

    let and = monitorAlertFindMany.mock.calls[0]![0].where.AND;
    expect(and).toContainEqual({
      OR: [
        { protoGuardAlertOid: null },
        { protoGuardAlert: { session: { isInternal: false } } }
      ]
    });
  });

  it('allows internal alerts only through an explicit session filter', async () => {
    let shared = await import('./_shared');
    vi.mocked(shared.resolveSessionOids).mockResolvedValue([44n] as any);
    let { alertService } = await import('./alert');

    let paginator = await alertService.listAlertsInternal({
      tenant: { oid: 1n },
      environment: { oid: 2n },
      sessionIds: ['session_internal']
    } as any);

    await paginator.run({});

    let and = monitorAlertFindMany.mock.calls[0]![0].where.AND;
    expect(and).not.toContainEqual({
      OR: [
        { protoGuardAlertOid: null },
        { protoGuardAlert: { session: { isInternal: false } } }
      ]
    });
    expect(and).toContainEqual({ protoGuardAlert: { sessionOid: { in: [44n] } } });
  });

  it('passes the resolved actor through every Metorial-facing alert action', async () => {
    let { alertService } = await import('./alert');
    let getAlertByIdInternal = vi
      .spyOn(alertService, 'getAlertByIdInternal')
      .mockResolvedValue({ id: 'alert_1' } as any);
    let markViewedInternal = vi
      .spyOn(alertService, 'markViewedInternal')
      .mockResolvedValue({ id: 'alert_1' } as any);
    let resolveAlertInternal = vi
      .spyOn(alertService, 'resolveAlertInternal')
      .mockResolvedValue({ id: 'alert_1' } as any);
    let unresolveAlertInternal = vi
      .spyOn(alertService, 'unresolveAlertInternal')
      .mockResolvedValue({ id: 'alert_1' } as any);

    let input = {
      instance: {} as any,
      organizationActor: {} as any,
      alertId: 'alert_1'
    };

    await alertService.getAlertById(input);
    await alertService.markViewed(input);
    await alertService.resolveAlert(input);
    await alertService.unresolveAlert(input);

    let expected = {
      tenant: { oid: BigInt(1) },
      environment: { oid: BigInt(2) },
      actor: { oid: BigInt(4), id: 'actor_1' },
      alertId: 'alert_1'
    };

    expect(getAlertByIdInternal).toHaveBeenCalledWith(expected);
    expect(markViewedInternal).toHaveBeenCalledWith(expected);
    expect(resolveAlertInternal).toHaveBeenCalledWith(expected);
    expect(unresolveAlertInternal).toHaveBeenCalledWith(expected);
  });
});
