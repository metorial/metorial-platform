import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Instance, Prisma, Project } from '@metorial/db';
import { db } from '@metorial/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveResourceActors,
  resolveStoreParticipants,
  resolveStores
} from '@metorial/list-utils';
import {
  exposedParticipantResourceActorWhere,
  resourceActorPresentationInclude
} from '@metorial/module-resource-actor';

export let storeParticipantInclude = {
  store: true,
  resourceActor: {
    include: resourceActorPresentationInclude
  }
} satisfies Prisma.StoreParticipantInclude;

class StoreParticipantServiceImpl {
  async getStoreParticipantById(d: {
    project: Project;
    instance: Instance;
    storeParticipantId: string;
  }) {
    let participant = await db.storeParticipant.findFirst({
      where: {
        id: d.storeParticipantId,
        store: {
          projectOid: d.project.oid,
          instanceOid: d.instance.oid
        },
        resourceActor: exposedParticipantResourceActorWhere
      },
      include: storeParticipantInclude
    });

    if (!participant) {
      throw new ServiceError(notFoundError('storeParticipant', d.storeParticipantId));
    }

    return participant;
  }

  async listStoreParticipants(d: {
    project: Project;
    instance: Instance;
    ids?: string[];
    storeIds?: string[];
    actorIds?: string[];
    createdAt?: DateFilter;
  }) {
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
                projectOid: d.project.oid,
                instanceOid: d.instance.oid,
                oid: stores ? stores.in : undefined
              },
              resourceActorOid: actors ? actors.in : undefined,
              resourceActor: exposedParticipantResourceActorWhere,
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
