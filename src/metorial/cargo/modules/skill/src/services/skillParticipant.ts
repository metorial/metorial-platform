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
import type { Prisma, ResourceActor, Skill, SkillParticipantRole } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import {
  exposedParticipantResourceActorWhere,
  resourceActorPresentationInclude,
  type ResourceScope
} from '@metorial/module-resource-tenant';

export let skillParticipantInclude = {
  skill: true,
  resourceActor: {
    include: resourceActorPresentationInclude
  }
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

  async setSkillParticipantAccessRole(d: {
    skill: Pick<Skill, 'oid'>;
    actor: Pick<ResourceActor, 'oid'>;
    permission: 'read' | 'write' | 'none';
  }) {
    return await withTransaction(async db => {
      let existing = await db.skillParticipant.findUnique({
        where: {
          skillOid_resourceActorOid: {
            skillOid: d.skill.oid,
            resourceActorOid: d.actor.oid
          }
        },
        include: skillParticipantInclude
      });
      let nextRoles = [
        ...withoutStoreBackedRoles(existing?.roles ?? []),
        ...(d.permission == 'write'
          ? (['editor'] as const)
          : d.permission == 'read'
            ? (['viewer'] as const)
            : [])
      ];

      if (existing) {
        if (nextRoles.length == 0) {
          return await db.skillParticipant.update({
            where: { id: existing.id },
            data: { roles: [] },
            include: skillParticipantInclude
          });
        }
        if (sameRoles(existing.roles, nextRoles)) return existing;

        return await db.skillParticipant.update({
          where: { id: existing.id },
          data: { roles: nextRoles },
          include: skillParticipantInclude
        });
      }
      if (nextRoles.length == 0) return undefined;

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

  async ensureSkillParticipantAccessRole(d: {
    skill: Pick<Skill, 'oid'>;
    actor: Pick<ResourceActor, 'oid'>;
    permission: 'read' | 'write';
  }) {
    let existing = await db.skillParticipant.findUnique({
      where: {
        skillOid_resourceActorOid: {
          skillOid: d.skill.oid,
          resourceActorOid: d.actor.oid
        }
      },
      include: skillParticipantInclude
    });
    if (
      existing?.roles.includes('editor') ||
      (d.permission == 'read' && existing?.roles.includes('viewer'))
    ) {
      return existing;
    }

    return await this.setSkillParticipantAccessRole(d);
  }

  async getSkillParticipantById(
    d: ResourceScope & {
      skillParticipantId: string;
    }
  ) {
    let participant = await db.skillParticipant.findFirst({
      where: {
        id: d.skillParticipantId,
        skill: {
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid
        },
        resourceActor: exposedParticipantResourceActorWhere
      },
      include: skillParticipantInclude
    });

    if (!participant) {
      throw new ServiceError(notFoundError('skill.participant', d.skillParticipantId));
    }

    return participant;
  }

  async listSkillParticipants(
    d: ResourceScope & {
      ids?: string[];
      skillId: string;
      actorIds?: string[];
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
    }
  ) {
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
              resourceActor: exposedParticipantResourceActorWhere,
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
