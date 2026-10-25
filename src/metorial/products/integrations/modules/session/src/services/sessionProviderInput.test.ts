import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  sessionProviderCount: vi.fn(),
  sessionProviderCreateManyAndReturn: vi.fn(),
  sessionTemplateProviderCount: vi.fn(),
  sessionTemplateProviderCreateManyAndReturn: vi.fn(),
  getCombinationsInternal: vi.fn(),
  sessionTemplateFindMany: vi.fn(),
  sessionProviderCreatedAddMany: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/id', () => ({
  generatePlainId: vi.fn(() => 'TAG1')
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {},
  dbPrimary: {},
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<unknown>) => {
    await hook();
  }),
  getId: vi.fn((prefix: string) => ({ oid: 1n, id: `${prefix}_1` })),
  withTransaction: vi.fn(async (run: (db: unknown) => Promise<unknown>) =>
    run({
      sessionTemplate: { findMany: mocks.sessionTemplateFindMany },
      sessionProvider: {
        count: mocks.sessionProviderCount,
        createManyAndReturn: mocks.sessionProviderCreateManyAndReturn
      },
      sessionTemplateProvider: {
        count: mocks.sessionTemplateProviderCount,
        createManyAndReturn: mocks.sessionTemplateProviderCreateManyAndReturn
      }
    })
  )
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: vi.fn(async () => ({ oid: 7 })),
  internalOwnershipAccessor: { kind: 'internal', isEnforced: false },
  assertCanUseOwnedResources: vi.fn(),
  assertCanAttachOwnedResources: vi.fn(),
  mergeResourceOwners: vi.fn(() => null)
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  providerCombinationService: {
    getCombinationsInternal: mocks.getCombinationsInternal
  }
}));

vi.mock('../queues/lifecycle/sessionProvider', () => ({
  sessionProviderCreatedQueue: { addMany: mocks.sessionProviderCreatedAddMany }
}));

vi.mock('../queues/lifecycle/sessionTemplateProvider', () => ({
  enqueueSessionTemplateProviderCreated: vi.fn(),
  enqueueSessionTemplateSyncHash: vi.fn()
}));

vi.mock('./sessionProvider', () => ({
  sessionProviderInclude: {}
}));

vi.mock('./sessionTemplateProvider', () => ({
  sessionTemplateProviderInclude: {}
}));

import { sessionProviderInputService } from './sessionProviderInput';

let linkedTenant = { oid: 10n, projectOid: 20n };
let linkedEnvironment = { oid: 30n, instanceOid: 40n };

describe('sessionProviderInputService double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionProviderCount.mockResolvedValue(0);
    mocks.sessionTemplateProviderCount.mockResolvedValue(0);
    mocks.sessionProviderCreateManyAndReturn.mockResolvedValue([]);
    mocks.sessionTemplateProviderCreateManyAndReturn.mockResolvedValue([]);
    mocks.getCombinationsInternal.mockResolvedValue([
      {
        provider: { oid: 51n },
        deployment: { oid: 52n },
        config: { oid: 53n },
        authConfig: null
      }
    ]);
  });

  it('mirrors the references onto every created session provider', async () => {
    await sessionProviderInputService.createSessionProvidersForInput({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      session: { oid: 60n, isEphemeral: false } as any,
      providers: [{ deploymentId: 'pd_1' }]
    });

    let [{ data }] = mocks.sessionProviderCreateManyAndReturn.mock.calls[0]!;

    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('mirrors the references onto every created session template provider', async () => {
    await sessionProviderInputService.createSessionTemplateProvidersForInput({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      template: { oid: 70n, id: 'st_1' } as any,
      providers: [{ deploymentId: 'pd_1' }]
    });

    let [{ data }] = mocks.sessionTemplateProviderCreateManyAndReturn.mock.calls[0]!;

    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('writes null for an unlinked tenant and environment', async () => {
    await sessionProviderInputService.createSessionProvidersForInput({
      tenant: { oid: 10n, projectOid: null } as any,
      environment: { oid: 30n, instanceOid: null } as any,
      session: { oid: 60n, isEphemeral: false } as any,
      providers: [{ deploymentId: 'pd_1' }]
    });

    let [{ data }] = mocks.sessionProviderCreateManyAndReturn.mock.calls[0]!;

    expect(data[0].projectOid).toBeNull();
    expect(data[0].instanceOid).toBeNull();
  });

  it('skips the provider count for a new session and builds relations in memory', async () => {
    mocks.sessionProviderCreateManyAndReturn.mockImplementation(async ({ data }) =>
      data.map((row: any) => ({ ...row }))
    );

    let session = { oid: 60n, isEphemeral: false } as any;
    let [created] = await sessionProviderInputService.createSessionProvidersForInput({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      session,
      providers: [{ deploymentId: 'pd_1' }],
      isNewSession: true
    });

    expect(mocks.sessionProviderCount).not.toHaveBeenCalled();
    expect(mocks.sessionProviderCreateManyAndReturn.mock.calls[0]![0].include).toBeUndefined();
    expect(created).toMatchObject({
      provider: { oid: 51n },
      deployment: { oid: 52n },
      config: { oid: 53n },
      authConfig: null,
      session,
      fromTemplate: null,
      fromTemplateProvider: null
    });
    expect(mocks.sessionProviderCreatedAddMany).toHaveBeenCalledTimes(1);
    expect(mocks.sessionProviderCreatedAddMany).toHaveBeenCalledWith([
      { sessionProviderId: 'sessionProvider_1' }
    ]);
  });

  it('loads every referenced template in one scoped query', async () => {
    mocks.getCombinationsInternal.mockResolvedValue([]);
    mocks.sessionTemplateFindMany.mockResolvedValue([
      { id: 'st_1', oid: 70n, status: 'active', providers: [] }
    ]);

    let resolved = await sessionProviderInputService.resolveProviderSessionInput({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      providers: [{ sessionTemplateId: 'st_1' }, { sessionTemplateId: 'st_1' }]
    });

    expect(mocks.sessionTemplateFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.sessionTemplateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          solutionOid: 7,
          tenantOid: 10n,
          environmentOid: 30n,
          id: { in: ['st_1'] },
          status: 'active'
        }
      })
    );
    expect(resolved.templates.get('st_1')).toMatchObject({ oid: 70n });
  });
});
