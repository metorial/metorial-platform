import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { db, Organization, Project } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { subspaceScopeService, tenantService } from '@metorial-subspace/module-tenant';

class ProjectReducedSubprocessorsConfigurationService {
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

  async getProjectReducedSubprocessorsConfiguration(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    let tenant = await this.getSubspaceTenantForProject(d.project);

    return {
      reducedSubprocessors: tenant.reducedSubprocessors
    };
  }

  async updateProjectReducedSubprocessorsConfiguration(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      reducedSubprocessors?: boolean;
    };
  }) {
    await this.ensureProjectActive(d.project);

    await Fabric.fire(
      'organization.project.reduced_subprocessors_configuration.updated:before',
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
        reducedSubprocessors: d.input.reducedSubprocessors ?? tenant.reducedSubprocessors
      }
    });

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: {
        reducedSubprocessors: updatedTenant.reducedSubprocessors
      }
    });

    await Fabric.fire(
      'organization.project.reduced_subprocessors_configuration.updated:after',
      {
        organization: d.organization,
        input: d.input,
        project,
        configuration: {
          reducedSubprocessors: project.reducedSubprocessors
        },
        previousConfiguration: {
          reducedSubprocessors: tenant.reducedSubprocessors
        },
        auditScope: d.auditScope
      }
    );

    return {
      reducedSubprocessors: project.reducedSubprocessors
    };
  }
}

export let projectReducedSubprocessorsConfigurationService = Service.create(
  'projectReducedSubprocessorsConfigurationService',
  () => new ProjectReducedSubprocessorsConfigurationService()
).build();
