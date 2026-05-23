import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { createSlugGenerator } from '@mtsrc/slugify';
import type { Prisma, SkillPluginSkillStatus } from '@metorial-cargo/db';
import { db, getId, withTransaction } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillConfigurations,
  resolveSkillPluginSkills,
  resolveSkills
} from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import {
  CargoSkillLimitError,
  assertSkillMarketplaceSkillLimit,
  assertSkillPluginSkillLimit,
  toCargoSkillLimitServiceError
} from '../lib/limits';
import { enqueueSkillPluginSkillLifecycle } from '../queues/lifecycle';
import type { SkillPluginRecord } from './skillPlugin';
import { assertPluginIsNotManaged, skillPluginInclude } from './skillPlugin';

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

export let skillPluginSkillInclude = {
  skillConfiguration: {
    select: {
      id: true
    }
  },
  skillPlugin: {
    include: skillPluginInclude
  },
  skill: {
    include: skillInclude
  }
} satisfies Prisma.SkillPluginSkillInclude;

export type SkillPluginSkillRecord = Prisma.SkillPluginSkillGetPayload<{
  include: typeof skillPluginSkillInclude;
}>;

export type SkillPluginSkillStatusFilter = SkillPluginSkillStatus;

type SkillPluginSkillInput = {
  clientName?: string | null;
  clientDescription?: string | null;
  clientMetadata?: Prisma.InputJsonValue | null;
  license?: string | null;
  compatibility?: string | null;
  skillConfigurationId?: string | null;
};

let getPluginSkillSlug = createSlugGenerator(
  async (slug, d: { skillPluginId: string }) =>
    !(await db.skillPluginSkill.findFirst({
      where: {
        skillPlugin: {
          id: d.skillPluginId
        },
        pluginSkillSlug: slug
      }
    }))
);

class SkillPluginSkillServiceImpl {
  private hasUpdate(input: SkillPluginSkillInput) {
    return (
      input.clientName !== undefined ||
      input.clientDescription !== undefined ||
      input.clientMetadata !== undefined ||
      input.license !== undefined ||
      input.compatibility !== undefined ||
      input.skillConfigurationId !== undefined
    );
  }

  private async getSkillConfigurationOid(
    d: CargoTenantEnvironment & {
      skillConfigurationId: string | null | undefined;
    }
  ) {
    if (d.skillConfigurationId === undefined) return undefined;
    if (d.skillConfigurationId === null) return null;

    let skillConfiguration = await db.skillConfiguration.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.skillConfigurationId
      },
      select: {
        oid: true
      }
    });
    if (!skillConfiguration) {
      throw new ServiceError(notFoundError('skill.configuration', d.skillConfigurationId));
    }

    return skillConfiguration.oid;
  }

  private async getSkill(
    d: CargoTenantEnvironment & {
      skillId: string;
    }
  ) {
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
  }

  private async getSkillPluginSkillRecord(
    d: CargoTenantEnvironment & {
      skillPluginSkillId: string;
      skillPlugin?: SkillPluginRecord;
    }
  ) {
    return await withTransaction(
      async db => {
        let skillPluginSkill = await db.skillPluginSkill.findFirst({
          where: {
            id: d.skillPluginSkillId,
            skillPluginOid: d.skillPlugin?.oid,
            skillPlugin: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid
            },
            skill: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid
            }
          },
          include: skillPluginSkillInclude
        });

        if (!skillPluginSkill) {
          throw new ServiceError(notFoundError('skill.plugin.skill', d.skillPluginSkillId));
        }

        return skillPluginSkill;
      },
      { ifExists: true }
    );
  }

  async listSkillPluginSkills(
    d: CargoTenantEnvironment & {
      skillPlugin: SkillPluginRecord;
      ids?: string[];
      skillIds?: string[];
      skillConfigurationIds?: string[];
      statuses?: SkillPluginSkillStatusFilter[];
      pluginSkillSlug?: string;
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
    }
  ) {
    let skillPluginSkills = await resolveSkillPluginSkills(d, d.ids);
    let skills = await resolveSkills(d, d.skillIds);
    let skillConfigurations = await resolveSkillConfigurations(d, d.skillConfigurationIds);
    let statuses: SkillPluginSkillStatus[] = d.statuses?.length ? d.statuses : ['active'];

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillPluginSkill.findMany({
            ...opts,
            where: {
              skillPluginOid: d.skillPlugin.oid,
              skill: {
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid
              },
              AND: [
                skillPluginSkills ? { oid: skillPluginSkills.in } : undefined!,
                skills ? { skillOid: skills.in } : undefined!,
                skillConfigurations
                  ? { skillConfigurationOid: skillConfigurations.in }
                  : undefined!,
                { status: { in: statuses } },
                d.pluginSkillSlug ? { pluginSkillSlug: d.pluginSkillSlug } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillPluginSkillInclude
          })
      )
    );
  }

  async getSkillPluginSkillById(
    d: CargoTenantEnvironment & {
      skillPluginSkillId: string;
      skillPlugin?: SkillPluginRecord;
    }
  ) {
    return await this.getSkillPluginSkillRecord(d);
  }

  async addSkillPluginSkill(
    d: CargoTenantEnvironment & {
      skillPlugin: SkillPluginRecord;
      input: {
        skillId: string;
        pluginSkillSlug?: string;
      } & SkillPluginSkillInput;
    }
  ) {
    assertPluginIsNotManaged(d.skillPlugin);

    let skill = await this.getSkill({
      tenant: d.tenant,
      environment: d.environment,
      skillId: d.input.skillId
    });
    let existingSkillPluginSkill = await db.skillPluginSkill.findFirst({
      where: {
        skillPluginOid: d.skillPlugin.oid,
        skillOid: skill.oid
      },
      select: {
        pluginSkillSlug: true
      }
    });
    let pluginSkillSlug = await getPluginSkillSlug(
      {
        input: d.input.pluginSkillSlug ?? skill.clientName ?? skill.name ?? skill.id,
        current: existingSkillPluginSkill?.pluginSkillSlug
      },
      { skillPluginId: d.skillPlugin.id }
    );
    let skillConfigurationOid = await this.getSkillConfigurationOid({
      tenant: d.tenant,
      environment: d.environment,
      skillConfigurationId: d.input.skillConfigurationId
    });

    return await withTransaction(async db => {
      let matches = await db.skillPluginSkill.findMany({
        where: {
          skillPluginOid: d.skillPlugin.oid,
          OR: [{ skillOid: skill.oid }, { pluginSkillSlug }]
        },
        include: skillPluginSkillInclude
      });
      if (new Set(matches.map(m => m.oid.toString())).size > 1) {
        throw new ServiceError(
          badRequestError({
            message: 'Plugin skill slug is already in use'
          })
        );
      }

      let skillPluginSkill = matches[0];
      let lifecycleEvent: 'created' | 'updated' = 'updated';
      let activatesSkillLink = !skillPluginSkill || skillPluginSkill.status !== 'active';
      let activeSkillDelta = activatesSkillLink && skill.status === 'active' ? 1 : 0;

      if (activeSkillDelta > 0) {
        try {
          await assertSkillPluginSkillLimit({
            skillPluginOid: d.skillPlugin.oid,
            additionalCount: activeSkillDelta
          });

          let marketplacePlugins = await db.skillMarketplacePlugin.findMany({
            where: {
              skillPluginOid: d.skillPlugin.oid,
              status: 'active',
              skillMarketplace: {
                status: 'active'
              }
            },
            select: {
              skillMarketplaceOid: true
            }
          });

          for (let marketplacePlugin of marketplacePlugins) {
            await assertSkillMarketplaceSkillLimit({
              skillMarketplaceOid: marketplacePlugin.skillMarketplaceOid,
              additionalCount: activeSkillDelta
            });
          }
        } catch (error) {
          if (error instanceof CargoSkillLimitError) {
            throw toCargoSkillLimitServiceError(error);
          }

          throw error;
        }
      }

      if (skillPluginSkill) {
        if (skillPluginSkill.pluginSkillSlug !== pluginSkillSlug) {
          throw new ServiceError(
            badRequestError({
              message: 'Plugin skill slug cannot be changed'
            })
          );
        }

        skillPluginSkill = await db.skillPluginSkill.update({
          where: {
            id: skillPluginSkill.id
          },
          data: {
            status: 'active',
            skillOid: skill.oid,
            clientName: d.input.clientName,
            clientDescription: d.input.clientDescription,
            clientMetadata: d.input.clientMetadata as any,
            license: d.input.license,
            compatibility: d.input.compatibility,
            skillConfigurationOid
          },
          include: skillPluginSkillInclude
        });
      } else {
        lifecycleEvent = 'created';
        skillPluginSkill = await db.skillPluginSkill.create({
          data: {
            ...getId('skillPluginSkill'),
            status: 'active',
            pluginSkillSlug,
            clientName: d.input.clientName,
            clientDescription: d.input.clientDescription,
            clientMetadata: d.input.clientMetadata as any,
            license: d.input.license,
            compatibility: d.input.compatibility,
            skillConfigurationOid,
            skillOid: skill.oid,
            skillPluginOid: d.skillPlugin.oid
          },
          include: skillPluginSkillInclude
        });
      }

      await enqueueSkillPluginSkillLifecycle({
        skillPluginSkillId: skillPluginSkill.id,
        event: lifecycleEvent
      });

      return skillPluginSkill;
    });
  }

  async updateSkillPluginSkill(
    d: CargoTenantEnvironment & {
      skillPluginSkill: SkillPluginSkillRecord;
      input: SkillPluginSkillInput;
    }
  ) {
    assertPluginIsNotManaged(d.skillPluginSkill.skillPlugin);

    if (!this.hasUpdate(d.input)) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one plugin skill field must be updated'
        })
      );
    }

    let skillConfigurationOid = await this.getSkillConfigurationOid({
      tenant: d.tenant,
      environment: d.environment,
      skillConfigurationId: d.input.skillConfigurationId
    });

    let skillPluginSkill = await db.skillPluginSkill.update({
      where: {
        id: d.skillPluginSkill.id
      },
      data: {
        clientName: d.input.clientName,
        clientDescription: d.input.clientDescription,
        clientMetadata: d.input.clientMetadata as any,
        license: d.input.license,
        compatibility: d.input.compatibility,
        skillConfigurationOid
      },
      include: skillPluginSkillInclude
    });

    await enqueueSkillPluginSkillLifecycle({
      skillPluginSkillId: d.skillPluginSkill.id,
      event: 'updated'
    });

    return skillPluginSkill;
  }

  async removeSkillPluginSkill(
    d: CargoTenantEnvironment & {
      skillPluginSkill: SkillPluginSkillRecord;
    }
  ) {
    assertPluginIsNotManaged(d.skillPluginSkill.skillPlugin);

    let skillPluginSkill = await db.skillPluginSkill.update({
      where: {
        id: d.skillPluginSkill.id
      },
      data: {
        status: 'archived',
        clientName: null,
        clientDescription: null,
        clientMetadata: null,
        license: null,
        compatibility: null,
        skillConfigurationOid: null
      },
      include: skillPluginSkillInclude
    });

    await enqueueSkillPluginSkillLifecycle({
      skillPluginSkillId: d.skillPluginSkill.id,
      event: 'archived'
    });

    return skillPluginSkill;
  }
}

export let skillPluginSkillService = Service.create(
  'cargoSkillPluginSkillService',
  () => new SkillPluginSkillServiceImpl()
).build();
