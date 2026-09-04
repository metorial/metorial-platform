import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Organization, Project } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import type { SessionDataRetentionLevel } from '@metorial-subspace/db';
import { subspaceScopeService, tenantService } from '@metorial-subspace/module-tenant';

class ProjectDataRetentionConfigurationService {
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

  async getProjectDataRetentionConfiguration(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    return {
      dataRetentionLevel: tenant.dataRetentionLevel,
      storeToolCallAttachments: tenant.storeToolCallAttachments,
      collectErrors: tenant.collectErrors
    };
  }

  async updateProjectDataRetentionConfiguration(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      dataRetentionLevel?: SessionDataRetentionLevel;
      storeToolCallAttachments?: boolean;
      collectErrors?: boolean;
    };
  }) {
    await this.ensureProjectActive(d.project);

    await Fabric.fire('organization.project.data_retention_configuration.updated:before', d);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    let dataRetentionLevel = d.input.dataRetentionLevel ?? tenant.dataRetentionLevel;
    let isFull = dataRetentionLevel === 'full';

    let storeToolCallAttachments =
      dataRetentionLevel === 'none'
        ? false
        : (d.input.storeToolCallAttachments ?? tenant.storeToolCallAttachments);

    let collectErrors = isFull ? true : (d.input.collectErrors ?? tenant.collectErrors);

    let updatedTenant = await tenantService.upsertTenant({
      input: {
        name: tenant.name,
        identifier: tenant.identifier,
        resourceTenantId: tenant.resourceTenantId!,
        resourceTenantIdentifier: tenant.resourceTenantIdentifier!,
        environments: [],
        dataRetentionLevel,
        storeToolCallAttachments,
        collectErrors
      }
    });

    await Fabric.fire('organization.project.data_retention_configuration.updated:after', {
      organization: d.organization,
      input: d.input,
      project: d.project,
      configuration: {
        dataRetentionLevel: updatedTenant.dataRetentionLevel,
        storeToolCallAttachments: updatedTenant.storeToolCallAttachments,
        collectErrors: updatedTenant.collectErrors
      },
      previousConfiguration: {
        dataRetentionLevel: tenant.dataRetentionLevel,
        storeToolCallAttachments: tenant.storeToolCallAttachments,
        collectErrors: tenant.collectErrors
      },
      auditScope: d.auditScope
    });

    return {
      dataRetentionLevel: updatedTenant.dataRetentionLevel,
      storeToolCallAttachments: updatedTenant.storeToolCallAttachments,
      collectErrors: updatedTenant.collectErrors
    };
  }
}

export let projectDataRetentionConfigurationService = Service.create(
  'projectDataRetentionConfigurationService',
  () => new ProjectDataRetentionConfigurationService()
).build();
