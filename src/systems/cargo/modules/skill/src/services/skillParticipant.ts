import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type {
  Prisma,
  Skill,
  SkillParticipantRole,
  StoreParticipantPermissions,
  TenantActor
} from '@metorial-cargo/db';
import { db, getId, withTransaction } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillParticipants,
  resolveTenantActors
} from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { storeReadPermission, storeWritePermission } from '@metorial-cargo/module-store';

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
    d: CargoTenantEnvironment & {
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
    let participants = await resolveSkillParticipants(d, d.ids);
    let actors = await resolveTenantActors(d, d.actorIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillParticipant.findMany({
            ...opts,
            where: {
              oid: participants ? participants.in : undefined,
              skill: {
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid,
                id: d.skillId
              },
              tenantActorOid: actors ? actors.in : undefined,
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
