import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, snowflake, type Organization, type Project } from '@mtsrc/ai-gateway-db';
import { Events, type ScopeChange } from '@mtsrc/ai-gateway-events';
import type { PlatformLimit, ProjectRestriction } from '@mtsrc/ai-gateway-spec';

let restrictionUpdate = (d: {
  restriction: ProjectRestriction;
  since: Date | null;
  reason: string | null;
}) => {
  let reason = d.restriction?.reason ?? null;

  return {
    since: d.restriction ? (d.since ?? new Date()) : null,
    reason,
    changed: !!d.restriction != !!d.since || reason != d.reason
  };
};

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
        oid: snowflake.nextId(),
        id: d.input.ref,
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

  async getProjectWithOrganization(d: { projectId: string }) {
    let project = await db.project.findFirst({
      where: { id: d.projectId, archivedAt: null },
      include: { organization: true }
    });
    if (!project) throw new ServiceError(notFoundError('project'));

    return project;
  }

  async listProjectsWithOrganization(d: { projectIds: string[] }) {
    return await db.project.findMany({
      where: { id: { in: d.projectIds } },
      include: { organization: true }
    });
  }

  async listProjectsForOrganizationRef(d: { organizationRef: string; projectRef?: string }) {
    return await db.project.findMany({
      where: {
        organization: { ref: d.organizationRef, archivedAt: null },
        ref: d.projectRef,
        archivedAt: null
      },
      include: { organization: true },
      orderBy: { oid: 'asc' }
    });
  }

  async syncPlatformLimits(d: {
    project: Project & { organization: Organization };
    limits: PlatformLimit[];
    disabled?: ProjectRestriction;
  }) {
    let limitsChanged = JSON.stringify(d.project.platformLimits) != JSON.stringify(d.limits);
    let disabled =
      d.disabled === undefined
        ? null
        : restrictionUpdate({
            restriction: d.disabled,
            since: d.project.disabledAt,
            reason: d.project.disabledReason
          });

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: {
        platformLimits: d.limits,
        platformLimitsSyncedAt: new Date(),
        ...(disabled ? { disabledAt: disabled.since, disabledReason: disabled.reason } : {})
      },
      include: { organization: true }
    });

    if (limitsChanged) {
      await this.fireChanged(project, project.organization, 'limits_changed');
    }
    if (disabled?.changed) {
      await this.fireChanged(project, project.organization, 'restrictions_changed');
    }

    return project;
  }

  async setBillingRestriction(d: {
    project: Project & { organization: Organization };
    restriction: ProjectRestriction;
  }) {
    let update = restrictionUpdate({
      restriction: d.restriction,
      since: d.project.billingRestrictedAt,
      reason: d.project.billingRestrictionReason
    });

    let project = await db.project.update({
      where: { oid: d.project.oid },
      data: { billingRestrictedAt: update.since, billingRestrictionReason: update.reason },
      include: { organization: true }
    });

    if (update.changed) {
      await this.fireChanged(project, project.organization, 'restrictions_changed');
    }

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
