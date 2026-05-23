import { forbiddenError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import { Context } from '@metorial/context';
import {
  addAfterTransactionHook,
  Organization,
  OrganizationActor,
  Project,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { syncSubspaceTenantQueue } from '../queues/syncSubspaceTenant';

class ProjectRetentionService {
  private async ensureProjectActive(project: Project) {
    if (project.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted project'
        })
      );
    }
  }

  async getProjectRetention(d: { project: Project }) {
    await this.ensureProjectActive(d.project);

    return {
      logRetentionInDays: d.project.logRetentionInDays,
      enforceSessionExpiry: d.project.enforceSessionExpiry
    };
  }

  async updateProjectRetention(d: {
    project: Project;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      logRetentionInDays?: number;
      enforceSessionExpiry?: boolean;
    };
  }) {
    await this.ensureProjectActive(d.project);

    return withTransaction(async db => {
      await Fabric.fire('organization.project.retention.updated:before', d);

      let project = await db.project.update({
        where: { oid: d.project.oid },
        data: {
          logRetentionInDays: d.input.logRetentionInDays,
          enforceSessionExpiry: d.input.enforceSessionExpiry
        },
        include: {
          organization: true
        }
      });

      await addAfterTransactionHook(() =>
        syncSubspaceTenantQueue.add({ projectId: project.id })
      );

      await Fabric.fire('organization.project.retention.updated:after', {
        ...d,
        project
      });

      return project;
    });
  }
}

export let projectRetentionService = Service.create(
  'projectRetentionService',
  () => new ProjectRetentionService()
).build();
