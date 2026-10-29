import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Instance, Prisma, Project, StoreParticipantRole } from '@metorial/db';
import { addAwaitedAfterTransactionHook, db, ID, withTransaction } from '@metorial/db';
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
import { legacyStoreParticipantActorWhere } from '../lib/participantActorRows';

export let storeParticipantInclude = {
  store: true,
  resourceActor: {
    include: resourceActorPresentationInclude
  }
} satisfies Prisma.StoreParticipantActorInclude;

export let storeResourceParticipantInclude = {
  store: true,
  primaryResourceActor: {
    include: resourceActorPresentationInclude
  },
  actors: {
    where: {
      resourceActor: exposedParticipantResourceActorWhere
    },
    include: {
      resourceActor: {
        include: resourceActorPresentationInclude
      }
    },
    orderBy: { oid: 'asc' }
  }
} satisfies Prisma.StoreParticipantInclude;

export type StoreResourceParticipantRecord = Prisma.StoreParticipantGetPayload<{
  include: typeof storeResourceParticipantInclude;
}>;

let roleOrder: StoreParticipantRole[] = ['creator', 'editor', 'viewer', 'user', 'forker'];

let mergeRoles = (left: StoreParticipantRole[], right: StoreParticipantRole[]) =>
  [...new Set([...left, ...right])].sort(
    (a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b)
  );

let sameRoles = (left: StoreParticipantRole[], right: StoreParticipantRole[]) =>
  mergeRoles(left, []).join(',') == mergeRoles(right, []).join(',');

let exposedStoreParticipantWhere = {
  primaryResourceActor: exposedParticipantResourceActorWhere
} satisfies Prisma.StoreParticipantWhereInput;

class StoreParticipantServiceImpl {
  async getStoreParticipantById(d: {
    project: Project;
    instance: Instance;
    storeParticipantId: string;
  }) {
    let participant = await db.storeParticipantActor.findFirst({
      where: {
        AND: [legacyStoreParticipantActorWhere],
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
          await db.storeParticipantActor.findMany({
            ...opts,
            where: {
              AND: [legacyStoreParticipantActorWhere],
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

  async getStoreResourceParticipantById(d: {
    project: Project;
    instance: Instance;
    store: { oid: bigint };
    participantId: string;
  }) {
    let participant = await db.storeParticipant.findFirst({
      where: {
        ...exposedStoreParticipantWhere,
        storeOid: d.store.oid,
        store: { projectOid: d.project.oid, instanceOid: d.instance.oid },
        OR: [
          { id: d.participantId },
          { actors: { some: { id: d.participantId } } },
          {
            actors: {
              some: {
                resourceActor: {
                  skillParticipants: {
                    some: { id: d.participantId, skill: { storeOid: d.store.oid } }
                  }
                }
              }
            }
          }
        ]
      },
      include: storeResourceParticipantInclude
    });

    if (!participant) {
      throw new ServiceError(notFoundError('store.participant', d.participantId));
    }

    return participant;
  }

  async listStoreResourceParticipants(d: {
    project: Project;
    instance: Instance;
    store: { oid: bigint };
    ids?: string[];
    actorIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let actors = await resolveResourceActors(d, d.actorIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.storeParticipant.findMany({
            ...opts,
            where: {
              ...exposedStoreParticipantWhere,
              storeOid: d.store.oid,
              store: { projectOid: d.project.oid, instanceOid: d.instance.oid },
              id: d.ids ? { in: d.ids } : undefined,
              actors: actors ? { some: { resourceActorOid: actors.in } } : undefined,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
              updatedAt: d.updatedAt ? normalizeDateFilter(d.updatedAt) : undefined
            },
            include: storeResourceParticipantInclude
          })
      )
    );
  }

  async recordParticipationSafely(d: {
    store: { oid: bigint };
    actor: { oid: bigint };
    roles?: StoreParticipantRole[];
  }) {
    let run = async () => {
      try {
        await this.recordParticipation(d);
      } catch (error) {
        console.error('Failed to record store participation', error);
      }
    };

    await addAwaitedAfterTransactionHook(run);
  }

  async recordParticipation(d: {
    store: { oid: bigint };
    actor: { oid: bigint };
    roles?: StoreParticipantRole[];
    activeAt?: Date;
    createdAt?: Date;
  }) {
    return await withTransaction(async db => {
      let actor = await db.resourceActor.findUnique({
        where: { oid: d.actor.oid },
        include: { organizationActor: { select: { type: true } } }
      });
      if (!actor || actor.type == 'system' || actor.organizationActor?.type == 'system') {
        return undefined;
      }

      let roles = d.roles ?? [];
      let activeAt = d.activeAt ?? new Date();
      let nextActiveAt = (current: Date | null) =>
        current && current > activeAt ? undefined : activeAt;
      let nextCreatedAt = (current: Date) =>
        d.createdAt && d.createdAt < current ? d.createdAt : undefined;
      let consumerOid = await this.resolveConsumerOid(actor);

      let existingActorRow = await db.storeParticipantActor.findUnique({
        where: {
          storeOid_resourceActorOid: { storeOid: d.store.oid, resourceActorOid: actor.oid }
        }
      });

      let participant = await this.ensureParticipant({
        storeOid: d.store.oid,
        consumerOid,
        actorOid: actor.oid
      });

      let nextParticipantRoles = mergeRoles(participant.roles, roles);
      participant = await db.storeParticipant.update({
        where: { oid: participant.oid },
        data: {
          roles: sameRoles(participant.roles, nextParticipantRoles)
            ? undefined
            : nextParticipantRoles,
          lastActiveAt: nextActiveAt(participant.lastActiveAt),
          createdAt: nextCreatedAt(participant.createdAt)
        }
      });

      if (existingActorRow) {
        let nextActorRoles = mergeRoles(existingActorRow.roles, roles);
        await db.storeParticipantActor.update({
          where: { oid: existingActorRow.oid },
          data: {
            storeParticipantOid: participant.oid,
            roles: sameRoles(existingActorRow.roles, nextActorRoles)
              ? undefined
              : nextActorRoles,
            lastActiveAt: nextActiveAt(existingActorRow.lastActiveAt)
          }
        });

        if (
          existingActorRow.storeParticipantOid &&
          existingActorRow.storeParticipantOid != participant.oid
        ) {
          await this.mergeParticipant({
            fromOid: existingActorRow.storeParticipantOid,
            intoOid: participant.oid
          });
        }
      } else {
        await db.storeParticipantActor.upsert({
          where: {
            storeOid_resourceActorOid: { storeOid: d.store.oid, resourceActorOid: actor.oid }
          },
          create: {
            id: await ID.generateId('storeParticipantActor'),
            storeOid: d.store.oid,
            resourceActorOid: actor.oid,
            storeParticipantOid: participant.oid,
            roles: mergeRoles([], roles),
            permissions: [],
            lastActiveAt: activeAt
          },
          update: {
            storeParticipantOid: participant.oid,
            lastActiveAt: activeAt
          }
        });
      }

      return participant;
    });
  }

  async findStoreParticipantForActor(d: { store: { oid: bigint }; actor: { oid: bigint } }) {
    return await withTransaction(
      async db => {
        let actorRow = await db.storeParticipantActor.findUnique({
          where: {
            storeOid_resourceActorOid: { storeOid: d.store.oid, resourceActorOid: d.actor.oid }
          },
          select: { storeParticipantOid: true }
        });

        return actorRow?.storeParticipantOid ?? undefined;
      },
      { ifExists: true }
    );
  }

  private async resolveConsumerOid(actor: {
    consumerOid: bigint | null;
    organizationActorOid: bigint | null;
  }) {
    if (actor.consumerOid) return actor.consumerOid;

    let organizationActorOid = actor.organizationActorOid;
    if (!organizationActorOid) return null;

    let consumer = await withTransaction(
      async db =>
        await db.consumer.findFirst({
          where: {
            OR: [
              { organizationActorOid },
              { consumerOrganizationActors: { some: { organizationActorOid } } },
              { profiles: { some: { organizationActorOid } } }
            ]
          },
          orderBy: { oid: 'asc' },
          select: { oid: true }
        }),
      { ifExists: true }
    );

    return consumer?.oid ?? null;
  }

  private async ensureParticipant(d: {
    storeOid: bigint;
    consumerOid: bigint | null;
    actorOid: bigint;
  }) {
    return await withTransaction(async db => {
      let byConsumer = d.consumerOid
        ? await db.storeParticipant.findUnique({
            where: {
              storeOid_consumerOid: { storeOid: d.storeOid, consumerOid: d.consumerOid }
            }
          })
        : null;
      let byActor = await db.storeParticipant.findUnique({
        where: {
          storeOid_primaryResourceActorOid: {
            storeOid: d.storeOid,
            primaryResourceActorOid: d.actorOid
          }
        }
      });

      if (byConsumer && byActor && byConsumer.oid != byActor.oid) {
        await this.mergeParticipant({ fromOid: byActor.oid, intoOid: byConsumer.oid });
        return await db.storeParticipant.findUniqueOrThrow({ where: { oid: byConsumer.oid } });
      }

      let existing = byConsumer ?? byActor;
      if (existing) {
        if (d.consumerOid && !existing.consumerOid) {
          return await db.storeParticipant.update({
            where: { oid: existing.oid },
            data: { consumerOid: d.consumerOid }
          });
        }

        return existing;
      }

      let create = {
        id: await ID.generateId('storeParticipant'),
        storeOid: d.storeOid,
        consumerOid: d.consumerOid,
        primaryResourceActorOid: d.actorOid
      };

      if (d.consumerOid) {
        return await db.storeParticipant.upsert({
          where: {
            storeOid_consumerOid: { storeOid: d.storeOid, consumerOid: d.consumerOid }
          },
          create,
          update: {}
        });
      }

      return await db.storeParticipant.upsert({
        where: {
          storeOid_primaryResourceActorOid: {
            storeOid: d.storeOid,
            primaryResourceActorOid: d.actorOid
          }
        },
        create,
        update: {}
      });
    });
  }

  private async mergeParticipant(d: { fromOid: bigint; intoOid: bigint }) {
    await withTransaction(async db => {
      let [from, into] = await Promise.all([
        db.storeParticipant.findUnique({ where: { oid: d.fromOid } }),
        db.storeParticipant.findUnique({ where: { oid: d.intoOid } })
      ]);
      if (!from || !into) return;
      if (from.consumerOid && into.consumerOid && from.consumerOid != into.consumerOid) return;

      await db.storeParticipantActor.updateMany({
        where: { storeParticipantOid: from.oid },
        data: { storeParticipantOid: into.oid }
      });
      await db.documentParticipant.updateMany({
        where: { storeParticipantOid: from.oid },
        data: { storeParticipantOid: into.oid }
      });

      await db.storeParticipant.delete({ where: { oid: from.oid } });

      await db.storeParticipant.update({
        where: { oid: into.oid },
        data: {
          roles: mergeRoles(into.roles, from.roles),
          lastActiveAt:
            from.lastActiveAt && (!into.lastActiveAt || from.lastActiveAt > into.lastActiveAt)
              ? from.lastActiveAt
              : undefined,
          createdAt: from.createdAt < into.createdAt ? from.createdAt : undefined
        }
      });
    });
  }
}

export let storeParticipantService = Service.create(
  'cargoStoreParticipantService',
  () => new StoreParticipantServiceImpl()
).build();
