import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Organization } from '../../prisma/generated/client';
import { clearCachedIngestScope } from '../auth/tokenCache';
import { db } from '../db';
import { getId } from '../id';
import { mergeSettings } from '../lib/settings';
import { eraseEntitiesQueue, eraseScopeRecords } from '../queues';
import type { OrganizationSettings } from '../types';

class OrganizationServiceImpl {
  async upsertOrganization(d: {
    input: { ref: string; name?: string | null; settings?: OrganizationSettings };
  }) {
    let existing = await db.organization.findUnique({ where: { ref: d.input.ref } });
    let settings = mergeSettings(existing?.settings, d.input.settings);

    let organization = await db.organization.upsert({
      where: { ref: d.input.ref },
      create: {
        ...getId('organization'),
        ref: d.input.ref,
        name: d.input.name,
        settings
      },
      update: { name: d.input.name, settings, archivedAt: null }
    });

    await clearCachedIngestScope({ organizationId: organization.id });

    return organization;
  }

  async getOrganizationById(d: { organizationId: string; includeArchived?: boolean }) {
    let organization = await db.organization.findFirst({
      where: {
        OR: [{ id: d.organizationId }, { ref: d.organizationId }],
        archivedAt: d.includeArchived ? undefined : null
      }
    });
    if (!organization) throw new ServiceError(notFoundError('organization'));

    return organization;
  }

  async archiveOrganization(d: { organization: Organization }) {
    if (d.organization.archivedAt) return d.organization;

    let organization = await db.organization.update({
      where: { oid: d.organization.oid },
      data: { archivedAt: new Date() }
    });

    await clearCachedIngestScope({ organizationId: organization.id });

    return organization;
  }

  async eraseOrganization(d: { organization: Organization }) {
    let instances = await db.instance.findMany({
      where: { organizationOid: d.organization.oid },
      select: { id: true }
    });

    await eraseScopeRecords({
      scope: { organizationId: d.organization.id },
      instanceIds: instances.map(instance => instance.id)
    });
    await eraseEntitiesQueue.add({ organizationId: d.organization.id });
  }
}

export let organizationService = Service.create(
  'organizationService',
  () => new OrganizationServiceImpl()
).build();
