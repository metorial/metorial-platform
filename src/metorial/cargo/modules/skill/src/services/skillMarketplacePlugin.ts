import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import { getId } from '@metorial/cargo-config/id';
import {
  type CargoScope,
  type DateFilter,
  normalizeDateFilter,
  resolveSkillConfigurations,
  resolveSkillMarketplacePlugins,
  resolveSkillPlugins
} from '@metorial/cargo-list-utils';
import type { Prisma, SkillMarketplacePluginStatus } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import {
  assertSkillMarketplacePluginLimit,
  assertSkillMarketplaceSkillLimit,
  CargoSkillLimitError,
  toCargoSkillLimitServiceError
} from '../lib/limits';
import { enqueueSkillMarketplacePluginLifecycle } from '../queues/lifecycle';
import type { SkillMarketplaceRecord } from './skillMarketplace';
import { skillConfigurationService } from './skillConfiguration';
import {
  assertPluginIsNotManaged,
  skillPluginInclude,
  skillPluginService
} from './skillPlugin';

export let skillMarketplacePluginInclude = {
  skillConfiguration: {
    select: {
      id: true
    }
  },
  skillMarketplace: {
    select: {
      id: true,
      destinationOid: true
    }
  },
  skillPlugin: {
    include: skillPluginInclude
  }
} satisfies Prisma.SkillMarketplacePluginInclude;

export type SkillMarketplacePluginRecord = Prisma.SkillMarketplacePluginGetPayload<{
  include: typeof skillMarketplacePluginInclude;
}>;

export type SkillMarketplacePluginStatusFilter = SkillMarketplacePluginStatus;

let getMarketplacePluginSlug = createSlugGenerator(
  async (slug, d: { skillMarketplaceId: string }) =>
    !(await db.skillMarketplacePlugin.findFirst({
      where: {
        skillMarketplace: {
          id: d.skillMarketplaceId
        },
        pluginSlug: slug
      }
    }))
);

class SkillMarketplacePluginServiceImpl {
  private async getSkillMarketplacePluginRecord(
    d: CargoScope & {
      skillMarketplacePluginId: string;
      skillMarketplace?: SkillMarketplaceRecord;
    }
  ) {
    return await withTransaction(
      async db => {
        let skillMarketplacePlugin = await db.skillMarketplacePlugin.findFirst({
          where: {
            id: d.skillMarketplacePluginId,
            skillMarketplaceOid: d.skillMarketplace?.oid,
            skillMarketplace: {
              projectOid: d.project.oid,
              instanceOid: d.instance.oid
            },
            skillPlugin: {
              projectOid: d.project.oid,
              instanceOid: d.instance.oid
            }
          },
          include: skillMarketplacePluginInclude
        });

        if (!skillMarketplacePlugin) {
          throw new ServiceError(
            notFoundError('skill.marketplace.plugin', d.skillMarketplacePluginId)
          );
        }

        return skillMarketplacePlugin;
      },
      { ifExists: true }
    );
  }

  async listSkillMarketplacePlugins(
    d: CargoScope & {
      skillMarketplace: SkillMarketplaceRecord;
      ids?: string[];
      skillPluginIds?: string[];
      skillConfigurationIds?: string[];
      statuses?: SkillMarketplacePluginStatusFilter[];
      pluginSlug?: string;
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
    }
  ) {
    let skillMarketplacePlugins = await resolveSkillMarketplacePlugins(d, d.ids);
    let skillPlugins = await resolveSkillPlugins(d, d.skillPluginIds);
    let skillConfigurations = await resolveSkillConfigurations(d, d.skillConfigurationIds);
    let statuses: SkillMarketplacePluginStatus[] = d.statuses?.length
      ? d.statuses
      : ['active'];

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillMarketplacePlugin.findMany({
            ...opts,
            where: {
              skillMarketplaceOid: d.skillMarketplace.oid,
              skillPlugin: {
                projectOid: d.project.oid,
                instanceOid: d.instance.oid,
                isManaged: false
              },
              AND: [
                skillMarketplacePlugins ? { oid: skillMarketplacePlugins.in } : undefined!,
                skillPlugins ? { skillPluginOid: skillPlugins.in } : undefined!,
                skillConfigurations
                  ? { skillConfigurationOid: skillConfigurations.in }
                  : undefined!,
                { status: { in: statuses } },
                d.pluginSlug ? { pluginSlug: d.pluginSlug } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillMarketplacePluginInclude
          })
      )
    );
  }

  async getSkillMarketplacePluginById(
    d: CargoScope & {
      skillMarketplacePluginId: string;
      skillMarketplace?: SkillMarketplaceRecord;
    }
  ) {
    return await this.getSkillMarketplacePluginRecord(d);
  }

  async addSkillMarketplacePlugin(
    d: CargoScope & {
      skillMarketplace: SkillMarketplaceRecord;
      input: {
        skillPluginId: string;
        pluginSlug?: string;
        skillConfigurationId?: string | null;
      };
    }
  ) {
    let skillPlugin = await skillPluginService.getSkillPluginById({
      project: d.project,
      instance: d.instance,
      skillPluginId: d.input.skillPluginId
    });
    assertPluginIsNotManaged(skillPlugin);

    let existingSkillMarketplacePlugin = await db.skillMarketplacePlugin.findFirst({
      where: {
        skillMarketplaceOid: d.skillMarketplace.oid,
        skillPluginOid: skillPlugin.oid
      },
      select: {
        pluginSlug: true
      }
    });
    let pluginSlug = await getMarketplacePluginSlug(
      {
        input: d.input.pluginSlug ?? skillPlugin.name ?? skillPlugin.slug ?? skillPlugin.id,
        current: existingSkillMarketplacePlugin?.pluginSlug
      },
      { skillMarketplaceId: d.skillMarketplace.id }
    );
    let skillConfigurationOid =
      d.input.skillConfigurationId === undefined
        ? undefined
        : d.input.skillConfigurationId === null
          ? null
          : (
              await skillConfigurationService.getSkillConfigurationById({
                project: d.project,
                instance: d.instance,
                skillConfigurationId: d.input.skillConfigurationId
              })
            ).oid;

    return await withTransaction(async db => {
      let matches = await db.skillMarketplacePlugin.findMany({
        where: {
          skillMarketplaceOid: d.skillMarketplace.oid,
          OR: [{ skillPluginOid: skillPlugin.oid }, { pluginSlug }]
        },
        include: skillMarketplacePluginInclude
      });
      if (new Set(matches.map(m => m.oid.toString())).size > 1) {
        throw new ServiceError(
          badRequestError({
            message: 'Marketplace plugin slug is already in use'
          })
        );
      }

      let skillMarketplacePlugin = matches[0];
      let lifecycleEvent: 'created' | 'updated' = 'updated';
      let activatesMarketplacePlugin =
        !skillMarketplacePlugin || skillMarketplacePlugin.status !== 'active';

      if (activatesMarketplacePlugin) {
        try {
          await assertSkillMarketplacePluginLimit({
            skillMarketplaceOid: d.skillMarketplace.oid,
            additionalCount: 1
          });

          await assertSkillMarketplaceSkillLimit({
            skillMarketplaceOid: d.skillMarketplace.oid,
            additionalCount: skillPlugin.skillPluginSkills.filter(
              skillPluginSkill => skillPluginSkill.skill.status === 'active'
            ).length
          });
        } catch (error) {
          if (error instanceof CargoSkillLimitError) {
            throw toCargoSkillLimitServiceError(error);
          }

          throw error;
        }
      }

      if (skillMarketplacePlugin) {
        if (skillMarketplacePlugin.pluginSlug !== pluginSlug) {
          throw new ServiceError(
            badRequestError({
              message: 'Marketplace plugin slug cannot be changed'
            })
          );
        }

        skillMarketplacePlugin = await db.skillMarketplacePlugin.update({
          where: {
            id: skillMarketplacePlugin.id
          },
          data: {
            status: 'active',
            skillPluginOid: skillPlugin.oid,
            skillConfigurationOid
          },
          include: skillMarketplacePluginInclude
        });
      } else {
        lifecycleEvent = 'created';
        skillMarketplacePlugin = await db.skillMarketplacePlugin.create({
          data: {
            ...getId('skillMarketplacePlugin'),
            status: 'active',
            pluginSlug,
            skillConfigurationOid,
            skillMarketplaceOid: d.skillMarketplace.oid,
            skillPluginOid: skillPlugin.oid
          },
          include: skillMarketplacePluginInclude
        });
      }

      await enqueueSkillMarketplacePluginLifecycle({
        skillMarketplacePluginId: skillMarketplacePlugin.id,
        event: lifecycleEvent
      });

      return skillMarketplacePlugin;
    });
  }

  async removeSkillMarketplacePlugin(
    d: CargoScope & {
      skillMarketplacePlugin: SkillMarketplacePluginRecord;
    }
  ) {
    assertPluginIsNotManaged(d.skillMarketplacePlugin.skillPlugin);

    let skillMarketplacePlugin = await db.skillMarketplacePlugin.update({
      where: {
        id: d.skillMarketplacePlugin.id
      },
      data: {
        status: 'archived',
        skillConfigurationOid: null
      },
      include: skillMarketplacePluginInclude
    });

    await enqueueSkillMarketplacePluginLifecycle({
      skillMarketplacePluginId: skillMarketplacePlugin.id,
      event: 'archived'
    });

    return skillMarketplacePlugin;
  }
}

export let skillMarketplacePluginService = Service.create(
  'cargoSkillMarketplacePluginService',
  () => new SkillMarketplacePluginServiceImpl()
).build();
