import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  projectFindUnique: vi.fn(),
  projectUpdate: vi.fn(),
  getTenantById: vi.fn()
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => ({ config, handler }))
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((config: any) => ({
    name: config.name,
    add: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn((handler: any) => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(processors => processors)
}));

vi.mock('@metorial/db', () => ({
  db: {
    project: {
      findMany: mocks.projectFindMany,
      findUnique: mocks.projectFindUnique,
      update: mocks.projectUpdate
    }
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  tenantService: { getTenantById: mocks.getTenantById }
}));

import {
  RECONCILE_PROJECT_SUBSPACE_CONFIGURATION_BATCH_SIZE,
  reconcileProjectSubspaceConfigurationManyQueue,
  reconcileProjectSubspaceConfigurationManyQueueProcessor,
  reconcileProjectSubspaceConfigurationSingleQueue,
  reconcileProjectSubspaceConfigurationSingleQueueProcessor
} from '../src/queues/reconcileProjectSubspaceConfiguration';

let baseConfiguration = {
  allowAuthConfigExport: false,
  allowAuthConfigImport: false,
  onlyAllowOAuthAuthMethods: false,
  dataRetentionLevel: 'full',
  storeToolCallAttachments: true,
  collectErrors: true,
  disableCallbacks: false,
  collectOperationDescriptionForToolCalls: true,
  messageProcessingTimeoutMs: 30000,
  useIntegrationNamesForSessionProviderNameTemplates: false
};

describe('project subspace configuration reconciler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pages active linked projects and fans out deterministic jobs', async () => {
    let projects = Array.from(
      { length: RECONCILE_PROJECT_SUBSPACE_CONFIGURATION_BATCH_SIZE },
      (_, index) => ({ id: `prj_${String(index).padStart(3, '0')}` })
    );
    mocks.projectFindMany.mockResolvedValue(projects);

    await (reconcileProjectSubspaceConfigurationManyQueueProcessor as any).handler({
      cursor: 'prj_before'
    });

    expect(mocks.projectFindMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        subspaceTenantId: { not: null },
        id: { gt: 'prj_before' }
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_PROJECT_SUBSPACE_CONFIGURATION_BATCH_SIZE,
      select: { id: true }
    });
    expect(
      reconcileProjectSubspaceConfigurationSingleQueue.addManyWithOps
    ).toHaveBeenCalledWith(
      projects.map(project => ({
        data: { projectId: project.id },
        opts: { id: `project-subspace-configuration-${project.id}` }
      }))
    );
    expect(reconcileProjectSubspaceConfigurationManyQueue.add).toHaveBeenCalledWith({
      cursor: projects[projects.length - 1]!.id
    });
  });

  it('copies authoritative tenant settings when the project mirror has drifted', async () => {
    let project = {
      id: 'prj_1',
      oid: 1n,
      status: 'active',
      subspaceTenantId: 'ten_1',
      ...baseConfiguration,
      disableCallbacks: false
    };
    let tenant = {
      ...baseConfiguration,
      disableCallbacks: true,
      dataRetentionLevel: 'none',
      storeToolCallAttachments: false
    };
    mocks.projectFindUnique.mockResolvedValue(project);
    mocks.getTenantById.mockResolvedValue(tenant);

    await (reconcileProjectSubspaceConfigurationSingleQueueProcessor as any).handler({
      projectId: project.id
    });

    expect(mocks.getTenantById).toHaveBeenCalledWith({ id: 'ten_1' });
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: tenant
    });
  });

  it('does not write when the project mirror already matches', async () => {
    mocks.projectFindUnique.mockResolvedValue({
      id: 'prj_1',
      oid: 1n,
      status: 'active',
      subspaceTenantId: 'ten_1',
      ...baseConfiguration
    });
    mocks.getTenantById.mockResolvedValue(baseConfiguration);

    await (reconcileProjectSubspaceConfigurationSingleQueueProcessor as any).handler({
      projectId: 'prj_1'
    });

    expect(mocks.projectUpdate).not.toHaveBeenCalled();
  });

  it('skips inactive or unlinked projects', async () => {
    mocks.projectFindUnique.mockResolvedValue({
      id: 'prj_1',
      status: 'deleted',
      subspaceTenantId: 'ten_1'
    });

    await (reconcileProjectSubspaceConfigurationSingleQueueProcessor as any).handler({
      projectId: 'prj_1'
    });

    expect(mocks.getTenantById).not.toHaveBeenCalled();
    expect(mocks.projectUpdate).not.toHaveBeenCalled();
  });
});
