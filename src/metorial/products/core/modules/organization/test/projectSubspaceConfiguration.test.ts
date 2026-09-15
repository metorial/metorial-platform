import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  ensureForProject: vi.fn(),
  upsertTenant: vi.fn(),
  projectUpdate: vi.fn(),
  fire: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial/db', () => ({
  db: { project: { update: mocks.projectUpdate } }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: mocks.fire }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  subspaceScopeService: { ensureForProject: mocks.ensureForProject },
  tenantService: { upsertTenant: mocks.upsertTenant }
}));

import { projectAuthConfigConfigurationService } from '../src/services/projectAuthConfigConfiguration';
import { projectDataRetentionConfigurationService } from '../src/services/projectDataRetentionConfiguration';
import { projectIntegrationNamingConfigurationService } from '../src/services/projectIntegrationNamingConfiguration';
import { projectToolCallingConfigurationService } from '../src/services/projectToolCallingConfiguration';

let tenant = {
  id: 'ten_1',
  name: 'Project',
  identifier: 'project-1',
  resourceTenantId: 'rtn_1',
  resourceTenantIdentifier: 'project-1',
  onlyAllowTrustedProviders: false,
  isWhitelabel: false,
  logRetentionInDays: 30,
  enforceSessionExpiry: false,
  allowAuthConfigExport: false,
  allowAuthConfigImport: false,
  onlyAllowOAuthAuthMethods: false,
  collectOperationDescriptionForToolCalls: true,
  messageProcessingTimeoutMs: 30000,
  useIntegrationNamesForSessionProviderNameTemplates: false,
  dataRetentionLevel: 'full',
  storeToolCallAttachments: true,
  collectErrors: true,
  disableCallbacks: false
};

let project = {
  id: 'prj_1',
  oid: 1n,
  status: 'active',
  consumerAuthClientRegistrationsPerHourLimit: 25,
  consumerAuthClientRegistrationsPerMinuteLimit: 10
};

let common = {
  project: project as any,
  organization: { id: 'org_1' } as any,
  auditScope: {} as any
};

describe('project integrations-backed configuration setters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureForProject.mockResolvedValue({ tenant });
  });

  it('mirrors auth configuration returned by integrations', async () => {
    let updatedTenant = {
      ...tenant,
      allowAuthConfigExport: true,
      allowAuthConfigImport: true,
      onlyAllowOAuthAuthMethods: true
    };
    let updatedProject = { ...project, ...updatedTenant };
    mocks.upsertTenant.mockResolvedValue(updatedTenant);
    mocks.projectUpdate.mockResolvedValue(updatedProject);

    await projectAuthConfigConfigurationService.updateProjectAuthConfigConfiguration({
      ...common,
      input: {
        allowAuthConfigExport: true,
        allowAuthConfigImport: true,
        onlyAllowOAuthAuthMethods: true
      }
    });

    expect(mocks.projectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 1n },
        data: expect.objectContaining({
          allowAuthConfigExport: true,
          allowAuthConfigImport: true,
          onlyAllowOAuthAuthMethods: true
        })
      })
    );
  });

  it('normalizes retention settings before mirroring them', async () => {
    let updatedTenant = {
      ...tenant,
      dataRetentionLevel: 'none',
      storeToolCallAttachments: false,
      collectErrors: false,
      disableCallbacks: true
    };
    mocks.upsertTenant.mockResolvedValue(updatedTenant);
    mocks.projectUpdate.mockResolvedValue({ ...project, ...updatedTenant });

    await projectDataRetentionConfigurationService.updateProjectDataRetentionConfiguration({
      ...common,
      input: {
        dataRetentionLevel: 'none',
        storeToolCallAttachments: true,
        collectErrors: false,
        disableCallbacks: true
      }
    });

    expect(mocks.upsertTenant).toHaveBeenCalledWith({
      input: expect.objectContaining({
        dataRetentionLevel: 'none',
        storeToolCallAttachments: false,
        collectErrors: false,
        disableCallbacks: true
      })
    });
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        dataRetentionLevel: 'none',
        storeToolCallAttachments: false,
        collectErrors: false,
        disableCallbacks: true
      }
    });
  });

  it('mirrors tool-calling configuration returned by integrations', async () => {
    let updatedTenant = {
      ...tenant,
      collectOperationDescriptionForToolCalls: false,
      messageProcessingTimeoutMs: 12000
    };
    mocks.upsertTenant.mockResolvedValue(updatedTenant);
    mocks.projectUpdate.mockResolvedValue({ ...project, ...updatedTenant });

    await projectToolCallingConfigurationService.updateProjectToolCallingConfiguration({
      ...common,
      input: {
        collectOperationDescriptionForToolCalls: false,
        messageProcessingTimeoutMs: 12000
      }
    });

    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        collectOperationDescriptionForToolCalls: false,
        messageProcessingTimeoutMs: 12000
      }
    });
  });

  it('mirrors integration naming configuration returned by integrations', async () => {
    let updatedTenant = {
      ...tenant,
      useIntegrationNamesForSessionProviderNameTemplates: true
    };
    mocks.upsertTenant.mockResolvedValue(updatedTenant);
    mocks.projectUpdate.mockResolvedValue({ ...project, ...updatedTenant });

    await projectIntegrationNamingConfigurationService.updateProjectIntegrationNamingConfiguration(
      {
        ...common,
        input: { useIntegrationNames: true }
      }
    );

    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        useIntegrationNamesForSessionProviderNameTemplates: true
      }
    });
  });
});
