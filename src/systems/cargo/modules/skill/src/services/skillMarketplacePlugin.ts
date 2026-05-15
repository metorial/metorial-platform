import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import type { Prisma, SkillMarketplacePluginStatus } from '@metorial-cargo/db';
import { db, getId, withTransaction } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillConfigurations,
  resolveSkillMarketplacePlugins,
  resolveSkillPlugins
} from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { enqueueSkillDestinationSync } from '../internal/skillDestination';
import type { SkillMarketplaceRecord } from './skillMarketplace';
import { assertPluginIsNotManaged, skillPluginInclude } from './skillPlugin';

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

  private async getSkillPlugin(
    d: CargoTenantEnvironment & {
      skillPluginId: string;
    }
  ) {
    let skillPlugin = await db.skillPlugin.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.skillPluginId
      },
      include: skillPluginInclude
    });
    if (!skillPlugin) throw new ServiceError(notFoundError('skill.plugin', d.skillPluginId));

    return skillPlugin;
  }

  private async getSkillMarketplacePluginRecord(
    d: CargoTenantEnvironment & {
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
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid
            },
            skillPlugin: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid
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
    d: CargoTenantEnvironment & {
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
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid,
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
    d: CargoTenantEnvironment & {
      skillMarketplacePluginId: string;
      skillMarketplace?: SkillMarketplaceRecord;
    }
  ) {
    return await this.getSkillMarketplacePluginRecord(d);
  }

  async addSkillMarketplacePlugin(
    d: CargoTenantEnvironment & {
      skillMarketplace: SkillMarketplaceRecord;
      input: {
        skillPluginId: string;
        pluginSlug?: string;
        skillConfigurationId?: string | null;
      };
    }
  ) {
    let skillPlugin = await this.getSkillPlugin({
      tenant: d.tenant,
      environment: d.environment,
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
    let skillConfigurationOid = await this.getSkillConfigurationOid({
      tenant: d.tenant,
      environment: d.environment,
      skillConfigurationId: d.input.skillConfigurationId
    });

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

      await enqueueSkillDestinationSync(d.skillMarketplace.destinationOid);

      return skillMarketplacePlugin;
    });
  }

  async removeSkillMarketplacePlugin(
    d: CargoTenantEnvironment & {
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

    await enqueueSkillDestinationSync(
      d.skillMarketplacePlugin.skillMarketplace.destinationOid
    );

    return skillMarketplacePlugin;
  }
}

export let skillMarketplacePluginService = Service.create(
  'cargoSkillMarketplacePluginService',
  () => new SkillMarketplacePluginServiceImpl()
).build();
