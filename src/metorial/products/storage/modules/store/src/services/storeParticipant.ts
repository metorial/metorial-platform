import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Instance,
  Prisma,
  Project,
  StoreParticipantPermissions,
  StoreParticipantRole
} from '@metorial/db';
import { addAwaitedAfterTransactionHook, db, ID, withTransaction } from '@metorial/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveResourceActors
} from '@metorial/list-utils';
import {
  isOrganizationMemberFullSkillAccessEnabled,
  type OrganizationMemberSkillAccessProject,
  skillStoreResourceAccess,
  standaloneStoreResourceAccess,
  storeAccessGrantService,
  type StoreResourceAccessLevel
} from '@metorial/module-access';
import {
  exposedParticipantResourceActorWhere,
  resourceActorPresentationInclude
} from '@metorial/module-resource-actor';

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
        OR: [{ id: d.participantId }, { actors: { some: { id: d.participantId } } }]
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

  async findOrganizationMemberParticipantOids(d: {
    project: OrganizationMemberSkillAccessProject;
    participants: StoreResourceParticipantRecord[];
  }) {
    let result = new Set<bigint>();
    if (!d.participants.length) return result;
    if (!(await isOrganizationMemberFullSkillAccessEnabled({ project: d.project }))) {
      return result;
    }

    let actorsOf = (participant: StoreResourceParticipantRecord) => [
      participant.primaryResourceActor,
      ...participant.actors.map(row => row.resourceActor)
    ];
    let consumerOidsOf = (participant: StoreResourceParticipantRecord) =>
      actorsOf(participant).flatMap(actor => [
        ...(actor.consumerOid ? [actor.consumerOid] : []),
        ...(actor.consumerProfile ? [actor.consumerProfile.consumerOid] : [])
      ]);

    let consumerOrganizationActors = await db.consumerOrganizationActor.findMany({
      where: { consumerOid: { in: d.participants.flatMap(consumerOidsOf) } },
      select: { consumerOid: true, organizationActorOid: true }
    });
    let organizationActorOidsByConsumer = new Map<bigint, bigint[]>();
    for (let row of consumerOrganizationActors) {
      organizationActorOidsByConsumer.set(row.consumerOid, [
        ...(organizationActorOidsByConsumer.get(row.consumerOid) ?? []),
        row.organizationActorOid
      ]);
    }

    let linksOf = (participant: StoreResourceParticipantRecord) => {
      let memberOids: bigint[] = [];
      let organizationActorOids: bigint[] = [];

      for (let actor of actorsOf(participant)) {
        if (actor.organizationActorOid) organizationActorOids.push(actor.organizationActorOid);
        if (actor.consumerProfile) {
          organizationActorOids.push(actor.consumerProfile.organizationActorOid);
          if (actor.consumerProfile.organizationMemberOid) {
            memberOids.push(actor.consumerProfile.organizationMemberOid);
          }
        }
        if (actor.consumer?.organizationActorOid) {
          organizationActorOids.push(actor.consumer.organizationActorOid);
        }
        if (actor.consumer?.organizationMemberOid) {
          memberOids.push(actor.consumer.organizationMemberOid);
        }
      }
      for (let consumerOid of consumerOidsOf(participant)) {
        organizationActorOids.push(
          ...(organizationActorOidsByConsumer.get(consumerOid) ?? [])
        );
      }

      return { memberOids, organizationActorOids };
    };

    let links = d.participants.map(participant => ({ participant, ...linksOf(participant) }));
    let members = await db.organizationMember.findMany({
      where: {
        status: 'active',
        organization: { projects: { some: { oid: d.project.oid } } },
        OR: [
          { oid: { in: links.flatMap(link => link.memberOids) } },
          { actorOid: { in: links.flatMap(link => link.organizationActorOids) } }
        ]
      },
      select: { oid: true, actorOid: true }
    });
    let activeMemberOids = new Set(members.map(member => member.oid));
    let activeMemberActorOids = new Set(members.map(member => member.actorOid));

    for (let link of links) {
      if (
        link.memberOids.some(oid => activeMemberOids.has(oid)) ||
        link.organizationActorOids.some(oid => activeMemberActorOids.has(oid))
      ) {
        result.add(link.participant.oid);
      }
    }

    return result;
  }

  async findConsumerGrantLevels(d: { store: { oid: bigint }; consumerProfileOids: bigint[] }) {
    let result = new Map<bigint, StoreResourceAccessLevel>();
    let consumerProfileOids = [...new Set(d.consumerProfileOids)];
    if (!consumerProfileOids.length) return result;

    return await withTransaction(
      async db => {
        let store = await db.store.findUnique({
          where: { oid: d.store.oid },
          select: {
            oid: true,
            project: { select: { organizationOid: true } },
            skill: { select: { oid: true } }
          }
        });
        if (!store) return result;

        let profiles = await db.consumerProfile.findMany({
          where: { oid: { in: consumerProfileOids } },
          select: { oid: true, personalConsumerGroup: { select: { accessTagOid: true } } }
        });
        let grants = await storeAccessGrantService.listAccessTagGrants({
          storeOids: [store.oid],
          organizationOid: store.project.organizationOid,
          access: store.skill ? skillStoreResourceAccess : standaloneStoreResourceAccess,
          accessTagOids: profiles.map(profile => profile.personalConsumerGroup.accessTagOid)
        });
        let levelByAccessTag = new Map(grants.map(grant => [grant.accessTagOid, grant.level]));

        for (let profile of profiles) {
          let level = levelByAccessTag.get(profile.personalConsumerGroup.accessTagOid);
          if (level) result.set(profile.oid, level);
        }

        return result;
      },
      { ifExists: true }
    );
  }

  async findParticipantPermissions(d: {
    store: { oid: bigint };
    participants: StoreResourceParticipantRecord[];
  }) {
    let result = new Map<bigint, StoreParticipantPermissions[]>();
    let actorsOf = (participant: StoreResourceParticipantRecord) => [
      participant.primaryResourceActor,
      ...participant.actors.map(row => row.resourceActor)
    ];

    let levelByProfile = await this.findConsumerGrantLevels({
      store: d.store,
      consumerProfileOids: d.participants
        .flatMap(actorsOf)
        .flatMap(actor => (actor.consumerProfileOid ? [actor.consumerProfileOid] : []))
    });

    for (let participant of d.participants) {
      let actors = actorsOf(participant);
      let levels = actors.flatMap(actor => {
        let level = actor.consumerProfileOid
          ? levelByProfile.get(actor.consumerProfileOid)
          : undefined;
        return level ? [level] : [];
      });

      let canWrite =
        actors.some(actor => !!actor.organizationActorOid) ||
        levels.some(level => level != 'read');
      let canRead = canWrite || levels.length > 0;

      result.set(participant.oid, [
        ...(canRead ? (['content_read'] as const) : []),
        ...(canWrite ? (['content_write'] as const) : [])
      ]);
    }

    return result;
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

      await this.lockStoreParticipants(d.store.oid);

      let participant = await this.ensureParticipant({
        storeOid: d.store.oid,
        consumerOid,
        actorOid: actor.oid
      });

      let existingActorRow = await db.storeParticipantActor.findUnique({
        where: {
          storeOid_resourceActorOid: { storeOid: d.store.oid, resourceActorOid: actor.oid }
        }
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

  async setAccessRoleSafely(d: {
    store: { oid: bigint };
    actor: { oid: bigint };
    role: 'editor' | 'viewer' | null;
  }) {
    let run = async () => {
      try {
        await this.setAccessRole(d);
      } catch (error) {
        console.error('Failed to set store access role', error);
      }
    };

    await addAwaitedAfterTransactionHook(run);
  }

  async setAccessRole(d: {
    store: { oid: bigint };
    actor: { oid: bigint };
    role: 'editor' | 'viewer' | null;
  }) {
    return await withTransaction(async db => {
      await this.lockStoreParticipants(d.store.oid);

      let row = await db.storeParticipantActor.findUnique({
        where: {
          storeOid_resourceActorOid: { storeOid: d.store.oid, resourceActorOid: d.actor.oid }
        }
      });

      if (!row) {
        if (d.role) await this.recordParticipation({ ...d, roles: [d.role] });
        return;
      }

      let nextRoles = mergeRoles(
        row.roles.filter(role => role != 'editor' && role != 'viewer'),
        d.role ? [d.role] : []
      );
      if (!sameRoles(row.roles, nextRoles)) {
        await db.storeParticipantActor.update({
          where: { oid: row.oid },
          data: { roles: nextRoles }
        });
      }

      if (d.role) {
        await this.recordParticipation({ ...d, roles: [d.role] });
        row = await db.storeParticipantActor.findUniqueOrThrow({ where: { oid: row.oid } });
      }

      if (row.storeParticipantOid)
        await this.recomputeParticipantRoles(row.storeParticipantOid);
    });
  }

  private async recomputeParticipantRoles(storeParticipantOid: bigint) {
    return await withTransaction(async db => {
      let participant = await db.storeParticipant.findUnique({
        where: { oid: storeParticipantOid },
        include: { actors: { select: { roles: true } } }
      });
      if (!participant) return undefined;
      if (participant.actors.length == 0) return participant;

      let roles = participant.actors.reduce(
        (all, actor) => mergeRoles(all, actor.roles),
        [] as StoreParticipantRole[]
      );
      if (sameRoles(participant.roles, roles)) return participant;

      return await db.storeParticipant.update({
        where: { oid: participant.oid },
        data: { roles }
      });
    });
  }

  // Creating and merging participants and their roles are read-modify-write sequences, and a
  // unique violation would abort the whole transaction, so concurrent writers of one store queue up.
  private async lockStoreParticipants(storeOid: bigint) {
    await withTransaction(async db => {
      await db.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`store-participants:${storeOid}`}))
      `;
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
