import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { db, ID, Organization, Outpost, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { instanceService } from '@metorial/module-organization';
import { cachedInstanceAccessGrant } from '../lib/cache';
import { OUTPOST_SERVICES, type OutpostServiceName } from '../lib/services';

class OutpostAccessService {
  async setAccessForOrganization(d: {
    outpost: Outpost;
    organization: Organization;
    grants: { instanceId: string; services: OutpostServiceName[] }[];
    auditScope: AuditScope;
  }) {
    if (d.outpost.status == 'deleted') {
      throw new ServiceError(
        forbiddenError({ message: 'Cannot manage access for a deleted outpost' })
      );
    }

    let invalidService = d.grants
      .flatMap(grant => grant.services)
      .find(service => !(OUTPOST_SERVICES as readonly string[]).includes(service));
    if (invalidService) {
      throw new ServiceError(
        badRequestError({ message: `Unknown outpost service: ${invalidService}` })
      );
    }

    let instances = await instanceService.getManyInstancesForOrganization({
      organization: d.organization,
      instanceIds: d.grants.map(grant => grant.instanceId)
    });

    let instancesById = new Map(
      instances.flatMap(instance => [
        [instance.id, instance] as const,
        [instance.slug, instance] as const,
        ...instance.previousSlugs.map(slug => [slug, instance] as const)
      ])
    );

    let missingInstanceId = d.grants
      .map(grant => grant.instanceId)
      .find(instanceId => !instancesById.has(instanceId));
    if (missingInstanceId)
      throw new ServiceError(notFoundError('instance', missingInstanceId));

    let resolvedGrants = d.grants.map(grant => ({
      instance: instancesById.get(grant.instanceId)!,
      services: grant.services
    }));

    return await withTransaction(async db => {
      await Fabric.fire('outpost_access.updated:before', d);

      await db.outpostAccess.deleteMany({
        where: {
          outpostOid: d.outpost.oid,
          organizationOid: d.organization.oid,
          instanceOid: { notIn: resolvedGrants.map(grant => grant.instance.oid) }
        }
      });

      let access = await Promise.all(
        resolvedGrants.map(async grant =>
          db.outpostAccess.upsert({
            where: {
              outpostOid_instanceOid: {
                outpostOid: d.outpost.oid,
                instanceOid: grant.instance.oid
              }
            },
            create: {
              id: await ID.generateId('outpostAccess'),
              outpostOid: d.outpost.oid,
              projectOid: grant.instance.projectOid,
              instanceOid: grant.instance.oid,
              organizationOid: d.organization.oid,
              services: grant.services
            },
            update: {
              services: grant.services
            },
            include: { project: true, instance: true, organization: true, outpost: true }
          })
        )
      );

      await Fabric.fire('outpost_access.updated:after', { ...d, access });

      return access;
    });
  }

  async listAccess(d: {
    outpost: Outpost;
    filter?: { organizationId?: string; instanceId?: string };
  }) {
    let organizationOid: bigint | undefined;
    if (d.filter?.organizationId) {
      let organization = await db.organization.findUnique({
        where: { id: d.filter.organizationId },
        select: { oid: true }
      });
      if (!organization)
        throw new ServiceError(notFoundError('organization', d.filter.organizationId));
      organizationOid = organization.oid;
    }

    let instanceOid: bigint | undefined;
    if (d.filter?.instanceId) {
      let instance = await db.instance.findUnique({
        where: { id: d.filter.instanceId },
        select: { oid: true }
      });
      if (!instance) throw new ServiceError(notFoundError('instance', d.filter.instanceId));
      instanceOid = instance.oid;
    }

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.outpostAccess.findMany({
            ...opts,
            where: {
              outpostOid: d.outpost.oid,
              organizationOid,
              instanceOid
            },
            include: { project: true, instance: true, organization: true, outpost: true },
            orderBy: { createdAt: 'desc' }
          })
      )
    );
  }

  async isServiceGrantedForInstance(d: {
    outpostId: string;
    projectOid: bigint;
    instanceOid: bigint;
    service: OutpostServiceName;
  }) {
    let { granted } = await cachedInstanceAccessGrant(d);

    return granted;
  }
}

export let outpostAccessService = Service.create(
  'outpostAccessService',
  () => new OutpostAccessService()
).build();
