import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import type {
  EntityImage,
  Instance,
  Prisma,
  Project,
  SkillMarketplacePluginStatus,
  SkillPluginStatus
} from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillConfigurations,
  resolveSkillMarketplacePlugins,
  resolveSkillMarketplaces,
  resolveSkillPlugins
} from '@metorial/list-utils';
import { skillConfigurationService } from '@metorial/module-skill-configurations';
import { consumerAccessService } from '@metorial/module-consumer-access';
import { getProjectTenantIdentifier } from '@metorial/skills-common';
import { internalImageService } from '@metorial/skills-images';
import {
  createSkillDestination,
  getSkillDestinationEditorUrl
} from '@metorial/skills-scm-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial/skills-search';
import { forceSkillDestinationSync } from '../lib/destinationSync';
import {
  assertSkillMarketplacePluginLimit,
  CargoSkillLimitError,
  toCargoSkillLimitServiceError
} from '../lib/limits';
import {
  assertSkillMarketplaceWriteAccess,
  assertSkillPluginArchiveAccess,
  assertSkillPluginWriteAccess,
  getSkillMarketplaceAccessWhere,
  type SkillMarketplaceAccessInput
} from '../lib/skillMarketplaceAccess';
import {
  enqueueSkillMarketplacePluginLifecycle,
  enqueueSkillPluginLifecycle
} from '../queues/lifecycle';

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
            in: ['pending', 'processing', 'waiting_for_review']
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

export let getSkillPluginFabricContext = async (d: {
  organizationOid: bigint;
  instance?: Instance;
  instanceOid?: bigint;
}) => {
  let organization = await db.organization.findUnique({
    where: { oid: d.organizationOid }
  });
  if (!organization) throw new ServiceError(notFoundError('organization'));

  let instance = d.instance;
  if (!instance) {
    if (d.instanceOid == null) throw new ServiceError(notFoundError('instance'));

    instance =
      (await db.instance.findUnique({
        where: { oid: d.instanceOid }
      })) ?? undefined;
  }
  if (!instance) throw new ServiceError(notFoundError('instance'));

  return { organization, instance };
};

type SkillPluginInput = {
  imageFileId?: string | null;
  image?: EntityImage | null;
  providerOverrides?: Prisma.InputJsonValue | null;
  name?: string;
  description?: string | null;
  longDescription?: string | null;
  category?: string | null;
  skillConfigurationId?: string | null;
};

class SkillPluginServiceImpl {
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
      input.skillConfigurationId !== undefined
    );
  }

  private async getSkillPluginRecord(d: {
    project: Project;
    instance: Instance;
    skillPluginId: string;
  }) {
    return await withTransaction(
      async db => {
        let skillPlugin = await db.skillPlugin.findFirst({
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
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
    d: {
      project: Project;
      instance: Instance;
      ids?: string[];
      skillMarketplaceIds?: string[];
      skillMarketplacePluginIds?: string[];
      skillConfigurationIds?: string[];
      statuses?: SkillPluginStatusFilter[];
      search?: string;
      category?: string;
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
    } & SkillMarketplaceAccessInput
  ) {
    let marketplaceAccessWhere = await getSkillMarketplaceAccessWhere(d);
    let skillPlugins = await resolveSkillPlugins(d, d.ids);
    let skillMarketplaces = await resolveSkillMarketplaces(d, d.skillMarketplaceIds);
    let skillMarketplacePlugins = await resolveSkillMarketplacePlugins(
      d,
      d.skillMarketplacePluginIds
    );
    let skillConfigurations = await resolveSkillConfigurations(d, d.skillConfigurationIds);
    let statuses: SkillPluginStatus[] = d.statuses?.length ? d.statuses : ['active'];
    let activeMarketplacePluginStatus: SkillMarketplacePluginStatus = 'active';
    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let search = d.search
      ? await voyager.record.search({
          tenantId: getProjectTenantIdentifier(d.project),
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.skillPlugin.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillPlugin.findMany({
            ...opts,
            where: {
              projectOid: d.project.oid,
              instanceOid: d.instance.oid,
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
                            projectOid: d.project.oid,
                            instanceOid: d.instance.oid
                          }
                        }
                      }
                    }
                  : undefined!,
                marketplaceAccessWhere
                  ? {
                      skillMarketplacePlugins: {
                        some: {
                          status: activeMarketplacePluginStatus,
                          skillMarketplace: {
                            projectOid: d.project.oid,
                            instanceOid: d.instance.oid,
                            status: 'active',
                            AND: [marketplaceAccessWhere]
                          }
                        }
                      }
                    }
                  : undefined!,
                { status: { in: statuses } },
                d.category ? { category: d.category } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean) as Prisma.SkillPluginWhereInput[]
            },
            include: skillPluginInclude
          })
      )
    );
  }

  async reconcileSkillPlugins(d: {}) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillPlugin.findMany({
            ...opts,
            where: {},
            include: skillPluginInclude
          })
      )
    );
  }

  async getSkillPluginById(d: {
    project: Project;
    instance: Instance;
    skillPluginId: string;
  }) {
    return await this.getSkillPluginRecord(d);
  }

  async createSkillPlugin(d: {
    project: Project;
    instance: Instance;
    skillMarketplaceId?: string;
    accessTags?: SkillMarketplaceAccessInput['accessTags'];
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
  }) {
    this.assertName(d.input.name);

    if (d.accessTags && !d.skillMarketplaceId) {
      throw new ServiceError(
        badRequestError({
          message: 'skill_marketplace_id is required to create a skill plugin.'
        })
      );
    }

    let marketplaceAccessWhere = d.accessTags
      ? await getSkillMarketplaceAccessWhere(d)
      : undefined;
    let skillMarketplace = d.skillMarketplaceId
      ? await db.skillMarketplace.findFirst({
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
            id: d.skillMarketplaceId,
            status: 'active',
            AND: marketplaceAccessWhere ? [marketplaceAccessWhere] : undefined
          }
        })
      : null;
    if (d.skillMarketplaceId && !skillMarketplace) {
      throw new ServiceError(notFoundError('skill.marketplace', d.skillMarketplaceId));
    }
    if (skillMarketplace) {
      await assertSkillMarketplaceWriteAccess({
        skillMarketplace,
        accessTags: d.accessTags
      });
      try {
        await assertSkillMarketplacePluginLimit({
          skillMarketplaceOid: skillMarketplace.oid,
          additionalCount: 1
        });
      } catch (error) {
        if (error instanceof CargoSkillLimitError) {
          throw toCargoSkillLimitServiceError(error);
        }

        throw error;
      }
    }

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

    let { organization } = await getSkillPluginFabricContext({
      organizationOid: d.instance.organizationOid,
      instance: d.instance
    });

    return await withTransaction(async db => {
      await Fabric.fire('skill.plugin.created:before', {
        organization,
        instance: d.instance
      });

      let destination = await createSkillDestination({ project: d.project });
      let skillPlugin = await db.skillPlugin.create({
        data: {
          id: await ID.generateId('skillPlugin'),
          status: 'active',
          isManaged: false,
          providerOverrides: d.input.providerOverrides as any,
          name: d.input.name,
          description: d.input.description,
          longDescription: d.input.longDescription,
          category: d.input.category,
          slug: `${slugify((d.input.slug ?? d.input.name).replaceAll('_', '-'))}-${generatePlainId(6)}`.toLowerCase(),
          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
          organizationOid: d.project.organizationOid,
          skillConfigurationOid,
          destinationOid: destination.oid
        },
        include: skillPluginInclude
      });

      if (d.input.imageFileId !== undefined) {
        let image = await internalImageService.resolveImageEntityImage({
          project: d.project,
          instance: d.instance,
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

      await Fabric.fire('skill.plugin.created:after', {
        organization,
        instance: d.instance,
        skillPlugin
      });

      await enqueueSkillPluginLifecycle({ skillPluginId: skillPlugin.id, event: 'created' });

      if (skillMarketplace) {
        let skillMarketplacePlugin = await db.skillMarketplacePlugin.create({
          data: {
            id: await ID.generateId('skillMarketplacePlugin'),
            status: 'active',
            pluginSlug: skillPlugin.slug!,
            skillMarketplaceOid: skillMarketplace.oid,
            skillPluginOid: skillPlugin.oid
          }
        });
        await enqueueSkillMarketplacePluginLifecycle({
          skillMarketplacePluginId: skillMarketplacePlugin.id,
          event: 'created'
        });
      }

      return skillPlugin;
    });
  }

  async updateSkillPlugin(d: {
    project: Project;
    instance: Instance;
    skillPlugin: SkillPluginRecord;
    accessTags?: SkillMarketplaceAccessInput['accessTags'];
    input: SkillPluginInput;
  }) {
    assertPluginIsNotManaged(d.skillPlugin);
    await assertSkillPluginWriteAccess({
      skillPlugin: d.skillPlugin,
      accessTags: d.accessTags
    });

    if (!this.hasUpdate(d.input)) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one skill plugin field must be updated'
        })
      );
    }

    if (d.input.name !== undefined) this.assertName(d.input.name);

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
    let nextImage = d.input.image;
    if (d.input.imageFileId !== undefined) {
      nextImage = await internalImageService.resolveImageEntityImage({
        project: d.project,
        instance: d.instance,
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

    let skillPlugin = await this.getSkillPluginRecord({
      project: d.project,
      instance: d.instance,
      skillPluginId: d.skillPlugin.id
    });

    let { organization } = await getSkillPluginFabricContext({
      organizationOid: d.instance.organizationOid,
      instance: d.instance
    });
    await Fabric.fire('skill.plugin.updated:after', {
      organization,
      instance: d.instance,
      skillPlugin
    });

    return skillPlugin;
  }

  async archiveSkillPlugin(d: {
    project: Project;
    instance: Instance;
    skillPlugin: SkillPluginRecord;
    accessTags?: SkillMarketplaceAccessInput['accessTags'];
  }) {
    assertPluginIsNotManaged(d.skillPlugin);
    await assertSkillPluginArchiveAccess({
      skillPlugin: d.skillPlugin,
      accessTags: d.accessTags
    });

    let { organization } = await getSkillPluginFabricContext({
      organizationOid: d.instance.organizationOid,
      instance: d.instance
    });

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

      await Fabric.fire('skill.plugin.archived:after', {
        organization,
        instance: d.instance,
        skillPlugin: d.skillPlugin
      });

      await enqueueSkillPluginLifecycle({
        skillPluginId: d.skillPlugin.id,
        event: 'archived'
      });
    });

    await consumerAccessService.reconcileSkillPluginConsumerAccess({
      skillPlugin: d.skillPlugin
    });

    return await this.getSkillPluginRecord({
      project: d.project,
      instance: d.instance,
      skillPluginId: d.skillPlugin.id
    });
  }

  async getSkillPluginEditorUrl(d: {
    project: Project;
    instance: Instance;
    skillPlugin: SkillPluginRecord;
    isReadOnly?: boolean;
  }) {
    return await getSkillDestinationEditorUrl({
      project: d.project,
      destination: d.skillPlugin.destination!,
      isReadOnly: d.isReadOnly
    });
  }

  async forceSkillPluginSync(d: {
    project: Project;
    instance: Instance;
    skillPlugin: SkillPluginRecord;
  }) {
    await forceSkillDestinationSync({
      destination: d.skillPlugin.destination!
    });

    return await this.getSkillPluginRecord({
      project: d.project,
      instance: d.instance,
      skillPluginId: d.skillPlugin.id
    });
  }
}

export let skillPluginService = Service.create(
  'cargoSkillPluginService',
  () => new SkillPluginServiceImpl()
).build();
