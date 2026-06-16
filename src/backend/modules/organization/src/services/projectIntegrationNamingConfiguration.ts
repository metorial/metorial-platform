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

class ProjectIntegrationNamingConfigurationService {
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

  async getProjectIntegrationNamingConfiguration(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    return {
      useIntegrationNames: tenant.useIntegrationNamesForSessionProviderNameTemplates
    };
  }

  async updateProjectIntegrationNamingConfiguration(d: {
    project: Project;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      useIntegrationNames?: boolean;
    };
  }) {
    await this.ensureProjectActive(d.project);

    await Fabric.fire(
      'organization.project.integration_naming_configuration.updated:before',
      d
    );

    let tenant = await this.getSubspaceTenantForProject(d.project);

    let updatedTenant = await subspaceTenantService.upsert({
      name: tenant.name,
      identifier: tenant.identifier,
      environments: [],
      onlyAllowTrustedProviders: tenant.onlyAllowTrustedProviders,
      isWhitelabel: tenant.isWhitelabel,
      logRetentionInDays: tenant.logRetentionInDays,
      enforceSessionExpiry: tenant.enforceSessionExpiry,
      allowAuthConfigExport: tenant.allowAuthConfigExport,
      allowAuthConfigImport: tenant.allowAuthConfigImport,
      collectOperationDescriptionForToolCalls: tenant.collectOperationDescriptionForToolCalls,
      useIntegrationNamesForSessionProviderNameTemplates:
        d.input.useIntegrationNames ??
        tenant.useIntegrationNamesForSessionProviderNameTemplates
    });

    await Fabric.fire('organization.project.integration_naming_configuration.updated:after', {
      ...d,
      configuration: {
        useIntegrationNames: updatedTenant.useIntegrationNamesForSessionProviderNameTemplates
      }
    });

    return {
      useIntegrationNames: updatedTenant.useIntegrationNamesForSessionProviderNameTemplates
    };
  }
}

export let projectIntegrationNamingConfigurationService = Service.create(
  'projectIntegrationNamingConfigurationService',
  () => new ProjectIntegrationNamingConfigurationService()
).build();
