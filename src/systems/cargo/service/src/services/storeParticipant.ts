import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma } from '../../prisma/generated/client';
import { db } from '../db';
import type { CargoTenantEnvironment } from './filePurpose';

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
      storeId?: string;
    }
  ) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.storeParticipant.findMany({
            ...opts,
            where: {
              store: {
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid,
                ...(d.storeId
                  ? {
                      id: d.storeId
                    }
                  : {})
              }
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
