import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, getId, type Organization, type Project } from '@mtsrc/ai-gateway-db';
import { Events, type ScopeChange } from '@mtsrc/ai-gateway-events';

class ProjectServiceImpl {
  async upsertProject(d: {
    organization: Organization;
    input: { ref: string; name?: string | null };
  }) {
    let existing = await db.project.findUnique({ where: { ref: d.input.ref } });
    if (existing) this.assertProjectChangeable(existing, d.organization);

    let project = await db.project.upsert({
      where: { ref: d.input.ref },
      create: {
        ...getId('project'),
        ref: d.input.ref,
        name: d.input.name,
        organizationOid: d.organization.oid
      },
      update: { name: d.input.name, archivedAt: null }
    });

    await this.fireChanged(project, d.organization, 'upserted');

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

  async archiveProject(d: { organization: Organization; project: Project }) {
    if (d.project.archivedAt) return d.project;

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: { archivedAt: new Date() }
    });

    await this.fireChanged(project, d.organization, 'archived');

    return project;
  }

  private assertProjectChangeable(project: Project, organization: Organization) {
    if (project.organizationOid != organization.oid) {
      throw new ServiceError(
        conflictError({ message: 'The project ref belongs to another organization.' })
      );
    }
  }

  private async fireChanged(
    project: Project,
    organization: Organization,
    change: ScopeChange
  ) {
    let instances = await db.instance.findMany({
      where: { projectOid: project.oid },
      select: { id: true }
    });

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
