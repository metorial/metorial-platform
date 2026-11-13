import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Organization, Project } from '@mtsrc/agent-tracking-db';
import { db, withTransaction } from '@mtsrc/agent-tracking-db';
import { getId } from '@mtsrc/agent-tracking-db';
import { Events } from '@mtsrc/agent-tracking-events';

class ProjectServiceImpl {
  async upsertProject(d: {
    organization: Organization;
    input: {
      ref: string;
      name?: string | null;
      recordRetentionDays?: number;
      contentRetentionDays?: number;
      usageRetentionDays?: number;
    };
  }) {
    let retention = {
      recordRetentionDays: d.input.recordRetentionDays,
      contentRetentionDays: d.input.contentRetentionDays,
      usageRetentionDays: d.input.usageRetentionDays
    };

    let project = await withTransaction(async db => {
      let existing = await db.project.findUnique({ where: { ref: d.input.ref } });
      if (existing) this.assertProjectChangeable(existing, d.organization);

      let project = await db.project.upsert({
        where: { ref: d.input.ref },
        create: {
          ...getId('project'),
          ref: d.input.ref,
          name: d.input.name,
          ...retention,
          organizationOid: d.organization.oid
        },
        update: { name: d.input.name, ...retention, archivedAt: null }
      });

      await db.instance.updateMany({
        where: { projectOid: project.oid },
        data: {
          recordRetentionDays: project.recordRetentionDays,
          contentRetentionDays: project.contentRetentionDays,
          usageRetentionDays: project.usageRetentionDays
        }
      });

      return project;
    });

    await this.fireChanged(project, 'upserted');

    return project;
  }

  async getProjectById(d: {
    organization: Organization;
    projectId: string;
    includeArchived?: boolean;
  }) {
    let project = await db.project.findFirst({
      where: {
        OR: [{ id: d.projectId }, { ref: d.projectId }],
        organizationOid: d.organization.oid,
        archivedAt: d.includeArchived ? undefined : null
      }
    });
    if (!project) throw new ServiceError(notFoundError('project'));

    return project;
  }

  async archiveProject(d: { project: Project }) {
    if (d.project.archivedAt) return d.project;

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: { archivedAt: new Date() }
    });

    await this.fireChanged(project, 'archived');

    return project;
  }

  private assertProjectChangeable(project: Project, organization: Organization) {
    if (project.organizationOid != organization.oid) {
      throw new ServiceError(
        conflictError({ message: 'The project ref belongs to another organization.' })
      );
    }
  }

  private async fireChanged(project: Project, change: 'upserted' | 'archived') {
    let [organization, instances] = await Promise.all([
      db.organization.findUniqueOrThrow({
        where: { oid: project.organizationOid },
        select: { id: true }
      }),
      db.instance.findMany({ where: { projectOid: project.oid }, select: { id: true } })
    ]);

    await Events.fire('scope.project.changed:after', {
      organizationId: organization.id,
      projectId: project.id,
      instanceIds: instances.map(instance => instance.id),
      change
    });
  }
}

export let projectService = Service.create(
  'projectService',
  () => new ProjectServiceImpl()
).build();
