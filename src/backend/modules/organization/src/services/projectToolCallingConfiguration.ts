import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import { db, Organization, OrganizationActor, Project } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  getTenantForSubspace,
  subspaceTenantService,
  syncSubspaceTenantForProject
} from '@metorial/module-subspace';

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
    await syncSubspaceTenantForProject(project);

    let instance = await db.instance.findFirst({
      where: { projectOid: project.oid },
      orderBy: { createdAt: 'asc' }
    });
    if (!instance) {
      throw new ServiceError(
        forbiddenError({
          message: 'Project has no instances'
        })
      );
    }

    let { tenant, environmentId } = await getTenantForSubspace(instance);

    return subspaceTenantService.get({
      tenantId: tenant.id,
      environmentId
    });
  }

  async getProjectToolCallingConfiguration(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    return {
      collectOperationDescriptionForToolCalls: tenant.collectOperationDescriptionForToolCalls
    };
  }

  async updateProjectToolCallingConfiguration(d: {
    project: Project;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      collectOperationDescriptionForToolCalls?: boolean;
    };
  }) {
    await this.ensureProjectActive(d.project);

    await Fabric.fire('organization.project.tool_calling_configuration.updated:before', d);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    let updatedTenant = await subspaceTenantService.upsert({
      name: tenant.name,
      identifier: tenant.identifier,
      environments: [],
      collectOperationDescriptionForToolCalls:
        d.input.collectOperationDescriptionForToolCalls ??
        tenant.collectOperationDescriptionForToolCalls
    });

    await Fabric.fire('organization.project.tool_calling_configuration.updated:after', {
      ...d,
      configuration: {
        collectOperationDescriptionForToolCalls:
          updatedTenant.collectOperationDescriptionForToolCalls
      }
    });

    return {
      collectOperationDescriptionForToolCalls:
        updatedTenant.collectOperationDescriptionForToolCalls
    };
  }
}

export let projectToolCallingConfigurationService = Service.create(
  'projectToolCallingConfigurationService',
  () => new ProjectToolCallingConfigurationService()
).build();
