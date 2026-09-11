import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  sessionTemplateFindUnique: vi.fn(),
  integrationInstanceProviderFindMany: vi.fn(),
  sessionTemplateProviderFindMany: vi.fn(),
  sessionTemplateUpdate: vi.fn(),
  sessionTemplateProviderCreate: vi.fn(),
  sessionTemplateProviderUpdate: vi.fn(),
  sessionTemplateProviderUpdateMany: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn(handler => handler)
  }))
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    integrationInstance: { findUnique: vi.fn() },
    sessionTemplate: {
      findUnique: mocks.sessionTemplateFindUnique,
      findMany: vi.fn()
    },
    integrationInstanceProvider: { findMany: mocks.integrationInstanceProviderFindMany },
    sessionTemplateProvider: { findMany: mocks.sessionTemplateProviderFindMany }
  },
  getId: vi.fn((prefix: string) => ({ oid: 1n, id: `${prefix}_1` })),
  withTransaction: vi.fn(async (run: (db: unknown) => Promise<unknown>) =>
    run({
      sessionTemplate: { update: mocks.sessionTemplateUpdate },
      sessionTemplateProvider: {
        create: mocks.sessionTemplateProviderCreate,
        update: mocks.sessionTemplateProviderUpdate,
        updateMany: mocks.sessionTemplateProviderUpdateMany
      }
    })
  )
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  buildIntegrationProviderToolFilterChain: vi.fn(() => ({ type: 'v1.chain', chain: [] }))
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../../lib/sessionTemplateSync', () => ({
  queueJobId: vi.fn((...parts: string[]) => parts.join(':')),
  withSessionTemplateSyncLock: vi.fn(
    async (_id: string, run: () => Promise<unknown>) => await run()
  )
}));

vi.mock('./sessionTemplate', () => ({
  sessionTemplateArchivedQueue: { add: vi.fn() }
}));

vi.mock('./sessionTemplateProvider', () => ({
  enqueueSessionTemplateProvidersCreated: vi.fn(),
  enqueueSessionTemplateSyncHash: vi.fn()
}));

import { syncIntegrationInstanceSessionTemplateQueueProcessor } from './linkedSessionTemplate';

let makeSessionTemplate = (overrides: Record<string, unknown> = {}) => ({
  oid: 70n,
  id: 'st_1',
  status: 'active',
  integrationInstanceOid: 80n,
  integrationInstance: {
    status: 'active',
    identityActorOid: null,
    identityOid: null
  },
  tenantOid: 10n,
  projectOid: 20n,
  solutionOid: 7,
  environmentOid: 30n,
  instanceOid: 40n,
  ...overrides
});

let integrationInstanceProvider = {
  oid: 90n,
  integration: {
    canAttachCustomToolFilters: false,
    canOverrideToolFilters: false
  },
  integrationProvider: { providerOid: 51n },
  currentVersion: {
    configOid: 53n,
    authConfigOid: null,
    toolFilter: null,
    isOverrideToolFilter: false,
    integrationProviderVersion: { deploymentOid: 52n, toolFilter: null }
  }
};

let sync = () =>
  (syncIntegrationInstanceSessionTemplateQueueProcessor as any)({
    sessionTemplateId: 'st_1'
  });

describe('linked session template sync double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionTemplateFindUnique.mockResolvedValue(makeSessionTemplate());
    mocks.integrationInstanceProviderFindMany.mockResolvedValue([integrationInstanceProvider]);
    mocks.sessionTemplateProviderFindMany.mockResolvedValue([]);
    mocks.sessionTemplateProviderCreate.mockResolvedValue({ id: 'stp_1' });
    mocks.sessionTemplateProviderUpdate.mockResolvedValue({ id: 'stp_1' });
    mocks.sessionTemplateProviderUpdateMany.mockResolvedValue({ count: 0 });
    mocks.sessionTemplateUpdate.mockResolvedValue({});
  });

  it('clones the mirrored references from the template onto a new provider', async () => {
    await sync();

    let [{ data }] = mocks.sessionTemplateProviderCreate.mock.calls[0]!;

    expect(data).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('clones the mirrored references onto an existing provider', async () => {
    mocks.sessionTemplateProviderFindMany.mockResolvedValue([
      { oid: 95n, id: 'stp_existing', integrationInstanceProviderOid: 90n }
    ]);

    await sync();

    expect(mocks.sessionTemplateProviderCreate).not.toHaveBeenCalled();
    expect(mocks.sessionTemplateProviderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 95n },
        data: expect.objectContaining({
          tenantOid: 10n,
          projectOid: 20n,
          environmentOid: 30n,
          instanceOid: 40n
        })
      })
    );
  });

  it('clones a null reference without fabricating one', async () => {
    mocks.sessionTemplateFindUnique.mockResolvedValue(
      makeSessionTemplate({ projectOid: null, instanceOid: null })
    );

    await sync();

    let [{ data }] = mocks.sessionTemplateProviderCreate.mock.calls[0]!;

    expect(data.projectOid).toBeNull();
    expect(data.instanceOid).toBeNull();
  });

  it('reads the integration providers once, not once per provider', async () => {
    mocks.integrationInstanceProviderFindMany.mockResolvedValue([
      integrationInstanceProvider,
      { ...integrationInstanceProvider, oid: 91n }
    ]);

    await sync();

    expect(mocks.integrationInstanceProviderFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.sessionTemplateProviderFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.sessionTemplateProviderCreate).toHaveBeenCalledTimes(2);
  });
});
