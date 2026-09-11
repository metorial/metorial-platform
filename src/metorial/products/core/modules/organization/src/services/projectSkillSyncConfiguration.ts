import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Organization, Project, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';

class ProjectSkillSyncConfigurationService {
  private async ensureProjectActive(project: Project) {
    if (project.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted project'
        })
      );
    }
  }

  async getProjectSkillSyncConfiguration(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    return {
      skillSyncGitLfsThresholdBytes: d.project.skillSyncGitLfsThresholdBytes
    };
  }

  async updateProjectSkillSyncConfiguration(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      skillSyncGitLfsThresholdBytes?: number | null;
    };
  }) {
    await this.ensureProjectActive(d.project);

    return withTransaction(async db => {
      await Fabric.fire('organization.project.skill_sync_configuration.updated:before', d);

      let project = await db.project.update({
        where: { oid: d.project.oid },
        data: {
          skillSyncGitLfsThresholdBytes: d.input.skillSyncGitLfsThresholdBytes
        },
        include: {
          organization: true
        }
      });

      await Fabric.fire('organization.project.skill_sync_configuration.updated:after', {
        organization: d.organization,
        input: d.input,
        project,
        previousProject: d.project,
        auditScope: d.auditScope
      });

      return project;
    });
  }
}

export let projectSkillSyncConfigurationService = Service.create(
  'projectSkillSyncConfigurationService',
  () => new ProjectSkillSyncConfigurationService()
).build();
