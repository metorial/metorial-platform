import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, PrismaClient } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import type { CargoTenantEnvironment } from './filePurpose';
import { storeService } from './store';

let skillInclude = {
  store: true
} satisfies Prisma.SkillInclude;

export type SkillRecord = Prisma.SkillGetPayload<{
  include: typeof skillInclude;
}>;

type DbClient = PrismaClient | Prisma.TransactionClient;

class SkillServiceImpl {
  private async getSkillRecord(
    client: DbClient,
    d: CargoTenantEnvironment & {
      skillId: string;
    }
  ) {
    let skill = await client.skill.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.skillId
      },
      include: skillInclude
    });

    if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

    return skill;
  }

  async createSkill(
    d: CargoTenantEnvironment & {
      input: {
        id?: string;
        storeId?: string;
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

    return await db.$transaction(async client => {
      let skillIds = d.input.id ? { oid: getId('skill').oid, id: d.input.id } : getId('skill');
      let store = await storeService.createStore({
        tenant: d.tenant,
        environment: d.environment,
        client,
        input: {
          id: d.input.storeId,
          name: d.input.name
        }
      });

      return await client.skill.create({
        data: {
          oid: skillIds.oid,
          id: skillIds.id,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          storeOid: store.oid
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
    return await this.getSkillRecord(db, d);
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
      allowLinkedSkillDelete: true
    });

    return d.skill;
  }
}

export let skillService = Service.create(
  'cargoSkillService',
  () => new SkillServiceImpl()
).build();
