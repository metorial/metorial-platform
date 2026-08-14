import { beforeEach, describe, expect, it, vi } from 'vitest';

let h = vi.hoisted(() => {
  let matchValue = (value: any, filter: any): boolean => {
    if (filter === undefined) return true;

    if (
      filter !== null &&
      typeof filter === 'object' &&
      !Array.isArray(filter) &&
      !(filter instanceof Date)
    ) {
      if ('in' in filter) return (filter.in ?? []).some((entry: any) => entry === value);
      if ('not' in filter) return !matchValue(value, filter.not);
      if ('startsWith' in filter) {
        return typeof value === 'string' && value.startsWith(filter.startsWith);
      }
      if ('gt' in filter) return value > filter.gt;
      return false;
    }

    return value === filter;
  };

  let matches = (row: any, where: any = {}): boolean =>
    Object.entries(where ?? {}).every(([key, filter]) => {
      if (key === 'OR') return (filter as any[]).some(sub => matches(row, sub));
      if (key === 'NOT') return !matches(row, filter);
      return matchValue(row[key], filter);
    });

  let state = {
    tenants: [] as any[],
    environments: [] as any[],
    projects: [] as any[],
    mirrorProject: null as any,
    mirrorInstances: [] as any[],
    childRows: new Map<string, number>(),
    // Rows that appear only once planning has already counted the environment.
    childRowsOnRecheck: new Map<string, number>(),
    childRowCalls: new Map<string, number>(),
    opLog: [] as any[],
    metorialProjectUpdates: [] as any[],
    metorialInstanceUpdates: [] as any[],
    organizationUpdates: [] as any[],
    handoff: [] as any[]
  };

  let subspaceDb = {
    tenant: {
      findUnique: async ({ where }: any) =>
        state.tenants.find(row => (where.oid ? row.oid === where.oid : row.id === where.id)) ??
        null,
      findMany: async ({ where }: any) => state.tenants.filter(row => matches(row, where)),
      update: async ({ where, data }: any) => {
        let tenant = state.tenants.find(row => row.oid === where.oid);
        state.opLog.push({ op: 'updateTenant', oid: where.oid, data });
        Object.assign(tenant, data);
        return tenant;
      }
    },
    environment: {
      findUnique: async ({ where }: any) =>
        state.environments.find(row =>
          where.oid ? row.oid === where.oid : row.id === where.id
        ) ?? null,
      findMany: async ({ where }: any) =>
        state.environments.filter(row => matches(row, where)),
      count: async ({ where }: any) =>
        state.environments.filter(row => matches(row, where)).length,
      update: async ({ where, data }: any) => {
        let environment = state.environments.find(row => row.oid === where.oid);
        state.opLog.push({ op: 'updateEnvironment', oid: where.oid, data });
        Object.assign(environment, data);
        return environment;
      },
      delete: async ({ where }: any) => {
        state.opLog.push({ op: 'deleteEnvironment', oid: where.oid });
        state.environments = state.environments.filter(row => row.oid !== where.oid);
      }
    },
    project: {
      updateMany: async ({ where, data }: any) => {
        state.opLog.push({ op: 'mirrorProject', oid: where.oid, data });
        if (state.mirrorProject) Object.assign(state.mirrorProject, data);
      }
    },
    instance: {
      updateMany: async ({ where, data }: any) => {
        state.opLog.push({ op: 'mirrorInstance', oid: where.oid, data });
        let mirror = state.mirrorInstances.find(row => row.oid === where.oid);
        if (mirror) Object.assign(mirror, data);
      },
      count: async ({ where }: any) =>
        state.mirrorInstances.filter(row => matches(row, where)).length
    },
    providerAuthCredentials: { findMany: async () => [] },
    managedProviderAuthCredentialsBacking: { updateMany: async () => {} },
    session: {
      count: async ({ where }: any) => {
        let key = String(where.environmentOid);
        let calls = (state.childRowCalls.get(key) ?? 0) + 1;
        state.childRowCalls.set(key, calls);

        if (calls > 1 && state.childRowsOnRecheck.has(key)) {
          return state.childRowsOnRecheck.get(key)!;
        }

        return state.childRows.get(key) ?? 0;
      },
      updateMany: async ({ where, data }: any) => {
        state.opLog.push({ op: 'moveScopedRows', where, data });
      }
    },
    brand: { count: async () => 0 },
    monitorAlert: { findMany: async () => [] },
    monitorAlertEvent: { findMany: async () => [], updateMany: async () => {} },
    monitorAlertRecipient: {
      findMany: async () => [],
      updateMany: async () => {},
      deleteMany: async () => {}
    },
    tenantActor: { findMany: async () => [] }
  };

  return { matches, state, subspaceDb };
});

vi.mock('@lowerdeck/service', () => ({
  Service: { create: vi.fn((_name, factory) => ({ build: () => factory() })) }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: h.subspaceDb,
  withTransaction: async (cb: any) => await cb(h.subspaceDb)
}));

vi.mock('../lib/tenantScopedReferences', () => ({
  getEnvironmentScopedModels: () => [
    { model: 'Session', delegate: 'session', hasTenantOid: true }
  ],
  getTenantScopedOnlyModels: () => [{ model: 'Brand', delegate: 'brand', hasTenantOid: true }]
}));

vi.mock('../lib/metorialDb', () => ({
  metorialDb: {
    project: {
      findUnique: async ({ where }: any) =>
        h.state.projects.find(row => row.oid === where.oid) ?? null,
      findFirst: async ({ where }: any) =>
        h.state.projects.find(row => h.matches(row, where)) ?? null,
      findMany: async ({ where }: any) =>
        h.state.projects.filter(row => h.matches(row, where)),
      update: async ({ where, data }: any) => {
        h.state.metorialProjectUpdates.push({ where, data });
        let project = h.state.projects.find(row => row.oid === where.oid);
        Object.assign(project, data);
        return project;
      }
    },
    instance: {
      findUnique: async ({ where }: any) =>
        h.state.projects
          .flatMap(project => project.instances)
          .find(row => (where.oid ? row.oid === where.oid : row.id === where.id)) ?? null,
      findFirst: async ({ where }: any) =>
        h.state.projects
          .flatMap(project => project.instances)
          .find(row => h.matches(row, where)) ?? null,
      update: async ({ where, data }: any) => {
        h.state.metorialInstanceUpdates.push({ where, data });
        let instance = h.state.projects
          .flatMap(project => project.instances)
          .find(row => row.oid === where.oid);
        Object.assign(instance, data);
        return instance;
      }
    },
    organization: {
      findUnique: async () => null,
      update: async (args: any) => {
        h.state.organizationUpdates.push(args);
      }
    },
    resourceGroup: { findUnique: async () => null }
  }
}));

vi.mock('./metorialResource', () => ({
  metorialResourceService: {
    syncProject: async (project: any) => h.state.handoff.push(['syncProject', project.oid]),
    syncInstance: async (instance: any) => h.state.handoff.push(['syncInstance', instance.oid])
  }
}));

vi.mock('./reconcileResourceLinks', () => ({
  reconcileResourceLinksService: {
    reconcileProjectLinks: async (d: any) =>
      h.state.handoff.push(['reconcileProjectLinks', d.projectOid])
  }
}));

import { reconcileLegacyScopeService } from './reconcileLegacyScope';

let makeInstance = (overrides: Record<string, unknown> = {}) => ({
  oid: 3n,
  id: 'ins_1',
  projectOid: 2n,
  resourceGroupOid: null,
  subspaceTenantId: null,
  subspaceEnvironmentId: null,
  internalTenantIdentifier: null,
  internalEnvironmentIdentifier: null,
  ...overrides
});

let makeProject = (overrides: Record<string, unknown> = {}) => ({
  oid: 2n,
  id: 'prj_1',
  subspaceTenantId: null,
  internalTenantIdentifier: null,
  resourceTenant: null,
  organization: { id: 'org_1', subspaceTenantIds: [] as string[] },
  instances: [makeInstance()],
  ...overrides
});

let makeTenant = (overrides: Record<string, unknown> = {}) => ({
  oid: 20n,
  id: 'ktn_20',
  identifier: 'mte-ins_1',
  resourceTenantId: null,
  resourceTenantIdentifier: null,
  projectOid: null,
  retiredAt: null,
  ...overrides
});

let makeEnvironment = (overrides: Record<string, unknown> = {}) => ({
  oid: 30n,
  id: 'ken_30',
  identifier: 'mtei-ins_1',
  tenantOid: 20n,
  resourceGroupId: null,
  resourceGroupIdentifier: null,
  instanceOid: null,
  ...overrides
});

let reconcile = () =>
  reconcileLegacyScopeService.reconcileLegacyProjectScope({ projectOid: 2n });

beforeEach(() => {
  h.state.tenants = [];
  h.state.environments = [];
  h.state.projects = [];
  h.state.mirrorProject = { oid: 2n, tenantOid: 0n };
  h.state.mirrorInstances = [{ oid: 3n, environmentOid: 0n }];
  h.state.childRows = new Map();
  h.state.childRowsOnRecheck = new Map();
  h.state.childRowCalls = new Map();
  h.state.opLog = [];
  h.state.metorialProjectUpdates = [];
  h.state.metorialInstanceUpdates = [];
  h.state.organizationUpdates = [];
  h.state.handoff = [];
});

describe('reconcileLegacyProjectScope', () => {
  it('promotes a single legacy tenant and its environment', async () => {
    h.state.projects = [
      makeProject({
        subspaceTenantId: 'ktn_20',
        instances: [makeInstance({ subspaceEnvironmentId: 'ken_30' })]
      })
    ];
    h.state.tenants = [makeTenant()];
    h.state.environments = [makeEnvironment()];

    let report = await reconcile();

    expect(report.status).toBe('reconciled');
    expect(report.renamedTenant).toBe(true);
    expect(report.deletedEnvironments).toEqual([]);
    expect(h.state.tenants[0]).toMatchObject({
      identifier: 'mte-pro-2',
      projectOid: 2n
    });
    expect(h.state.environments[0]).toMatchObject({
      identifier: 'mte-ins-3',
      tenantOid: 20n,
      instanceOid: 3n
    });

    expect(h.state.metorialProjectUpdates[0]?.data).toEqual({
      internalTenantIdentifier: 'mte-pro-2',
      subspaceTenantId: 'ktn_20'
    });
    expect(h.state.metorialInstanceUpdates[0]?.data).toMatchObject({
      internalTenantIdentifier: 'mte-pro-2',
      subspaceTenantId: 'ktn_20',
      internalEnvironmentIdentifier: 'mte-ins-3',
      subspaceEnvironmentId: 'ken_30'
    });
    expect(h.state.organizationUpdates[0]?.data).toEqual({
      subspaceTenantIds: ['ktn_20']
    });
    expect(h.state.handoff).toEqual([
      ['syncInstance', 3n],
      ['reconcileProjectLinks', 2n]
    ]);
  });

  it('collapses two per-instance tenants onto the project', async () => {
    h.state.projects = [
      makeProject({
        instances: [
          makeInstance({ subspaceEnvironmentId: 'ken_30' }),
          makeInstance({ oid: 4n, id: 'ins_2', subspaceEnvironmentId: 'ken_31' })
        ]
      })
    ];
    h.state.mirrorInstances = [
      { oid: 3n, environmentOid: 0n },
      { oid: 4n, environmentOid: 0n }
    ];
    h.state.tenants = [
      makeTenant(),
      makeTenant({ oid: 21n, id: 'ktn_21', identifier: 'mte-ins_2' })
    ];
    h.state.environments = [
      makeEnvironment(),
      makeEnvironment({
        oid: 31n,
        id: 'ken_31',
        identifier: 'mtei-ins_2',
        tenantOid: 21n
      })
    ];

    let report = await reconcile();

    expect(report.status).toBe('reconciled');
    expect(report.promotedTenantId).toBe('ktn_20');
    expect(report.movedEnvironments).toEqual(['ken_31']);
    expect(report.retiredTenantIds).toEqual(['ktn_21']);

    expect(h.state.environments.map(row => [row.identifier, row.tenantOid])).toEqual([
      ['mte-ins-3', 20n],
      ['mte-ins-4', 20n]
    ]);
    expect(h.state.tenants[1].retiredAt).toBeInstanceOf(Date);

    // The moved environment takes its scoped rows with it.
    expect(h.state.opLog).toContainEqual({
      op: 'moveScopedRows',
      where: { environmentOid: 31n, tenantOid: { not: 20n } },
      data: { tenantOid: 20n }
    });
  });

  it('keeps the populated legacy environment and drops the empty canonical duplicate', async () => {
    h.state.projects = [
      makeProject({
        subspaceTenantId: 'ktn_20',
        instances: [makeInstance({ subspaceEnvironmentId: 'ken_30' })]
      })
    ];
    h.state.tenants = [makeTenant()];
    h.state.environments = [
      makeEnvironment(),
      makeEnvironment({ oid: 31n, id: 'ken_31', identifier: 'mte-ins-3', instanceOid: 3n })
    ];
    h.state.childRows.set('30', 12);

    let report = await reconcile();

    expect(report.status).toBe('reconciled');
    expect(report.deletedEnvironments).toEqual(['ken_31']);
    expect(h.state.environments).toHaveLength(1);
    expect(h.state.environments[0]).toMatchObject({ id: 'ken_30', identifier: 'mte-ins-3' });

    // Deleting cascades, so the mirror has to be moved off the duplicate first.
    let repoint = h.state.opLog.findIndex(entry => entry.op === 'mirrorInstance');
    let remove = h.state.opLog.findIndex(entry => entry.op === 'deleteEnvironment');
    expect(repoint).toBeGreaterThanOrEqual(0);
    expect(repoint).toBeLessThan(remove);
    expect(h.state.mirrorInstances[0].environmentOid).toBe(30n);
  });

  it('aborts without writing when both environments hold rows', async () => {
    h.state.projects = [
      makeProject({
        subspaceTenantId: 'ktn_20',
        instances: [makeInstance({ subspaceEnvironmentId: 'ken_30' })]
      })
    ];
    h.state.tenants = [makeTenant()];
    h.state.environments = [
      makeEnvironment(),
      makeEnvironment({ oid: 31n, id: 'ken_31', identifier: 'mte-ins-3', instanceOid: 3n })
    ];
    h.state.childRows.set('30', 12);
    h.state.childRows.set('31', 4);

    let report = await reconcile();

    expect(report.status).toBe('aborted');
    expect(report.reason).toContain('all hold rows for mte-ins-3');
    expect(h.state.opLog).toEqual([]);
    expect(h.state.metorialProjectUpdates).toEqual([]);
    expect(h.state.handoff).toEqual([]);
  });

  it('leaves an already canonical project alone', async () => {
    h.state.projects = [
      makeProject({
        subspaceTenantId: 'ktn_20',
        internalTenantIdentifier: 'mte-pro-2',
        instances: [
          makeInstance({
            subspaceTenantId: 'ktn_20',
            internalTenantIdentifier: 'mte-pro-2',
            subspaceEnvironmentId: 'ken_30',
            internalEnvironmentIdentifier: 'mte-ins-3'
          })
        ]
      })
    ];
    h.state.tenants = [makeTenant({ identifier: 'mte-pro-2', projectOid: 2n })];
    h.state.environments = [makeEnvironment({ identifier: 'mte-ins-3', instanceOid: 3n })];

    let report = await reconcile();

    expect(report.status).toBe('noop');
    expect(h.state.opLog).toEqual([]);
    expect(h.state.metorialProjectUpdates).toEqual([]);
    expect(h.state.handoff).toEqual([]);
  });

  it('will not promote a tenant shared with another project', async () => {
    h.state.projects = [
      makeProject({
        subspaceTenantId: 'ktn_20',
        instances: [makeInstance({ subspaceEnvironmentId: 'ken_30' })]
      }),
      makeProject({
        oid: 9n,
        id: 'prj_9',
        instances: [makeInstance({ oid: 5n, id: 'ins_5', projectOid: 9n })]
      })
    ];
    h.state.tenants = [makeTenant({ identifier: 'mteo-org_1' })];
    h.state.environments = [
      makeEnvironment(),
      // A second project's environment still sits under the shared per-organization tenant.
      makeEnvironment({ oid: 50n, id: 'ken_50', identifier: 'mtei-ins_5', instanceOid: 5n })
    ];

    let report = await reconcile();

    expect(report.status).toBe('aborted');
    expect(report.reason).toContain('belongs to another project');
    expect(h.state.opLog).toEqual([]);
    expect(h.state.metorialProjectUpdates).toEqual([]);
  });

  it('refuses to delete a duplicate that gained rows since planning', async () => {
    h.state.projects = [
      makeProject({
        subspaceTenantId: 'ktn_20',
        instances: [makeInstance({ subspaceEnvironmentId: 'ken_30' })]
      })
    ];
    h.state.tenants = [makeTenant()];
    h.state.environments = [
      makeEnvironment(),
      makeEnvironment({ oid: 31n, id: 'ken_31', identifier: 'mte-ins-3', instanceOid: 3n })
    ];
    h.state.childRows.set('30', 12);
    // Live traffic writes into the empty duplicate after planning read it as empty.
    h.state.childRowsOnRecheck.set('31', 3);

    let report = await reconcile();

    expect(report.status).toBe('aborted');
    expect(report.reason).toContain('gained rows');
    expect(h.state.environments).toHaveLength(2);
    expect(h.state.opLog.some(entry => entry.op === 'deleteEnvironment')).toBe(false);
  });

  it('refuses to delete a duplicate that still backs another instance mirror', async () => {
    h.state.projects = [
      makeProject({
        subspaceTenantId: 'ktn_20',
        instances: [makeInstance({ subspaceEnvironmentId: 'ken_30' })]
      })
    ];
    h.state.tenants = [makeTenant()];
    h.state.environments = [
      makeEnvironment(),
      makeEnvironment({ oid: 31n, id: 'ken_31', identifier: 'mte-ins-3', instanceOid: 3n })
    ];
    h.state.childRows.set('30', 12);
    // Instance mirrors cascade from Environment but carry no environmentOid, so the row count
    // cannot see them. This one belongs to an instance outside the plan.
    h.state.mirrorInstances = [
      { oid: 3n, environmentOid: 0n },
      { oid: 7n, environmentOid: 31n }
    ];

    let report = await reconcile();

    expect(report.status).toBe('aborted');
    expect(report.reason).toContain('instance mirrors');
    expect(h.state.environments).toHaveLength(2);
    expect(h.state.opLog.some(entry => entry.op === 'deleteEnvironment')).toBe(false);
  });

  it('keeps an environment link that no candidate resolved to', async () => {
    h.state.projects = [
      makeProject({
        subspaceTenantId: 'ktn_20',
        instances: [makeInstance({ subspaceEnvironmentId: 'ken_30' })]
      }),
      makeProject({
        oid: 9n,
        id: 'prj_9',
        instances: [makeInstance({ oid: 5n, id: 'ins_5', projectOid: 9n })]
      })
    ];
    h.state.tenants = [makeTenant(), makeTenant({ oid: 21n, id: 'ktn_21' })];
    // A stale mirror points this environment at another project's instance, so it never becomes a
    // plan for instance 3. Its tenant is not the survivor, so the shared-tenant check stays quiet.
    h.state.environments = [makeEnvironment({ tenantOid: 21n, instanceOid: 5n })];

    let report = await reconcile();

    expect(report.status).toBe('reconciled');
    expect(report.warnings).toContainEqual(
      expect.stringContaining('keeps its existing environment link ken_30')
    );

    let update = h.state.metorialInstanceUpdates[0]?.data;
    expect(update).not.toHaveProperty('subspaceEnvironmentId');
    expect(update).not.toHaveProperty('internalEnvironmentIdentifier');
    expect(h.state.environments[0]).toMatchObject({ id: 'ken_30', tenantOid: 21n });
  });

  it('repairs the Metorial pointers when only they have drifted', async () => {
    h.state.projects = [
      makeProject({
        subspaceTenantId: 'ktn_20',
        internalTenantIdentifier: 'mteo-org_1',
        instances: [makeInstance({ subspaceEnvironmentId: 'ken_30' })]
      })
    ];
    h.state.tenants = [makeTenant({ identifier: 'mte-pro-2', projectOid: 2n })];
    h.state.environments = [makeEnvironment({ identifier: 'mte-ins-3', instanceOid: 3n })];

    let report = await reconcile();

    expect(report.status).toBe('reconciled');
    expect(h.state.metorialProjectUpdates[0]?.data).toEqual({
      internalTenantIdentifier: 'mte-pro-2',
      subspaceTenantId: 'ktn_20'
    });
    expect(h.state.metorialInstanceUpdates[0]?.data).toMatchObject({
      internalEnvironmentIdentifier: 'mte-ins-3',
      subspaceEnvironmentId: 'ken_30'
    });
  });

  it('clears pointers into a tenant that no longer exists', async () => {
    h.state.projects = [
      makeProject({
        subspaceTenantId: 'ktn_gone',
        internalTenantIdentifier: 'mte-pro-2',
        instances: [makeInstance({ subspaceEnvironmentId: 'ken_gone' })]
      })
    ];

    let report = await reconcile();

    expect(report.status).toBe('reconciled');
    expect(h.state.metorialProjectUpdates[0]?.data).toEqual({
      internalTenantIdentifier: null,
      subspaceTenantId: null
    });
    expect(h.state.metorialInstanceUpdates[0]?.data).toEqual({
      internalEnvironmentIdentifier: null,
      subspaceEnvironmentId: null
    });
    // Cleared pointers let the regular scope path provision from scratch.
    expect(h.state.handoff).toContainEqual(['syncInstance', 3n]);
  });

  it('will not repurpose a tenant that belongs to another project', async () => {
    h.state.projects = [
      makeProject({
        subspaceTenantId: 'ktn_99',
        instances: [makeInstance({ subspaceEnvironmentId: null })]
      })
    ];
    h.state.tenants = [makeTenant({ oid: 99n, id: 'ktn_99', identifier: 'mte-pro-777' })];

    let report = await reconcile();

    // Silently reporting a no-op would hide a project whose scope belongs to another project.
    expect(report.status).toBe('aborted');
    expect(report.reason).toContain('names another project');
    expect(h.state.opLog).toEqual([]);
    expect(h.state.metorialProjectUpdates).toEqual([]);
  });
});
