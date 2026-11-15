import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  integrationServiceMock,
  providerTemplateBackingServiceMock,
  providerTemplateArchivedQueueAddMock,
  providerTemplateCreatedQueueAddMock,
  providerTemplateUpdatedQueueAddMock,
  enqueueProviderTemplateBackingCleanupMock,
  subspaceScopeServiceMock,
  assertAuthMethodAllowedForTenantMock
} = vi.hoisted(() => {
  let db = {
    providerTemplate: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    }
  };

  return {
    db,
    integrationServiceMock: {
      getIntegrationById: vi.fn()
    },
    providerTemplateBackingServiceMock: {
      upsertProviderTemplateBackingFromIntegration: vi.fn(),
      updateProviderTemplateBacking: vi.fn(),
      archiveProviderTemplateBacking: vi.fn()
    },
    providerTemplateArchivedQueueAddMock: vi.fn(),
    providerTemplateCreatedQueueAddMock: vi.fn(),
    providerTemplateUpdatedQueueAddMock: vi.fn(),
    enqueueProviderTemplateBackingCleanupMock: vi.fn(),
    subspaceScopeServiceMock: {
      ensureForInstance: vi.fn()
    },
    assertAuthMethodAllowedForTenantMock: vi.fn()
  };
});

vi.mock('@metorial/db', () => ({
  db,
  ID: {
    generateId: vi.fn(async prefix => `${prefix}-new`)
  },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(code: string) {
        super(code);
        this.code = code;
      }
    }
  },
  withTransaction: vi.fn(async callback => await callback(db))
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/module-integration', () => ({
  integrationService: integrationServiceMock,
  providerTemplateBackingService: providerTemplateBackingServiceMock
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  assertAuthMethodAllowedForTenant: assertAuthMethodAllowedForTenantMock
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  subspaceScopeService: subspaceScopeServiceMock
}));

vi.mock('@metorial/module-access', () => ({
  accessTagService: {
    getAccessTagFilter: vi.fn(),
    checkResourceAccess: vi.fn()
  },
  consumerProviderTemplateReadRoles: []
}));

vi.mock('@metorial/module-search', () => ({
  searchProviderTemplateIds: vi.fn()
}));

vi.mock('../src/queues/lifecycle/providerTemplate', () => ({
  providerTemplateArchivedQueue: {
    add: providerTemplateArchivedQueueAddMock
  },
  providerTemplateCreatedQueue: {
    add: providerTemplateCreatedQueueAddMock
  },
  providerTemplateUpdatedQueue: {
    add: providerTemplateUpdatedQueueAddMock
  }
}));

vi.mock('../src/queues/lifecycle/magicMcpBackingCleanup', () => ({
  enqueueProviderTemplateBackingCleanup: enqueueProviderTemplateBackingCleanupMock
}));

import { providerTemplateService } from '../src/services/providerTemplate';

describe('providerTemplateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    integrationServiceMock.getIntegrationById.mockResolvedValue({ providers: [] });
    subspaceScopeServiceMock.ensureForInstance.mockResolvedValue({ tenant: {} });
  });

  it('archives provider templates without archiving the linked integration', async () => {
    let instance = { id: 'instance-1' };
    let providerTemplate = {
      oid: 10n,
      id: 'provider-template-1',
      status: 'active',
      hasSubspaceBacking: true,
      subspaceIntegrationId: 'integration-1'
    };
    db.providerTemplate.update.mockResolvedValue({
      ...providerTemplate,
      status: 'archived'
    });

    await providerTemplateService.archiveProviderTemplate({
      instance: instance as any,
      providerTemplate: providerTemplate as any
    });

    expect(
      providerTemplateBackingServiceMock.archiveProviderTemplateBacking
    ).not.toHaveBeenCalled();
    expect(providerTemplateArchivedQueueAddMock).toHaveBeenCalledWith({
      providerTemplateId: 'provider-template-1'
    });
    expect(enqueueProviderTemplateBackingCleanupMock).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      integrationId: 'integration-1',
      providerTemplateId: 'provider-template-1'
    });
  });

  it('resurrects an archived provider template for the same integration', async () => {
    let organization = { oid: 1n };
    let instance = { oid: 2n, id: 'instance-1' };
    let archivedProviderTemplate = {
      oid: 10n,
      id: 'provider-template-1',
      status: 'archived',
      subspaceIntegrationId: 'integration-1'
    };
    let activeProviderTemplate = {
      ...archivedProviderTemplate,
      status: 'active',
      name: 'New template'
    };

    db.providerTemplate.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(archivedProviderTemplate);
    db.providerTemplate.update.mockResolvedValue(activeProviderTemplate);
    providerTemplateBackingServiceMock.upsertProviderTemplateBackingFromIntegration.mockResolvedValue(
      {
        id: 'provider-template-1',
        integration: { id: 'integration-1' }
      }
    );

    let result = await providerTemplateService.createProviderTemplate({
      organization: organization as any,
      instance: instance as any,
      input: {
        integrationId: 'integration-1',
        name: 'New template',
        description: 'New description',
        metadata: { resurrected: true }
      }
    });

    expect(db.providerTemplate.create).not.toHaveBeenCalled();
    expect(db.providerTemplate.update).toHaveBeenCalledWith({
      where: { oid: 10n },
      data: {
        status: 'active',
        archivedAt: null,
        deletedAt: null,
        name: 'New template',
        description: 'New description',
        metadata: { resurrected: true },
        organizationOid: 1n,
        instanceOid: 2n,
        hasSubspaceBacking: true,
        subspaceIntegrationId: 'integration-1'
      }
    });
    expect(providerTemplateCreatedQueueAddMock).toHaveBeenCalledWith({
      providerTemplateId: 'provider-template-1'
    });
    expect(result).toBe(activeProviderTemplate);
  });
});
