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

import { projectAiAnalysisConfigurationService } from '../src/services/projectAiAnalysisConfiguration';
import { projectAuthConfigConfigurationService } from '../src/services/projectAuthConfigConfiguration';
import { projectDataRetentionConfigurationService } from '../src/services/projectDataRetentionConfiguration';
import { projectIntegrationNamingConfigurationService } from '../src/services/projectIntegrationNamingConfiguration';
import { projectReducedSubprocessorsConfigurationService } from '../src/services/projectReducedSubprocessorsConfiguration';
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
  disableCallbacks: false,
  reducedSubprocessors: false,
  assistantEnabled: true,
  aiAnalysisEnabled: false,
  usageReviewsEnabled: false
};

let project = {
  id: 'prj_1',
  oid: 1n,
  status: 'active',
  assistantEnabled: true,
  reducedSubprocessors: false,
  skillReviewHoldPending: false,
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

  it('mirrors reduced subprocessors configuration returned by integrations', async () => {
    let updatedTenant = {
      ...tenant,
      reducedSubprocessors: true
    };
    mocks.upsertTenant.mockResolvedValue(updatedTenant);
    mocks.projectUpdate.mockResolvedValue({ ...project, ...updatedTenant });

    await projectReducedSubprocessorsConfigurationService.updateProjectReducedSubprocessorsConfiguration(
      {
        ...common,
        input: { reducedSubprocessors: true }
      }
    );

    expect(mocks.upsertTenant).toHaveBeenCalledWith({
      input: expect.objectContaining({
        reducedSubprocessors: true
      })
    });
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        reducedSubprocessors: true
      }
    });
  });

  it('mirrors AI analysis configuration returned by integrations', async () => {
    let updatedTenant = {
      ...tenant,
      aiAnalysisEnabled: true
    };
    mocks.upsertTenant.mockResolvedValue(updatedTenant);
    mocks.projectUpdate.mockResolvedValue({ ...project, ...updatedTenant });

    let result =
      await projectAiAnalysisConfigurationService.updateProjectAiAnalysisConfiguration({
        ...common,
        input: { aiAnalysisEnabled: true }
      });

    expect(mocks.upsertTenant).toHaveBeenCalledWith({
      input: expect.objectContaining({
        aiAnalysisEnabled: true
      })
    });
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        assistantEnabled: true,
        aiAnalysisEnabled: true,
        usageReviewsEnabled: false,
        skillReviewHoldPending: undefined
      }
    });
    expect(mocks.fire).toHaveBeenCalledWith(
      'organization.project.ai_analysis_configuration.updated:after',
      expect.objectContaining({
        configuration: {
          assistantEnabled: true,
          reducedSubprocessors: false,
          aiAnalysisEnabled: true,
          usageReviewsEnabled: false,
          skillReviewHoldPending: false
        },
        previousConfiguration: {
          assistantEnabled: true,
          reducedSubprocessors: false,
          aiAnalysisEnabled: false,
          usageReviewsEnabled: false,
          skillReviewHoldPending: false
        }
      })
    );
    expect(result).toEqual({
      assistantEnabled: true,
      reducedSubprocessors: false,
      aiAnalysisEnabled: true,
      usageReviewsEnabled: false,
      skillReviewHoldPending: false
    });
  });

  it.each([true, false])(
    'persists the assistant preference %s independently of AI analysis',
    async assistantEnabled => {
      let updatedTenant = { ...tenant, assistantEnabled };
      mocks.upsertTenant.mockResolvedValue(updatedTenant);
      mocks.projectUpdate.mockResolvedValue({ ...project, ...updatedTenant });

      let result =
        await projectAiAnalysisConfigurationService.updateProjectAiAnalysisConfiguration({
          ...common,
          input: { assistantEnabled }
        });

      expect(mocks.upsertTenant).toHaveBeenCalledWith({
        input: expect.objectContaining({ assistantEnabled, aiAnalysisEnabled: false })
      });
      expect(mocks.projectUpdate).toHaveBeenCalledWith({
        where: { oid: project.oid },
        data: expect.objectContaining({ assistantEnabled })
      });
      expect(result.assistantEnabled).toBe(assistantEnabled);
      expect(mocks.fire).toHaveBeenCalledWith(
        'organization.project.ai_analysis_configuration.updated:after',
        expect.objectContaining({
          configuration: expect.objectContaining({ assistantEnabled }),
          previousConfiguration: expect.objectContaining({ assistantEnabled: true })
        })
      );
    }
  );

  it('returns the assistant preference and compliance restriction separately', async () => {
    mocks.ensureForProject.mockResolvedValue({
      tenant: { ...tenant, assistantEnabled: true, reducedSubprocessors: true }
    });

    let result =
      await projectAiAnalysisConfigurationService.getProjectAiAnalysisConfiguration(common);

    expect(result).toEqual(
      expect.objectContaining({
        assistantEnabled: true,
        reducedSubprocessors: true
      })
    );
  });

  it.each([
    {
      name: 'disabling AI analysis without specifying usage reviews',
      currentAi: true,
      currentUsage: true,
      input: { aiAnalysisEnabled: false },
      expectedAi: false,
      expectedUsage: false
    },
    {
      name: 'disabling AI analysis while requesting usage reviews',
      currentAi: true,
      currentUsage: true,
      input: { aiAnalysisEnabled: false, usageReviewsEnabled: true },
      expectedAi: false,
      expectedUsage: false
    },
    {
      name: 'requesting usage reviews while AI analysis is disabled',
      currentAi: false,
      currentUsage: false,
      input: { usageReviewsEnabled: true },
      expectedAi: false,
      expectedUsage: false
    },
    {
      name: 'updating an existing inconsistent configuration',
      currentAi: false,
      currentUsage: true,
      input: { skillReviewHoldPending: true },
      expectedAi: false,
      expectedUsage: false
    },
    {
      name: 'enabling AI analysis without re-enabling usage reviews',
      currentAi: false,
      currentUsage: false,
      input: { aiAnalysisEnabled: true },
      expectedAi: true,
      expectedUsage: false
    },
    {
      name: 'enabling both settings together',
      currentAi: false,
      currentUsage: false,
      input: { aiAnalysisEnabled: true, usageReviewsEnabled: true },
      expectedAi: true,
      expectedUsage: true
    },
    {
      name: 'disabling usage reviews independently',
      currentAi: true,
      currentUsage: true,
      input: { usageReviewsEnabled: false },
      expectedAi: true,
      expectedUsage: false
    }
  ])('enforces the AI dependency when $name', async testCase => {
    let currentTenant = {
      ...tenant,
      aiAnalysisEnabled: testCase.currentAi,
      usageReviewsEnabled: testCase.currentUsage
    };
    mocks.ensureForProject.mockResolvedValue({ tenant: currentTenant });
    mocks.upsertTenant.mockImplementation(async ({ input }) => ({
      ...currentTenant,
      ...input
    }));
    mocks.projectUpdate.mockImplementation(async ({ data }) => ({ ...project, ...data }));

    let result =
      await projectAiAnalysisConfigurationService.updateProjectAiAnalysisConfiguration({
        ...common,
        input: testCase.input
      });

    let expectedConfiguration = {
      aiAnalysisEnabled: testCase.expectedAi,
      usageReviewsEnabled: testCase.expectedUsage
    };

    expect(mocks.upsertTenant).toHaveBeenCalledWith({
      input: expect.objectContaining(expectedConfiguration)
    });
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { oid: project.oid },
      data: expect.objectContaining(expectedConfiguration)
    });
    expect(result).toEqual(expect.objectContaining(expectedConfiguration));
    expect(mocks.fire).toHaveBeenCalledWith(
      'organization.project.ai_analysis_configuration.updated:after',
      expect.objectContaining({
        configuration: expect.objectContaining(expectedConfiguration),
        previousConfiguration: expect.objectContaining({
          aiAnalysisEnabled: testCase.currentAi,
          usageReviewsEnabled: testCase.currentUsage
        })
      })
    );
  });
});
