import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveResourceActors,
  resolveStoreParticipants,
  resolveStores
} from '@metorial/cargo-list-utils';
import {
  externallyVisibleParticipantResourceActorWhere,
  resourceActorPresentationInclude,
  type ResourceScope
} from '@metorial/module-resource-tenant';
import type { Prisma } from '@metorial/db';
import { db } from '@metorial/db';

export let storeParticipantInclude = {
  store: true,
  resourceActor: {
    include: resourceActorPresentationInclude
  }
} satisfies Prisma.StoreParticipantInclude;

class StoreParticipantServiceImpl {
  async getStoreParticipantById(
    d: ResourceScope & {
      storeParticipantId: string;
    }
  ) {
    let participant = await db.storeParticipant.findFirst({
      where: {
        id: d.storeParticipantId,
        store: {
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid
        },
        resourceActor: externallyVisibleParticipantResourceActorWhere
      },
      include: storeParticipantInclude
    });

    if (!participant) {
      throw new ServiceError(notFoundError('storeParticipant', d.storeParticipantId));
    }

    return participant;
  }

  async listStoreParticipants(
    d: ResourceScope & {
      ids?: string[];
      storeIds?: string[];
      actorIds?: string[];
      createdAt?: DateFilter;
    }
  ) {
    let participants = await resolveStoreParticipants(d, d.ids);
    let stores = await resolveStores(d, d.storeIds);
    let actors = await resolveResourceActors(d, d.actorIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.storeParticipant.findMany({
            ...opts,
            where: {
              oid: participants ? participants.in : undefined,
              store: {
                resourceTenantOid: d.resourceTenant.oid,
                resourceGroupOid: d.resourceGroup.oid,
                oid: stores ? stores.in : undefined
              },
              resourceActorOid: actors ? actors.in : undefined,
              resourceActor: externallyVisibleParticipantResourceActorWhere,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined
            },
            include: storeParticipantInclude
          })
      )
    );
  }
}

export let storeParticipantService = Service.create(
  'cargoStoreParticipantService',
  () => new StoreParticipantServiceImpl()
).build();
