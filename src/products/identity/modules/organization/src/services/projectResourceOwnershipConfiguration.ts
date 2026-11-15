import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { db, Organization, Project } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { subspaceScopeService, tenantService } from '@metorial-subspace/module-tenant';

class ProjectResourceOwnershipConfigurationService {
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

  async getProjectResourceOwnershipConfiguration(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    return {
      allowApiAccessToConsumerOwnedResources: tenant.allowApiAccessToConsumerOwnedResources,
      allowMemberAccessToConsumerOwnedResources:
        tenant.allowMemberAccessToConsumerOwnedResources
    };
  }

  async updateProjectResourceOwnershipConfiguration(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      allowApiAccessToConsumerOwnedResources?: boolean;
      allowMemberAccessToConsumerOwnedResources?: boolean;
    };
  }) {
    await this.ensureProjectActive(d.project);

    await Fabric.fire(
      'organization.project.resource_ownership_configuration.updated:before',
      d
    );

    let tenant = await this.getSubspaceTenantForProject(d.project);

    let updatedTenant = await tenantService.upsertTenant({
      input: {
        name: tenant.name,
        identifier: tenant.identifier,
        resourceTenantId: tenant.resourceTenantId!,
        resourceTenantIdentifier: tenant.resourceTenantIdentifier!,
        environments: [],
        allowApiAccessToConsumerOwnedResources:
          d.input.allowApiAccessToConsumerOwnedResources ??
          tenant.allowApiAccessToConsumerOwnedResources,
        allowMemberAccessToConsumerOwnedResources:
          d.input.allowMemberAccessToConsumerOwnedResources ??
          tenant.allowMemberAccessToConsumerOwnedResources
      }
    });

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: {
        allowApiAccessToConsumerOwnedResources:
          updatedTenant.allowApiAccessToConsumerOwnedResources,
        allowMemberAccessToConsumerOwnedResources:
          updatedTenant.allowMemberAccessToConsumerOwnedResources
      }
    });

    let configuration = {
      allowApiAccessToConsumerOwnedResources: project.allowApiAccessToConsumerOwnedResources,
      allowMemberAccessToConsumerOwnedResources:
        project.allowMemberAccessToConsumerOwnedResources
    };

    await Fabric.fire('organization.project.resource_ownership_configuration.updated:after', {
      organization: d.organization,
      input: d.input,
      project,
      configuration,
      previousConfiguration: {
        allowApiAccessToConsumerOwnedResources: tenant.allowApiAccessToConsumerOwnedResources,
        allowMemberAccessToConsumerOwnedResources:
          tenant.allowMemberAccessToConsumerOwnedResources
      },
      auditScope: d.auditScope
    });

    return configuration;
  }
}

export let projectResourceOwnershipConfigurationService = Service.create(
  'projectResourceOwnershipConfigurationService',
  () => new ProjectResourceOwnershipConfigurationService()
).build();
