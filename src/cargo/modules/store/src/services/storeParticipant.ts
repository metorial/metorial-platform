import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma } from '@metorial-cargo/db';
import { db } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveStoreParticipants,
  resolveStores,
  resolveTenantActors
} from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';

export let storeParticipantInclude = {
  store: true,
  tenantActor: true
} satisfies Prisma.StoreParticipantInclude;

class StoreParticipantServiceImpl {
  async getStoreParticipantById(
    d: CargoTenantEnvironment & {
      storeParticipantId: string;
    }
  ) {
    let participant = await db.storeParticipant.findFirst({
      where: {
        id: d.storeParticipantId,
        store: {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      },
      include: storeParticipantInclude
    });

    if (!participant) {
      throw new ServiceError(notFoundError('storeParticipant', d.storeParticipantId));
    }

    return participant;
  }

  async listStoreParticipants(
    d: CargoTenantEnvironment & {
      ids?: string[];
      storeIds?: string[];
      actorIds?: string[];
      createdAt?: DateFilter;
    }
  ) {
    let participants = await resolveStoreParticipants(d, d.ids);
    let stores = await resolveStores(d, d.storeIds);
    let actors = await resolveTenantActors(d, d.actorIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.storeParticipant.findMany({
            ...opts,
            where: {
              oid: participants ? participants.in : undefined,
              store: {
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid,
                oid: stores ? stores.in : undefined
              },
              tenantActorOid: actors ? actors.in : undefined,
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
