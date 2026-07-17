import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveResourceActors,
  resolveSkillParticipants
} from '@metorial/cargo-list-utils';
import type { CargoResourceScope } from '@metorial/cargo-module-file';
import { storeReadPermission, storeWritePermission } from '@metorial/cargo-module-store';
import type {
  Prisma,
  ResourceActor,
  Skill,
  SkillParticipantRole,
  StoreParticipantPermissions
} from '@metorial/db';
import { db, withTransaction } from '@metorial/db';

export let skillParticipantInclude = {
  skill: true,
  resourceActor: true
} satisfies Prisma.SkillParticipantInclude;

export type SkillParticipantRecord = Prisma.SkillParticipantGetPayload<{
  include: typeof skillParticipantInclude;
}>;

let explicitRoles: SkillParticipantRole[] = ['creator', 'user', 'forker'];
let storeBackedRoles: SkillParticipantRole[] = ['editor', 'viewer'];
let roleOrder: SkillParticipantRole[] = ['creator', 'editor', 'viewer', 'user', 'forker'];

let sortRoles = (roles: SkillParticipantRole[]) =>
  [...new Set(roles)].sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b));

let mergeRoles = (
  left: SkillParticipantRole[] | undefined,
  right: SkillParticipantRole[] | undefined
) => sortRoles([...(left ?? []), ...(right ?? [])]);

let sameRoles = (
  left: SkillParticipantRole[] | undefined,
  right: SkillParticipantRole[] | undefined
) => JSON.stringify(sortRoles(left ?? [])) === JSON.stringify(sortRoles(right ?? []));

let withoutStoreBackedRoles = (roles: SkillParticipantRole[]) =>
  roles.filter(role => !storeBackedRoles.includes(role));

let getStoreBackedRole = (
  permissions: StoreParticipantPermissions[]
): SkillParticipantRole | undefined => {
  if (permissions.includes(storeWritePermission)) return 'editor';
  if (permissions.includes(storeReadPermission)) return 'viewer';
  return undefined;
};

class SkillParticipantServiceImpl {
  private async upsertRoles(d: {
    skill: Pick<Skill, 'oid'>;
    actor: Pick<ResourceActor, 'oid'>;
    roles: SkillParticipantRole[];
  }) {
    return await withTransaction(async db => {
      let existing = await db.skillParticipant.findUnique({
        where: {
          skillOid_resourceActorOid: {
            skillOid: d.skill.oid,
            resourceActorOid: d.actor.oid
          }
        }
      });
      let nextRoles = mergeRoles(existing?.roles, d.roles);

      if (existing) {
        if (sameRoles(existing.roles, nextRoles)) {
          return (await db.skillParticipant.findUnique({
            where: {
              skillOid_resourceActorOid: {
                skillOid: d.skill.oid,
                resourceActorOid: d.actor.oid
              }
            },
            include: skillParticipantInclude
          }))!;
        }

        return await db.skillParticipant.update({
          where: {
            id: existing.id
          },
          data: {
            roles: nextRoles
          },
          include: skillParticipantInclude
        });
      }

      let generated = getId('skillParticipant');

      return await db.skillParticipant.create({
        data: {
          oid: generated.oid,
          id: generated.id,
          skillOid: d.skill.oid,
          resourceActorOid: d.actor.oid,
          roles: nextRoles
        },
        include: skillParticipantInclude
      });
    });
  }

  async ensureSkillParticipantRoles(d: {
    skill: Pick<Skill, 'oid'>;
    actor: Pick<ResourceActor, 'oid'>;
    roles: SkillParticipantRole[];
  }) {
    return await this.upsertRoles({
      skill: d.skill,
      actor: d.actor,
      roles: d.roles.filter(role => explicitRoles.includes(role))
    });
  }

  async syncSkillParticipantsFromStore(d: { skill: Pick<Skill, 'oid' | 'storeOid'> }) {
    return await withTransaction(async db => {
      let storeParticipants = await db.storeParticipant.findMany({
        where: {
          storeOid: d.skill.storeOid!
        },
        include: {
          resourceActor: true
        }
      });
      let existingParticipants = await db.skillParticipant.findMany({
        where: {
          skillOid: d.skill.oid
        },
        include: skillParticipantInclude
      });
      let existingByActorOid = new Map(
        existingParticipants.map(participant => [
          participant.resourceActorOid.toString(),
          participant
        ])
      );
      let syncedActorOids = new Set<string>();
      let syncedParticipants: SkillParticipantRecord[] = [];

      for (let storeParticipant of storeParticipants) {
        let storeRole = getStoreBackedRole(storeParticipant.permissions);
        if (!storeRole) continue;

        syncedActorOids.add(storeParticipant.resourceActorOid.toString());

        let existing = existingByActorOid.get(storeParticipant.resourceActorOid.toString());
        let nextRoles = sortRoles([
          ...withoutStoreBackedRoles(existing?.roles ?? []),
          storeRole
        ]);

        if (existing) {
          if (sameRoles(existing.roles, nextRoles)) {
            syncedParticipants.push(existing);
            continue;
          }

          syncedParticipants.push(
            await db.skillParticipant.update({
              where: {
                id: existing.id
              },
              data: {
                roles: nextRoles
              },
              include: skillParticipantInclude
            })
          );
          continue;
        }

        let generated = getId('skillParticipant');

        syncedParticipants.push(
          await db.skillParticipant.create({
            data: {
              oid: generated.oid,
              id: generated.id,
              skillOid: d.skill.oid,
              resourceActorOid: storeParticipant.resourceActorOid,
              roles: [storeRole]
            },
            include: skillParticipantInclude
          })
        );
      }

      for (let participant of existingParticipants) {
        if (syncedActorOids.has(participant.resourceActorOid.toString())) continue;
        if (!participant.roles.some(role => storeBackedRoles.includes(role))) continue;

        let nextRoles = withoutStoreBackedRoles(participant.roles);

        if (nextRoles.length === 0) {
          await db.skillParticipant.delete({
            where: {
              id: participant.id
            }
          });
          continue;
        }

        if (sameRoles(participant.roles, nextRoles)) continue;

        syncedParticipants.push(
          await db.skillParticipant.update({
            where: {
              id: participant.id
            },
            data: {
              roles: nextRoles
            },
            include: skillParticipantInclude
          })
        );
      }

      return syncedParticipants;
    });
  }

  async syncAllSkillParticipantsFromStores(d: CargoResourceScope) {
    let skills = await withTransaction(
      async db =>
        await db.skill.findMany({
          where: {
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid
          },
          select: {
            oid: true,
            storeOid: true
          }
        }),
      { ifExists: true }
    );

    for (let skill of skills) {
      await this.syncSkillParticipantsFromStore({ skill });
    }
  }

  async getSkillParticipantById(
    d: CargoResourceScope & {
      skillParticipantId: string;
    }
  ) {
    let participant = await db.skillParticipant.findFirst({
      where: {
        id: d.skillParticipantId,
        skill: {
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid
        }
      },
      include: skillParticipantInclude
    });

    if (!participant) {
      throw new ServiceError(notFoundError('skill.participant', d.skillParticipantId));
    }

    await this.syncSkillParticipantsFromStore({
      skill: participant.skill
    });

    let syncedParticipant = await db.skillParticipant.findUnique({
      where: {
        id: participant.id
      },
      include: skillParticipantInclude
    });

    if (!syncedParticipant) {
      throw new ServiceError(notFoundError('skill.participant', d.skillParticipantId));
    }

    return syncedParticipant;
  }

  async listSkillParticipants(
    d: CargoResourceScope & {
      ids?: string[];
      skillId: string;
      actorIds?: string[];
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
    }
  ) {
    if (d.skillId) {
      let skill = await db.skill.findFirst({
        where: {
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid,
          id: d.skillId
        }
      });

      if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

      await this.syncSkillParticipantsFromStore({ skill });
    } else {
      await this.syncAllSkillParticipantsFromStores(d);
    }
    let participants = await resolveSkillParticipants(d, d.ids);
    let actors = await resolveResourceActors(d, d.actorIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillParticipant.findMany({
            ...opts,
            where: {
              oid: participants ? participants.in : undefined,
              skill: {
                resourceTenantOid: d.resourceTenant.oid,
                resourceGroupOid: d.resourceGroup.oid,
                id: d.skillId
              },
              resourceActorOid: actors ? actors.in : undefined,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
              updatedAt: d.updatedAt ? normalizeDateFilter(d.updatedAt) : undefined
            },
            include: skillParticipantInclude
          })
      )
    );
  }
}

export let skillParticipantService = Service.create(
  'cargoSkillParticipantService',
  () => new SkillParticipantServiceImpl()
).build();
