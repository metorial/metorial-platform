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

class ProjectAuthConfigConfigurationService {
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

  async getProjectAuthConfigConfiguration(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    return {
      allowAuthConfigExport: tenant.allowAuthConfigExport,
      allowAuthConfigImport: tenant.allowAuthConfigImport
    };
  }

  async updateProjectAuthConfigConfiguration(d: {
    project: Project;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      allowAuthConfigExport?: boolean;
      allowAuthConfigImport?: boolean;
    };
  }) {
    await this.ensureProjectActive(d.project);

    await Fabric.fire('organization.project.auth_config_configuration.updated:before', d);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    let updatedTenant = await subspaceTenantService.upsert({
      name: tenant.name,
      identifier: tenant.identifier,
      environments: [],
      allowAuthConfigExport:
        d.input.allowAuthConfigExport ?? tenant.allowAuthConfigExport,
      allowAuthConfigImport:
        d.input.allowAuthConfigImport ?? tenant.allowAuthConfigImport
    });

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: { updatedAt: new Date() }
    });

    await Fabric.fire('organization.project.auth_config_configuration.updated:after', {
      ...d,
      project,
      configuration: {
        allowAuthConfigExport: updatedTenant.allowAuthConfigExport,
        allowAuthConfigImport: updatedTenant.allowAuthConfigImport
      }
    });

    return {
      allowAuthConfigExport: updatedTenant.allowAuthConfigExport,
      allowAuthConfigImport: updatedTenant.allowAuthConfigImport
    };
  }
}

export let projectAuthConfigConfigurationService = Service.create(
  'projectAuthConfigConfigurationService',
  () => new ProjectAuthConfigConfigurationService()
).build();
