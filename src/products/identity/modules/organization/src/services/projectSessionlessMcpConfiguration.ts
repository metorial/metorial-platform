import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { db, Organization, Project } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  resolveSessionlessMcpEnabled,
  subspaceScopeService,
  tenantService
} from '@metorial-subspace/module-tenant';

class ProjectSessionlessMcpConfigurationServiceImpl {
  private async ensureProjectActive(project: Project) {
    if (project.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted project'
        })
      );
    }
  }

  async getProjectSessionlessMcpConfiguration(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    return {
      sessionlessMcpEnabled: resolveSessionlessMcpEnabled(d.project.sessionlessMcpEnabled)
    };
  }

  async updateProjectSessionlessMcpConfiguration(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      sessionlessMcpEnabled: boolean;
    };
  }) {
    await this.ensureProjectActive(d.project);

    await Fabric.fire('organization.project.sessionless_mcp_configuration.updated:before', d);

    let previousSessionlessMcpEnabled = resolveSessionlessMcpEnabled(
      d.project.sessionlessMcpEnabled
    );

    let { tenant } = await subspaceScopeService.ensureForProject(d.project);

    let updatedTenant = await tenantService.upsertTenant({
      input: {
        name: tenant.name,
        identifier: tenant.identifier,
        resourceTenantId: tenant.resourceTenantId!,
        resourceTenantIdentifier: tenant.resourceTenantIdentifier!,
        environments: [],
        sessionlessMcpEnabled: d.input.sessionlessMcpEnabled
      }
    });

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: {
        sessionlessMcpEnabled: updatedTenant.sessionlessMcpEnabled
      }
    });

    let sessionlessMcpEnabled = resolveSessionlessMcpEnabled(project.sessionlessMcpEnabled);

    await Fabric.fire('organization.project.sessionless_mcp_configuration.updated:after', {
      organization: d.organization,
      input: d.input,
      project,
      configuration: { sessionlessMcpEnabled },
      previousConfiguration: { sessionlessMcpEnabled: previousSessionlessMcpEnabled },
      auditScope: d.auditScope
    });

    return { sessionlessMcpEnabled };
  }
}

export let projectSessionlessMcpConfigurationService = Service.create(
  'projectSessionlessMcpConfigurationService',
  () => new ProjectSessionlessMcpConfigurationServiceImpl()
).build();
