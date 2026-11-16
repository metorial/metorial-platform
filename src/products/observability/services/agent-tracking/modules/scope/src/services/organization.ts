import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Organization } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { getId } from '@mtsrc/agent-tracking-db';
import { mergeSettings } from '../lib/settings';
import { Events } from '@mtsrc/agent-tracking-events';
import type { OrganizationSettings } from '@mtsrc/agent-tracking-spec';

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

    await Events.fire('scope.organization.changed:after', {
      organizationId: organization.id,
      change: 'upserted'
    });

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

    await Events.fire('scope.organization.changed:after', {
      organizationId: organization.id,
      change: 'archived'
    });

    return organization;
  }
}

export let organizationService = Service.create(
  'organizationService',
  () => new OrganizationServiceImpl()
).build();
