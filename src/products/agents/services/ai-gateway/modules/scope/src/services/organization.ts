import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, snowflake, type Organization } from '@mtsrc/ai-gateway-db';
import { Events } from '@mtsrc/ai-gateway-events';

class OrganizationServiceImpl {
  async upsertOrganization(d: { input: { ref: string; name?: string | null } }) {
    let organization = await db.organization.upsert({
      where: { ref: d.input.ref },
      create: {
        oid: snowflake.nextId(),
        id: d.input.ref,
        ref: d.input.ref,
        name: d.input.name
      },
      update: { name: d.input.name, archivedAt: null }
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

  async setNebulaTenantId(d: { organization: Organization; nebulaTenantId: string }) {
    return await db.organization.update({
      where: { oid: d.organization.oid },
      data: { nebulaTenantId: d.nebulaTenantId }
    });
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
