import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Organization, Project } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { subspaceScopeService, tenantService } from '@metorial-subspace/module-tenant';

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
    let { tenant } = await subspaceScopeService.ensureForProject(project);
    return tenant;
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
    auditScope: AuditScope;
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

    let updatedTenant = await tenantService.upsertTenant({
      input: {
        name: tenant.name,
        identifier: tenant.identifier,
        resourceTenantId: tenant.resourceTenantId!,
        resourceTenantIdentifier: tenant.resourceTenantIdentifier!,
        environments: [],
        onlyAllowTrustedProviders: tenant.onlyAllowTrustedProviders,
        isWhitelabel: tenant.isWhitelabel,
        logRetentionInDays: tenant.logRetentionInDays,
        enforceSessionExpiry: tenant.enforceSessionExpiry,
        allowAuthConfigExport: tenant.allowAuthConfigExport,
        allowAuthConfigImport: tenant.allowAuthConfigImport,
        collectOperationDescriptionForToolCalls:
          tenant.collectOperationDescriptionForToolCalls,
        useIntegrationNamesForSessionProviderNameTemplates:
          d.input.useIntegrationNames ??
          tenant.useIntegrationNamesForSessionProviderNameTemplates
      }
    });

    await Fabric.fire('organization.project.integration_naming_configuration.updated:after', {
      organization: d.organization,
      input: d.input,
      project: d.project,
      configuration: {
        useIntegrationNames: updatedTenant.useIntegrationNamesForSessionProviderNameTemplates
      },
      previousConfiguration: {
        useIntegrationNames: tenant.useIntegrationNamesForSessionProviderNameTemplates
      },
      auditScope: d.auditScope
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
