import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, paginatorCreateMock } = vi.hoisted(() => ({
  db: {
    sessionTemplate: {
      findMany: vi.fn()
    }
  },
  paginatorCreateMock: vi.fn()
}));

vi.mock('@lowerdeck/error', () => ({
  notFoundError: vi.fn(),
  ServiceError: class ServiceError extends Error {}
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: paginatorCreateMock
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  Prisma: { JsonNull: null },
  addAfterTransactionHook: vi.fn(),
  db,
  getId: vi.fn(),
  withTransaction: vi.fn()
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedEdit: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ noParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ noParent: { status: { in: ['active'] } } })),
  resolveIntegrationInstanceGroupProviders: vi.fn(async () => null),
  resolveIntegrationInstanceGroups: vi.fn(async () => null),
  resolveIntegrationInstanceProviders: vi.fn(async () => null),
  resolveIntegrationInstances: vi.fn(async () => null),
  resolveIntegrationProviders: vi.fn(async () => null),
  resolveIntegrations: vi.fn(async () => null),
  resolveProviderAuthConfigs: vi.fn(async () => null),
  resolveProviderConfigs: vi.fn(async () => null),
  resolveProviderDeployments: vi.fn(async () => null),
  resolveProviders: vi.fn(async () => null),
  resolveSessions: vi.fn(async () => null)
}));

vi.mock('@metorial-subspace/module-catalog', () => ({
  providerToolService: {
    listProviderTools: vi.fn()
  }
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  checkToolAccess: vi.fn(() => ({ allowed: true }))
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn()
}));

vi.mock('../src/queues/lifecycle/sessionTemplate', () => ({
  sessionTemplateArchivedQueue: {
    add: vi.fn()
  }
}));

vi.mock('../src/services/sessionProviderInput', () => ({
  sessionProviderInputService: {
    createSessionTemplateProvidersForInput: vi.fn()
  }
}));

vi.mock('../src/services/sessionTemplateProvider', () => ({
  sessionTemplateProviderInclude: { provider: true }
}));

import { sessionTemplateService } from '../src/services/sessionTemplate';

describe('session template list visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(db.sessionTemplate.findMany).mockResolvedValue([]);
    paginatorCreateMock.mockImplementation((factory: any) => ({
      run: async (opts: Record<string, unknown> = {}) =>
        factory({
          prisma: async (callback: (queryOpts: Record<string, unknown>) => Promise<unknown>) =>
            callback(opts)
        })
    }));
  });

  it('includes non-magic integration-backed internal templates in list queries', async () => {
    let paginator = await sessionTemplateService.listSessionTemplates({
      tenant: { oid: 1n } as any,
      solution: { oid: 2 } as any,
      environment: { oid: 3n } as any
    });

    await paginator.run({ take: 25 });

    expect(db.sessionTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        where: expect.objectContaining({
          tenantOid: 1n,
          solutionOid: 2,
          environmentOid: 3n,
          status: { in: ['active'] },
          OR: [
            { isInternal: false },
            {
              integrationInstance: {
                is: {
                  isMagicMcpBacking: false
                }
              }
            },
            {
              integrationInstanceGroup: {
                is: {
                  isMagicMcpBacking: false
                }
              }
            }
          ]
        })
      })
    );
  });
});
