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
      aiAnalysisEnabled: tenant.aiAnalysisEnabled,
      skillReviewHoldPending: d.project.skillReviewHoldPending
    };
  }

  async updateProjectAiAnalysisConfiguration(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      aiAnalysisEnabled?: boolean;
      skillReviewHoldPending?: boolean;
    };
  }) {
    await this.ensureProjectActive(d.project);

    await Fabric.fire('organization.project.ai_analysis_configuration.updated:before', d);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    let updatedTenant = await tenantService.upsertTenant({
      input: {
        name: tenant.name,
        identifier: tenant.identifier,
        resourceTenantId: tenant.resourceTenantId!,
        resourceTenantIdentifier: tenant.resourceTenantIdentifier!,
        environments: [],
        aiAnalysisEnabled: d.input.aiAnalysisEnabled ?? tenant.aiAnalysisEnabled
      }
    });

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: {
        aiAnalysisEnabled: updatedTenant.aiAnalysisEnabled,
        skillReviewHoldPending: d.input.skillReviewHoldPending
      }
    });

    await Fabric.fire('organization.project.ai_analysis_configuration.updated:after', {
      organization: d.organization,
      input: d.input,
      project,
      configuration: {
        aiAnalysisEnabled: project.aiAnalysisEnabled,
        skillReviewHoldPending: project.skillReviewHoldPending
      },
      previousConfiguration: {
        aiAnalysisEnabled: tenant.aiAnalysisEnabled,
        skillReviewHoldPending: d.project.skillReviewHoldPending
      },
      auditScope: d.auditScope
    });

    return {
      aiAnalysisEnabled: project.aiAnalysisEnabled,
      skillReviewHoldPending: project.skillReviewHoldPending
    };
  }
}

export let projectAiAnalysisConfigurationService = Service.create(
  'projectAiAnalysisConfigurationService',
  () => new ProjectAiAnalysisConfigurationService()
).build();
