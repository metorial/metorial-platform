import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { db, Organization, Project } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { subspaceScopeService, tenantService } from '@metorial-subspace/module-tenant';

class ProjectAiAnalysisConfigurationService {
  private async ensureProjectActive(project: Project) {
    if (project.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted project'
        })
      );
    }
  }

  private async getSubspaceTenantForProject(project: Project) {
    let { tenant } = await subspaceScopeService.ensureForProject(project);
    return tenant;
  }

  async getProjectAiAnalysisConfiguration(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    return {
      assistantEnabled: tenant.assistantEnabled,
      reducedSubprocessors: tenant.reducedSubprocessors,
      aiAnalysisEnabled: tenant.aiAnalysisEnabled,
      usageReviewsEnabled: tenant.usageReviewsEnabled,
      skillReviewHoldPending: d.project.skillReviewHoldPending
    };
  }

  async updateProjectAiAnalysisConfiguration(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      assistantEnabled?: boolean;
      aiAnalysisEnabled?: boolean;
      usageReviewsEnabled?: boolean;
      skillReviewHoldPending?: boolean;
    };
  }) {
    await this.ensureProjectActive(d.project);

    await Fabric.fire('organization.project.ai_analysis_configuration.updated:before', d);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    let aiAnalysisEnabled = d.input.aiAnalysisEnabled ?? tenant.aiAnalysisEnabled;
    let usageReviewsEnabled =
      aiAnalysisEnabled && (d.input.usageReviewsEnabled ?? tenant.usageReviewsEnabled);

    let updatedTenant = await tenantService.upsertTenant({
      input: {
        name: tenant.name,
        identifier: tenant.identifier,
        resourceTenantId: tenant.resourceTenantId!,
        resourceTenantIdentifier: tenant.resourceTenantIdentifier!,
        environments: [],
        assistantEnabled: d.input.assistantEnabled ?? tenant.assistantEnabled,
        aiAnalysisEnabled,
        usageReviewsEnabled
      }
    });

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: {
        assistantEnabled: updatedTenant.assistantEnabled,
        aiAnalysisEnabled: updatedTenant.aiAnalysisEnabled,
        usageReviewsEnabled: updatedTenant.usageReviewsEnabled,
        skillReviewHoldPending: d.input.skillReviewHoldPending
      }
    });

    await Fabric.fire('organization.project.ai_analysis_configuration.updated:after', {
      organization: d.organization,
      input: d.input,
      project,
      configuration: {
        assistantEnabled: project.assistantEnabled,
        reducedSubprocessors: project.reducedSubprocessors,
        aiAnalysisEnabled: project.aiAnalysisEnabled,
        usageReviewsEnabled: project.usageReviewsEnabled,
        skillReviewHoldPending: project.skillReviewHoldPending
      },
      previousConfiguration: {
        assistantEnabled: tenant.assistantEnabled,
        reducedSubprocessors: tenant.reducedSubprocessors,
        aiAnalysisEnabled: tenant.aiAnalysisEnabled,
        usageReviewsEnabled: tenant.usageReviewsEnabled,
        skillReviewHoldPending: d.project.skillReviewHoldPending
      },
      auditScope: d.auditScope
    });

    return {
      assistantEnabled: project.assistantEnabled,
      reducedSubprocessors: project.reducedSubprocessors,
      aiAnalysisEnabled: project.aiAnalysisEnabled,
      usageReviewsEnabled: project.usageReviewsEnabled,
      skillReviewHoldPending: project.skillReviewHoldPending
    };
  }
}

export let projectAiAnalysisConfigurationService = Service.create(
  'projectAiAnalysisConfigurationService',
  () => new ProjectAiAnalysisConfigurationService()
).build();
