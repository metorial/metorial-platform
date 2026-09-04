import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { db, Organization, Project } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { reconcileProjectOrganizationMembers } from '../queues/reconcileOrganizationMembers';

class ProjectWorkforceConfigurationService {
  private ensureProjectActive(project: Project) {
    if (project.status !== 'active') {
      throw new ServiceError(
        forbiddenError({ message: 'Cannot perform this action on a deleted project' })
      );
    }
  }

  async getProjectWorkforceConfiguration(d: { project: Project }) {
    this.ensureProjectActive(d.project);
    return d.project;
  }

  async updateProjectWorkforceConfiguration(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: { autoAddOrganizationMembersToPortals?: boolean };
  }) {
    this.ensureProjectActive(d.project);
    await Fabric.fire('organization.project.workforce_configuration.updated:before', d);

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: {
        autoAddOrganizationMembersToPortals: d.input.autoAddOrganizationMembersToPortals
      }
    });

    await Fabric.fire('organization.project.workforce_configuration.updated:after', {
      ...d,
      project,
      previousProject: d.project
    });

    if (
      !d.project.autoAddOrganizationMembersToPortals &&
      project.autoAddOrganizationMembersToPortals
    ) {
      await reconcileProjectOrganizationMembers(project.id);
    }

    return project;
  }
}

export let projectWorkforceConfigurationService = Service.create(
  'projectWorkforceConfigurationService',
  () => new ProjectWorkforceConfigurationService()
).build();
