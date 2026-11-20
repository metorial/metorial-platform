import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type Instance,
  type Organization,
  type Project
} from '@mtsrc/ai-gateway-db';
import { Events } from '@mtsrc/ai-gateway-events';
import { mergeSettings, type InstanceSettings } from '@mtsrc/ai-gateway-spec';

export let instanceInclude = { project: true } as const;

class InstanceServiceImpl {
  async upsertInstance(d: {
    organization: Organization;
    project: Project;
    input: {
      ref: string;
      name?: string | null;
      logRetentionDays?: number;
      settings?: InstanceSettings;
    };
  }) {
    let existing = await db.instance.findUnique({ where: { ref: d.input.ref } });
    if (existing) this.assertInstanceChangeable(existing, d);

    let settings = mergeSettings(existing?.settings, d.input.settings);

    let instance = await db.instance.upsert({
      where: { ref: d.input.ref },
      create: {
        ...getId('instance'),
        ref: d.input.ref,
        name: d.input.name,
        logRetentionDays: d.input.logRetentionDays,
        settings,
        organizationOid: d.organization.oid,
        projectOid: d.project.oid
      },
      update: {
        name: d.input.name,
        logRetentionDays: d.input.logRetentionDays,
        settings,
        archivedAt: null
      },
      include: instanceInclude
    });

    await Events.fire('scope.instance.changed:after', {
      organizationId: d.organization.id,
      instanceId: instance.id,
      change: 'upserted'
    });

    return instance;
  }

  async getInstanceById(d: {
    organization: Organization;
    instanceId: string;
    includeArchived?: boolean;
  }) {
    let instance = await db.instance.findFirst({
      where: {
        OR: [{ id: d.instanceId }, { ref: d.instanceId }],
        organizationOid: d.organization.oid,
        archivedAt: d.includeArchived ? undefined : null
      },
      include: instanceInclude
    });
    if (!instance) throw new ServiceError(notFoundError('instance'));

    return instance;
  }

  async listInstances(d: { project: Project }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.instance.findMany({
            ...opts,
            where: { projectOid: d.project.oid, archivedAt: null },
            include: instanceInclude
          })
      )
    );
  }

  async archiveInstance(d: { organization: Organization; instance: Instance }) {
    if (d.instance.archivedAt) {
      return await db.instance.findUniqueOrThrow({
        where: { oid: d.instance.oid },
        include: instanceInclude
      });
    }

    let instance = await db.instance.update({
      where: { oid: d.instance.oid },
      data: { archivedAt: new Date() },
      include: instanceInclude
    });

    await Events.fire('scope.instance.changed:after', {
      organizationId: d.organization.id,
      instanceId: instance.id,
      change: 'archived'
    });

    return instance;
  }

  private assertInstanceChangeable(
    instance: Instance,
    d: { organization: Organization; project: Project }
  ) {
    if (instance.organizationOid != d.organization.oid) {
      throw new ServiceError(
        conflictError({ message: 'The instance ref belongs to another organization.' })
      );
    }

    if (instance.projectOid != d.project.oid) {
      throw new ServiceError(
        conflictError({ message: 'The instance belongs to another project.' })
      );
    }
  }
}

export let instanceService = Service.create(
  'instanceService',
  () => new InstanceServiceImpl()
).build();
