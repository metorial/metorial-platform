import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Instance, Organization, Project } from '../../prisma/generated/client';
import { clearCachedIngestScope } from '../auth/tokenCache';
import { db } from '../db';
import { getId } from '../id';
import { mergeSettings } from '../lib/settings';
import { eraseEntitiesQueue, eraseScopeRecords } from '../queues';
import type { InstanceSettings } from '../types';

let include = { project: true } as const;

class InstanceServiceImpl {
  async upsertInstance(d: {
    organization: Organization;
    project: Project;
    input: {
      ref: string;
      name?: string | null;
      skewBoundSeconds?: number;
      backfillMaxAgeDays?: number | null;
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
        skewBoundSeconds: d.input.skewBoundSeconds,
        backfillMaxAgeDays: d.input.backfillMaxAgeDays,
        recordRetentionDays: d.project.recordRetentionDays,
        contentRetentionDays: d.project.contentRetentionDays,
        usageRetentionDays: d.project.usageRetentionDays,
        settings,
        organizationOid: d.organization.oid,
        projectOid: d.project.oid
      },
      update: {
        name: d.input.name,
        skewBoundSeconds: d.input.skewBoundSeconds,
        backfillMaxAgeDays: d.input.backfillMaxAgeDays,
        settings,
        archivedAt: null
      },
      include
    });

    await clearCachedIngestScope({ instanceIds: [instance.id] });

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
      include
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
            include
          })
      )
    );
  }

  async archiveInstance(d: { instance: Instance & { project: Project } }) {
    if (d.instance.archivedAt) return d.instance;

    let instance = await db.instance.update({
      where: { oid: d.instance.oid },
      data: { archivedAt: new Date() },
      include
    });

    await clearCachedIngestScope({ instanceIds: [instance.id] });

    return instance;
  }

  async eraseInstance(d: { organization: Organization; instance: Instance }) {
    await eraseScopeRecords({
      scope: { organizationId: d.organization.id, instanceId: d.instance.id },
      instanceIds: [d.instance.id]
    });
    await eraseEntitiesQueue.add({
      organizationId: d.organization.id,
      instanceId: d.instance.id
    });
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
