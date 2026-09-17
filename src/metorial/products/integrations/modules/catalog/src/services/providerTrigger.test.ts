import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getMetorialSolution: vi.fn(),
  getProviderTenantFilter: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerTrigger: {
      findMany: mocks.findMany,
      findFirst: vi.fn()
    },
    providerTriggerGlobal: {
      findMany: vi.fn()
    },
    providerVersion: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn()
    }
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: mocks.getMetorialSolution,
  resolveMetorialFacing: vi.fn()
}));

vi.mock('./provider', () => ({
  getProviderTenantFilter: mocks.getProviderTenantFilter
}));

import { providerTriggerService } from './providerTrigger';

let tenant = { oid: 11n };
let environment = { oid: 12n };
let solution = { oid: 13 };

let trigger = (id: string, key: string, providerId: string) =>
  ({
    id,
    key,
    provider: { id: providerId },
    specification: { id: `spec_${providerId}` },
    global: { id: `global_${id}` }
  }) as any;

describe('providerTriggerService.listProviderTriggersForUserManagedCallbacksInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMetorialSolution.mockResolvedValue(solution);
    mocks.getProviderTenantFilter.mockReturnValue({ visible: true });
  });

  it('lists unique trigger keys for active user-managed callbacks', async () => {
    let firstIssueTrigger = trigger('ptr_1', 'issue.created', 'pro_1');
    mocks.findMany.mockResolvedValue([
      firstIssueTrigger,
      trigger('ptr_2', 'message.created', 'pro_1'),
      trigger('ptr_3', 'issue.created', 'pro_2'),
      trigger('ptr_4', 'pull_request.created', 'pro_2')
    ]);

    let paginator =
      await providerTriggerService.listProviderTriggersForUserManagedCallbacksInternal({
        tenant,
        environment
      } as any);
    let firstPage = await paginator.run({ limit: 2 });
    let secondPage = await paginator.run({ limit: 2, after: 'ptr_2' });

    expect(firstPage.items).toEqual([
      firstIssueTrigger,
      expect.objectContaining({ id: 'ptr_2', key: 'message.created' })
    ]);
    expect(firstPage.pagination).toMatchObject({
      hasNextPage: true,
      hasPreviousPage: false
    });
    expect(secondPage.items).toEqual([
      expect.objectContaining({ id: 'ptr_4', key: 'pull_request.created' })
    ]);
    expect(secondPage.pagination).toMatchObject({
      hasNextPage: false,
      hasPreviousPage: true
    });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          adapterOid: null,
          provider: { visible: true },
          specification: {
            providerVersions: {
              some: {
                isCurrent: true,
                providerVariant: {
                  callbacks: {
                    some: {
                      tenantOid: tenant.oid,
                      environmentOid: environment.oid,
                      solutionOid: solution.oid,
                      ownership: 'user',
                      status: 'active'
                    }
                  }
                }
              }
            }
          }
        })
      })
    );
  });
});
