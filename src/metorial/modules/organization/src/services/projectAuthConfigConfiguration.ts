import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { db, Organization, Project } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { subspaceScopeService, tenantService } from '@metorial-subspace/module-tenant';

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
    let { tenant } = await subspaceScopeService.ensureForProject(project);
    return tenant;
  }

  async getProjectAuthConfigConfiguration(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    return {
      allowAuthConfigExport: tenant.allowAuthConfigExport,
      allowAuthConfigImport: tenant.allowAuthConfigImport,

      consumerAuthClientRegistrationsPerHourLimit:
        d.project.consumerAuthClientRegistrationsPerHourLimit,
      consumerAuthClientRegistrationsPerMinuteLimit:
        d.project.consumerAuthClientRegistrationsPerMinuteLimit
    };
  }

  async updateProjectAuthConfigConfiguration(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      allowAuthConfigExport?: boolean;
      allowAuthConfigImport?: boolean;

      consumerAuthClientRegistrationsPerHourLimit?: number;
      consumerAuthClientRegistrationsPerMinuteLimit?: number;
    };
  }) {
    await this.ensureProjectActive(d.project);

    await Fabric.fire('organization.project.auth_config_configuration.updated:before', d);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    let updatedTenant = await tenantService.upsertTenant({
      input: {
        name: tenant.name,
        identifier: tenant.identifier,
        resourceTenantId: tenant.resourceTenantId!,
        resourceTenantIdentifier: tenant.resourceTenantIdentifier!,
        environments: [],
        allowAuthConfigExport: d.input.allowAuthConfigExport ?? tenant.allowAuthConfigExport,
        allowAuthConfigImport: d.input.allowAuthConfigImport ?? tenant.allowAuthConfigImport
      }
    });

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: {
        consumerAuthClientRegistrationsPerHourLimit:
          d.input.consumerAuthClientRegistrationsPerHourLimit,
        consumerAuthClientRegistrationsPerMinuteLimit:
          d.input.consumerAuthClientRegistrationsPerMinuteLimit
      }
    });

    await Fabric.fire('organization.project.auth_config_configuration.updated:after', {
      organization: d.organization,
      input: d.input,
      project,
      previousProject: d.project,
      configuration: {
        allowAuthConfigExport: updatedTenant.allowAuthConfigExport,
        allowAuthConfigImport: updatedTenant.allowAuthConfigImport
      },
      previousConfiguration: {
        allowAuthConfigExport: tenant.allowAuthConfigExport,
        allowAuthConfigImport: tenant.allowAuthConfigImport
      },
      auditScope: d.auditScope
    });

    return {
      allowAuthConfigExport: updatedTenant.allowAuthConfigExport,
      allowAuthConfigImport: updatedTenant.allowAuthConfigImport,

      consumerAuthClientRegistrationsPerHourLimit:
        project.consumerAuthClientRegistrationsPerHourLimit,
      consumerAuthClientRegistrationsPerMinuteLimit:
        project.consumerAuthClientRegistrationsPerMinuteLimit
    };
  }
}

export let projectAuthConfigConfigurationService = Service.create(
  'projectAuthConfigConfigurationService',
  () => new ProjectAuthConfigConfigurationService()
).build();
