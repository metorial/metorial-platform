import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import { actorService } from './actor';
import type { CargoTenantEnvironment } from './filePurpose';
import type { SkillTemplateRecord } from './skillTemplate';
import { storeService } from './store';

let skillInclude = {
  store: true,
  parentSkill: {
    select: {
      id: true
    }
  },
  parentSkillTemplate: {
    select: {
      id: true
    }
  }
} satisfies Prisma.SkillInclude;

export type SkillRecord = Prisma.SkillGetPayload<{
  include: typeof skillInclude;
}>;

class SkillServiceImpl {
  private async getSkillRecord(d: CargoTenantEnvironment & { skillId: string }) {
    return await withTransaction(
      async db => {
        let skill = await db.skill.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            id: d.skillId
          },
          include: skillInclude
        });

        if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

        return skill;
      },
      { ifExists: true }
    );
  }

  async createSkill(
    d: CargoTenantEnvironment & {
      parentSkill?: SkillRecord;
      parentSkillTemplate?: SkillTemplateRecord;
      parentSkillCloneType?: 'fork' | 'duplicate';
      input: {
        id?: string;
        actorId?: string;
        name: string;
      };
    }
  ) {
    if (!d.input.name.trim()) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill name cannot be empty'
        })
      );
    }

    if (d.parentSkill && d.parentSkillTemplate) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill can only have one parent source'
        })
      );
    }

    let actor = d.input.actorId
      ? await actorService.getActorById({
          tenant: d.tenant,
          actorId: d.input.actorId
        })
      : undefined;

    return await withTransaction(async db => {
      let skillIds = d.input.id ? { oid: getId('skill').oid, id: d.input.id } : getId('skill');
      let store = d.parentSkillTemplate
        ? await storeService.createStoreFromTemplate({
            tenant: d.tenant,
            environment: d.environment,
            input: {
              templateId: d.parentSkillTemplate.storeTemplate.id,
              name: d.input.name,
              actor,
              access: 'public_read'
            }
          })
        : await storeService.createStore({
            tenant: d.tenant,
            environment: d.environment,
            input: {
              name: d.input.name,
              actor,
              access: 'public_read',
              parentStore: d.parentSkill?.store,
              cloneType:
                d.parentSkillCloneType === 'duplicate' ? 'duplicate' : 'sync_until_change'
            }
          });

      return await db.skill.create({
        data: {
          oid: skillIds.oid,
          id: skillIds.id,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          storeOid: store.oid,
          parentSkillOid: d.parentSkill?.oid,
          parentSkillTemplateOid: d.parentSkillTemplate?.oid,
          createdByTenantActorOid: actor?.oid
        },
        include: skillInclude
      });
    });
  }

  async listSkills(d: CargoTenantEnvironment) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skill.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid
            },
            include: skillInclude
          })
      )
    );
  }

  async getSkillById(
    d: CargoTenantEnvironment & {
      skillId: string;
    }
  ) {
    return await this.getSkillRecord(d);
  }

  async updateSkill(
    d: CargoTenantEnvironment & {
      skill: SkillRecord;
      input: {
        name?: string;
      };
    }
  ) {
    if (d.input.name === undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one skill field must be updated'
        })
      );
    }

    if (!d.input.name.trim()) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill name cannot be empty'
        })
      );
    }

    let store = await storeService.updateStore({
      environment: d.environment,
      tenant: d.tenant,
      store: d.skill.store,
      input: {
        name: d.input.name
      }
    });

    return {
      ...d.skill,
      store
    } satisfies SkillRecord;
  }

  async deleteSkill(d: CargoTenantEnvironment & { skill: SkillRecord }) {
    await storeService.deleteStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.skill.store,
      allowLinkedSkillDelete: true,
      allowLinkedStoreTemplateDelete: true
    });

    return d.skill;
  }
}

export let skillService = Service.create(
  'cargoSkillService',
  () => new SkillServiceImpl()
).build();
