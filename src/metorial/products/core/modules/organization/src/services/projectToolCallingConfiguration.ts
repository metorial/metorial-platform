import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { db, Organization, Project } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { subspaceScopeService, tenantService } from '@metorial-subspace/module-tenant';

class ProjectToolCallingConfigurationService {
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

  async getProjectToolCallingConfiguration(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    return {
      collectOperationDescriptionForToolCalls: tenant.collectOperationDescriptionForToolCalls,
      messageProcessingTimeoutMs: tenant.messageProcessingTimeoutMs
    };
  }

  async updateProjectToolCallingConfiguration(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      collectOperationDescriptionForToolCalls?: boolean;
      messageProcessingTimeoutMs?: number;
    };
  }) {
    await this.ensureProjectActive(d.project);

    await Fabric.fire('organization.project.tool_calling_configuration.updated:before', d);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    let updatedTenant = await tenantService.upsertTenant({
      input: {
        name: tenant.name,
        identifier: tenant.identifier,
        resourceTenantId: tenant.resourceTenantId!,
        resourceTenantIdentifier: tenant.resourceTenantIdentifier!,
        environments: [],
        collectOperationDescriptionForToolCalls:
          d.input.collectOperationDescriptionForToolCalls ??
          tenant.collectOperationDescriptionForToolCalls,
        messageProcessingTimeoutMs:
          d.input.messageProcessingTimeoutMs ?? tenant.messageProcessingTimeoutMs
      }
    });

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: {
        collectOperationDescriptionForToolCalls:
          updatedTenant.collectOperationDescriptionForToolCalls,
        messageProcessingTimeoutMs: updatedTenant.messageProcessingTimeoutMs
      }
    });

    await Fabric.fire('organization.project.tool_calling_configuration.updated:after', {
      organization: d.organization,
      input: d.input,
      project,
      configuration: {
        collectOperationDescriptionForToolCalls:
          project.collectOperationDescriptionForToolCalls,
        messageProcessingTimeoutMs: project.messageProcessingTimeoutMs
      },
      previousConfiguration: {
        collectOperationDescriptionForToolCalls:
          tenant.collectOperationDescriptionForToolCalls,
        messageProcessingTimeoutMs: tenant.messageProcessingTimeoutMs ?? 0
      },
      auditScope: d.auditScope
    });

    return {
      collectOperationDescriptionForToolCalls: project.collectOperationDescriptionForToolCalls,
      messageProcessingTimeoutMs: project.messageProcessingTimeoutMs
    };
  }
}

export let projectToolCallingConfigurationService = Service.create(
  'projectToolCallingConfigurationService',
  () => new ProjectToolCallingConfigurationService()
).build();
