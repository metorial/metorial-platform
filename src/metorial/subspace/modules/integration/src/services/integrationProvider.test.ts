import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  tx,
  providerDeploymentServiceMock,
  providerServiceMock,
  providerAuthCredentialsServiceMock,
  createIntegrationProviderVersionMock,
  createIntegrationVersionMock,
  integrationProviderUpdatedQueueAddMock
} = vi.hoisted(() => {
  let createModel = () => ({
    count: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn()
  });

  return {
    db: {
      integrationProvider: createModel()
    },
    tx: {
      integrationProvider: createModel()
    },
    providerDeploymentServiceMock: {
      getProviderDeploymentById: vi.fn()
    },
    providerServiceMock: {
      getProviderById: vi.fn()
    },
    providerAuthCredentialsServiceMock: {
      listProviderAuthCredentials: vi.fn()
    },
    createIntegrationProviderVersionMock: vi.fn(),
    createIntegrationVersionMock: vi.fn(),
    integrationProviderUpdatedQueueAddMock: vi.fn()
  };
});

vi.mock('@metorial-subspace/db', () => ({
  addAfterTransactionHook: async (cb: () => Promise<void>) => await cb(),
  db,
  getId: (kind: string) => ({ id: `${kind}_new`, oid: 100n }),
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
}));

vi.mock('@metorial-subspace/module-catalog', () => ({
  providerAuthMethodService: {
    listProviderAuthMethods: vi.fn()
  },
  providerService: providerServiceMock
}));

vi.mock('@metorial-subspace/module-deployment', () => ({
  providerConfigService: {},
  providerDeploymentService: providerDeploymentServiceMock
}));

vi.mock('@metorial-subspace/module-auth', () => ({
  providerAuthCredentialsService: providerAuthCredentialsServiceMock
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  checkProviderMatch: vi.fn(),
  providerDeploymentInternalService: {}
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 2 }))
}));

vi.mock('../lib/versions', () => ({
  createIntegrationProviderVersion: createIntegrationProviderVersionMock,
  createIntegrationVersion: createIntegrationVersionMock,
  hasMaterialIntegrationProviderChange: (d: any) =>
    JSON.stringify(d.currentVersion.toolFilter) !== JSON.stringify(d.input.toolFilter),
  normalizeIntegrationProviderToolFilter: (toolFilter?: PrismaJson.ToolFilter | null) =>
    toolFilter ?? { type: 'v1.allow_all' }
}));

vi.mock('../queues/lifecycle/integrationProvider', () => ({
  integrationProviderArchivedQueue: { add: vi.fn() },
  integrationProviderCreatedQueue: { add: vi.fn() },
  integrationProviderUpdatedQueue: { add: integrationProviderUpdatedQueueAddMock }
}));

import { integrationProviderService } from './integrationProvider';

let restrictiveToolFilter: PrismaJson.ToolFilter = {
  type: 'v1.filter',
  filters: [{ type: 'tool_keys', keys: ['allowed'] }]
};

let deployment = {
  oid: 30n,
  id: 'pvd_1',
  description: 'Deployment',
  metadata: { source: 'test' },
  providerOid: 20n,
  provider: {
    oid: 20n,
    id: 'provider_1',
    name: 'Provider',
    description: 'Provider',
    type: { supportsAuth: false }
  },
  defaultConfigOid: 40n,
  currentVersion: null
} as any;

let currentVersion = {
  oid: 50n,
  deploymentOid: deployment.oid,
  authMethodOid: null,
  authCredentialsOid: null,
  configOid: deployment.defaultConfigOid,
  toolFilter: restrictiveToolFilter
};

let existingProvider = {
  oid: 60n,
  id: 'ipr_existing',
  status: 'active',
  name: 'Provider',
  description: 'Provider',
  metadata: null,
  tenantOid: 1n,
  solutionOid: 2,
  environmentOid: 3n,
  currentVersion
};

let input = {
  tenant: { oid: 1n },
  environment: { oid: 3n },
  integration: {
    oid: 10n,
    tenantOid: 1n,
    solutionOid: 2,
    environmentOid: 3n
  },
  input: {
    providerDeploymentId: deployment.id
  }
} as any;

describe('integrationProviderService.ensureIntegrationProviderForDeployment', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    providerDeploymentServiceMock.getProviderDeploymentById.mockResolvedValue(deployment);
    providerServiceMock.getProviderById.mockResolvedValue(deployment.provider);
    tx.integrationProvider.findUnique.mockResolvedValue(existingProvider);
    tx.integrationProvider.upsert.mockResolvedValue(existingProvider);
    tx.integrationProvider.findUniqueOrThrow.mockResolvedValue(existingProvider);
  });

  it('preserves an existing provider tool filter when input omits toolFilters', async () => {
    await integrationProviderService.ensureIntegrationProviderForDeploymentInternal(input);

    expect(tx.integrationProvider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          toolFilter: restrictiveToolFilter
        })
      })
    );
    expect(createIntegrationProviderVersionMock).not.toHaveBeenCalled();
  });

  it('treats explicit null toolFilters as an allow-all reset', async () => {
    await integrationProviderService.ensureIntegrationProviderForDeploymentInternal({
      ...input,
      input: {
        ...input.input,
        toolFilters: null
      }
    });

    let allowAllToolFilter = { type: 'v1.allow_all' };

    expect(tx.integrationProvider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          toolFilter: allowAllToolFilter
        })
      })
    );
    expect(createIntegrationProviderVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationProviderOid: existingProvider.oid,
        toolFilter: allowAllToolFilter
      })
    );
  });
});

describe('integrationProviderService.createIntegrationProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    providerDeploymentServiceMock.getProviderDeploymentById.mockResolvedValue(deployment);
    providerServiceMock.getProviderById.mockResolvedValue(deployment.provider);
    tx.integrationProvider.count.mockResolvedValue(0);
    tx.integrationProvider.findUniqueOrThrow.mockResolvedValue(existingProvider);
  });

  it('preserves an archived provider tool filter when input omits toolFilters', async () => {
    let archivedProvider = {
      ...existingProvider,
      status: 'archived'
    };
    tx.integrationProvider.findUnique.mockResolvedValue(archivedProvider);
    tx.integrationProvider.update.mockResolvedValue({
      ...archivedProvider,
      status: 'active'
    });

    await integrationProviderService.createIntegrationProviderInternal({
      ...input,
      input: {
        providerId: deployment.provider.id,
        providerDeploymentId: deployment.id
      }
    });

    expect(tx.integrationProvider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toolFilter: restrictiveToolFilter
        })
      })
    );
    expect(createIntegrationProviderVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationProviderOid: archivedProvider.oid,
        toolFilter: restrictiveToolFilter
      })
    );
  });
});
