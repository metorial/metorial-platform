import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import type {
  EntityImage,
  Prisma,
  SkillMarketplacePluginStatus,
  SkillPluginStatus
} from '@metorial-cargo/db';
import { db, getId, withTransaction } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillConfigurations,
  resolveSkillMarketplacePlugins,
  resolveSkillMarketplaces,
  resolveSkillPlugins
} from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { internalImageService } from '../internal/image';
import {
  createSkillDestination,
  forceSkillDestinationSync,
  getSkillDestinationEditorUrl
} from '../internal/skillDestination';
import { enqueueSkillPluginLifecycle } from '../queues/lifecycle';

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

export let skillPluginInclude = {
  destination: {
    include: {
      syncs: {
        where: {
          status: {
            in: ['pending', 'processing']
          }
        }
      }
    }
  },
  skillConfiguration: {
    select: {
      id: true
    }
  },
  skillPluginSkills: {
    where: {
      status: 'active'
    },
    orderBy: {
      createdAt: 'asc'
    },
    include: {
      skillConfiguration: {
        select: {
          id: true
        }
      },
      skill: {
        include: skillInclude
      }
    }
  }
} satisfies Prisma.SkillPluginInclude;

export type SkillPluginRecord = Prisma.SkillPluginGetPayload<{
  include: typeof skillPluginInclude;
}>;

export type SkillPluginStatusFilter = SkillPluginStatus;

export let assertPluginIsNotManaged = (plugin: { isManaged: boolean }) => {
  if (!plugin.isManaged) return;

  throw new ServiceError(
    badRequestError({
      message: 'This plugin is managed and cannot be deleted'
    })
  );
};

type SkillPluginInput = {
  imageFileId?: string | null;
  image?: EntityImage | null;
  providerOverrides?: Prisma.InputJsonValue | null;
  name?: string;
  description?: string | null;
  longDescription?: string | null;
  category?: string | null;
  slug?: string;
  skillConfigurationId?: string | null;
};

class SkillPluginServiceImpl {
  private normalizeSlug(d: { slug?: string; name: string }) {
    let normalized = slugify(d.slug ?? d.name);
    if (!normalized) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill plugin slug must include at least one slug character'
        })
      );
    }

    return normalized;
  }

  private assertName(name: string) {
    if (name.trim()) return;

    throw new ServiceError(
      badRequestError({
        message: 'Skill plugin name cannot be empty'
      })
    );
  }

  private hasUpdate(input: SkillPluginInput) {
    return (
      input.imageFileId !== undefined ||
      input.image !== undefined ||
      input.providerOverrides !== undefined ||
      input.name !== undefined ||
      input.description !== undefined ||
      input.longDescription !== undefined ||
      input.category !== undefined ||
      input.slug !== undefined ||
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

  private async getSkillPluginRecord(
    d: CargoTenantEnvironment & {
      skillPluginId: string;
    }
  ) {
    return await withTransaction(
      async db => {
        let skillPlugin = await db.skillPlugin.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            id: d.skillPluginId
          },
          include: skillPluginInclude
        });

        if (!skillPlugin)
          throw new ServiceError(notFoundError('skill.plugin', d.skillPluginId));

        return skillPlugin;
      },
      { ifExists: true }
    );
  }

  async listSkillPlugins(
    d: CargoTenantEnvironment & {
      ids?: string[];
      skillMarketplaceIds?: string[];
      skillMarketplacePluginIds?: string[];
      skillConfigurationIds?: string[];
      statuses?: SkillPluginStatusFilter[];
      category?: string;
      slug?: string;
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
    }
  ) {
    let skillPlugins = await resolveSkillPlugins(d, d.ids);
    let skillMarketplaces = await resolveSkillMarketplaces(d, d.skillMarketplaceIds);
    let skillMarketplacePlugins = await resolveSkillMarketplacePlugins(
      d,
      d.skillMarketplacePluginIds
    );
    let skillConfigurations = await resolveSkillConfigurations(d, d.skillConfigurationIds);
    let statuses: SkillPluginStatus[] = d.statuses?.length ? d.statuses : ['active'];
    let activeMarketplacePluginStatus: SkillMarketplacePluginStatus = 'active';

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillPlugin.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              isManaged: false,
              AND: [
                skillPlugins ? { oid: skillPlugins.in } : undefined!,
                skillConfigurations
                  ? { skillConfigurationOid: skillConfigurations.in }
                  : undefined!,
                skillMarketplaces || skillMarketplacePlugins
                  ? {
                      skillMarketplacePlugins: {
                        some: {
                          status: activeMarketplacePluginStatus,
                          oid: skillMarketplacePlugins?.in,
                          skillMarketplaceOid: skillMarketplaces?.in,
                          skillMarketplace: {
                            tenantOid: d.tenant.oid,
                            environmentOid: d.environment.oid
                          }
                        }
                      }
                    }
                  : undefined!,
                { status: { in: statuses } },
                d.category ? { category: d.category } : undefined!,
                d.slug ? { slug: d.slug } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillPluginInclude
          })
      )
    );
  }

  async getSkillPluginById(
    d: CargoTenantEnvironment & {
      skillPluginId: string;
    }
  ) {
    return await this.getSkillPluginRecord(d);
  }

  async createSkillPlugin(
    d: CargoTenantEnvironment & {
      input: {
        name: string;
        description?: string | null;
        longDescription?: string | null;
        category?: string | null;
        slug?: string;
        providerOverrides?: Prisma.InputJsonValue | null;
        imageFileId?: string | null;
        skillConfigurationId?: string | null;
      };
    }
  ) {
    this.assertName(d.input.name);

    let skillConfigurationOid = await this.getSkillConfigurationOid({
      tenant: d.tenant,
      environment: d.environment,
      skillConfigurationId: d.input.skillConfigurationId
    });
    let slug = this.normalizeSlug({ slug: d.input.slug, name: d.input.name });

    return await withTransaction(async db => {
      let destination = await createSkillDestination({ tenant: d.tenant });
      let skillPlugin = await db.skillPlugin.create({
        data: {
          ...getId('skillPlugin'),
          status: 'active',
          isManaged: false,
          providerOverrides: d.input.providerOverrides as any,
          name: d.input.name,
          description: d.input.description,
          longDescription: d.input.longDescription,
          category: d.input.category,
          slug,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          skillConfigurationOid,
          destinationOid: destination.oid
        },
        include: skillPluginInclude
      });

      if (d.input.imageFileId !== undefined) {
        let image = await internalImageService.resolveImageEntityImage({
          tenant: d.tenant,
          environment: d.environment,
          entity: { id: skillPlugin.id, type: 'skill_plugin' },
          imageFileId: d.input.imageFileId,
          clearedImage: { type: 'default' }
        });

        skillPlugin = await db.skillPlugin.update({
          where: {
            id: skillPlugin.id
          },
          data: {
            image
          },
          include: skillPluginInclude
        });
      }

      await enqueueSkillPluginLifecycle({ skillPluginId: skillPlugin.id, event: 'created' });

      return skillPlugin;
    });
  }

  async updateSkillPlugin(
    d: CargoTenantEnvironment & {
      skillPlugin: SkillPluginRecord;
      input: SkillPluginInput;
    }
  ) {
    assertPluginIsNotManaged(d.skillPlugin);

    if (!this.hasUpdate(d.input)) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one skill plugin field must be updated'
        })
      );
    }

    if (d.input.name !== undefined) this.assertName(d.input.name);

    let skillConfigurationOid = await this.getSkillConfigurationOid({
      tenant: d.tenant,
      environment: d.environment,
      skillConfigurationId: d.input.skillConfigurationId
    });
    let nextImage = d.input.image;
    if (d.input.imageFileId !== undefined) {
      nextImage = await internalImageService.resolveImageEntityImage({
        tenant: d.tenant,
        environment: d.environment,
        entity: { id: d.skillPlugin.id, type: 'skill_plugin' },
        imageFileId: d.input.imageFileId,
        clearedImage: { type: 'default' }
      });
    }

    await db.skillPlugin.update({
      where: {
        id: d.skillPlugin.id
      },
      data: {
        image: nextImage as any,
        providerOverrides: d.input.providerOverrides as any,
        name: d.input.name,
        description: d.input.description,
        longDescription: d.input.longDescription,
        category: d.input.category,
        slug:
          d.input.slug !== undefined
            ? this.normalizeSlug({
                slug: d.input.slug,
                name: d.input.name ?? d.skillPlugin.name
              })
            : undefined,
        skillConfigurationOid
      }
    });

    if (
      d.input.imageFileId !== undefined &&
      d.skillPlugin.image &&
      canonicalize(d.skillPlugin.image) !== canonicalize(nextImage)
    ) {
      await internalImageService.cleanupImageEntityImage({
        image: d.skillPlugin.image as EntityImage
      });
    }

    await enqueueSkillPluginLifecycle({
      skillPluginId: d.skillPlugin.id,
      event: 'updated'
    });

    return await this.getSkillPluginRecord({
      tenant: d.tenant,
      environment: d.environment,
      skillPluginId: d.skillPlugin.id
    });
  }

  async archiveSkillPlugin(d: CargoTenantEnvironment & { skillPlugin: SkillPluginRecord }) {
    assertPluginIsNotManaged(d.skillPlugin);

    await withTransaction(async db => {
      await db.skillPluginSkill.updateMany({
        where: {
          skillPluginOid: d.skillPlugin.oid,
          status: 'active'
        },
        data: {
          status: 'archived',
          clientName: null,
          clientDescription: null,
          clientMetadata: null,
          license: null,
          compatibility: null,
          skillConfigurationOid: null
        }
      });

      await db.skillMarketplacePlugin.updateMany({
        where: {
          skillPluginOid: d.skillPlugin.oid,
          status: 'active'
        },
        data: {
          status: 'archived',
          skillConfigurationOid: null
        }
      });

      await db.skillPlugin.update({
        where: {
          id: d.skillPlugin.id
        },
        data: {
          status: 'archived'
        }
      });

      await enqueueSkillPluginLifecycle({
        skillPluginId: d.skillPlugin.id,
        event: 'archived'
      });
    });

    return await this.getSkillPluginRecord({
      tenant: d.tenant,
      environment: d.environment,
      skillPluginId: d.skillPlugin.id
    });
  }

  async getSkillPluginEditorUrl(
    d: CargoTenantEnvironment & {
      skillPlugin: SkillPluginRecord;
      isReadOnly?: boolean;
    }
  ) {
    return await getSkillDestinationEditorUrl({
      tenant: d.tenant,
      destination: d.skillPlugin.destination,
      isReadOnly: d.isReadOnly
    });
  }

  async forceSkillPluginSync(d: CargoTenantEnvironment & { skillPlugin: SkillPluginRecord }) {
    await forceSkillDestinationSync({
      destination: d.skillPlugin.destination
    });

    return await this.getSkillPluginRecord({
      tenant: d.tenant,
      environment: d.environment,
      skillPluginId: d.skillPlugin.id
    });
  }
}

export let skillPluginService = Service.create(
  'cargoSkillPluginService',
  () => new SkillPluginServiceImpl()
).build();
