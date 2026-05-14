import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Prisma,
  Skill,
  SkillParticipantRole,
  StoreParticipantPermissions,
  TenantActor
} from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import type { CargoTenantEnvironment } from './filePurpose';
import { storeReadPermission, storeWritePermission } from './storeAccess';

export let skillParticipantInclude = {
  skill: true,
  tenantActor: true
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
    actor: Pick<TenantActor, 'oid'>;
    roles: SkillParticipantRole[];
  }) {
    return await withTransaction(async db => {
      let existing = await db.skillParticipant.findUnique({
        where: {
          skillOid_tenantActorOid: {
            skillOid: d.skill.oid,
            tenantActorOid: d.actor.oid
          }
        }
      });
      let nextRoles = mergeRoles(existing?.roles, d.roles);

      if (existing) {
        if (sameRoles(existing.roles, nextRoles)) {
          return (await db.skillParticipant.findUnique({
            where: {
              skillOid_tenantActorOid: {
                skillOid: d.skill.oid,
                tenantActorOid: d.actor.oid
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
          tenantActorOid: d.actor.oid,
          roles: nextRoles
        },
        include: skillParticipantInclude
      });
    });
  }

  async ensureSkillParticipantRoles(d: {
    skill: Pick<Skill, 'oid'>;
    actor: Pick<TenantActor, 'oid'>;
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
          storeOid: d.skill.storeOid
        },
        include: {
          tenantActor: true
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
          participant.tenantActorOid.toString(),
          participant
        ])
      );
      let syncedActorOids = new Set<string>();
      let syncedParticipants: SkillParticipantRecord[] = [];

      for (let storeParticipant of storeParticipants) {
        let storeRole = getStoreBackedRole(storeParticipant.permissions);
        if (!storeRole) continue;

        syncedActorOids.add(storeParticipant.tenantActorOid.toString());

        let existing = existingByActorOid.get(storeParticipant.tenantActorOid.toString());
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
              tenantActorOid: storeParticipant.tenantActorOid,
              roles: [storeRole]
            },
            include: skillParticipantInclude
          })
        );
      }

      for (let participant of existingParticipants) {
        if (syncedActorOids.has(participant.tenantActorOid.toString())) continue;
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

  async syncAllSkillParticipantsFromStores(d: CargoTenantEnvironment) {
    let skills = await withTransaction(
      async db =>
        await db.skill.findMany({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid
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
    d: CargoTenantEnvironment & {
      skillParticipantId: string;
    }
  ) {
    let participant = await db.skillParticipant.findFirst({
      where: {
        id: d.skillParticipantId,
        skill: {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      },
      include: skillParticipantInclude
    });

    if (!participant) {
      throw new ServiceError(notFoundError('skillParticipant', d.skillParticipantId));
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
      throw new ServiceError(notFoundError('skillParticipant', d.skillParticipantId));
    }

    return syncedParticipant;
  }

  async listSkillParticipants(
    d: CargoTenantEnvironment & {
      skillId?: string;
    }
  ) {
    if (d.skillId) {
      let skill = await db.skill.findFirst({
        where: {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          id: d.skillId
        }
      });

      if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

      await this.syncSkillParticipantsFromStore({ skill });
    } else {
      await this.syncAllSkillParticipantsFromStores(d);
    }

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillParticipant.findMany({
            ...opts,
            where: {
              skill: {
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid,
                ...(d.skillId
                  ? {
                      id: d.skillId
                    }
                  : {})
              }
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
