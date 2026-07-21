import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import { getId } from '@metorial/cargo-config/id';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillConfigurations,
  resolveSkillMarketplaces
} from '@metorial/cargo-list-utils';
import type { ResourceScope } from '@metorial/module-resource-tenant';
import { resolveInstanceResourceScope } from '@metorial/module-resource-tenant';
import { voyager, voyagerIndex, voyagerSource } from '@metorial/cargo-module-search';
import type { EntityImage, Prisma, SkillMarketplaceStatus } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { internalImageService } from '../internal/image';
import {
  createSkillDestination,
  forceSkillDestinationSync,
  getSkillDestinationEditorUrl
} from '../internal/skillDestination';
import { enqueueSkillMarketplaceLifecycle } from '../queues/lifecycle';
import { skillPluginInclude } from './skillPlugin';

export let skillMarketplaceInclude = {
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
  plugins: {
    where: {
      status: 'active',
      skillPlugin: {
        status: 'active',
        isManaged: false
      }
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
      skillPlugin: {
        include: skillPluginInclude
      }
    }
  }
} satisfies Prisma.SkillMarketplaceInclude;

export type SkillMarketplaceRecord = Prisma.SkillMarketplaceGetPayload<{
  include: typeof skillMarketplaceInclude;
}>;

export type SkillMarketplaceStatusFilter = SkillMarketplaceStatus;

type SkillMarketplaceInput = {
  imageFileId?: string | null;
  image?: EntityImage | null;
  providerOverrides?: Prisma.InputJsonValue | null;
  name?: string;
  description?: string | null;
  skillConfigurationId?: string | null;
};

class SkillMarketplaceServiceImpl {
  private assertName(name: string) {
    if (name.trim()) return;

    throw new ServiceError(
      badRequestError({
        message: 'Skill marketplace name cannot be empty'
      })
    );
  }

  private hasUpdate(input: SkillMarketplaceInput) {
    return (
      input.imageFileId !== undefined ||
      input.image !== undefined ||
      input.providerOverrides !== undefined ||
      input.name !== undefined ||
      input.description !== undefined ||
      input.skillConfigurationId !== undefined
    );
  }

  private async getSkillConfigurationOid(
    d: ResourceScope & {
      skillConfigurationId: string | null | undefined;
    }
  ) {
    if (d.skillConfigurationId === undefined) return undefined;
    if (d.skillConfigurationId === null) return null;

    let skillConfiguration = await db.skillConfiguration.findFirst({
      where: {
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
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

  private async getSkillMarketplaceRecord(
    d: ResourceScope & {
      skillMarketplaceId: string;
    }
  ) {
    return await withTransaction(
      async db => {
        let skillMarketplace = await db.skillMarketplace.findFirst({
          where: {
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid,
            id: d.skillMarketplaceId
          },
          include: skillMarketplaceInclude
        });

        if (!skillMarketplace) {
          throw new ServiceError(notFoundError('skill.marketplace', d.skillMarketplaceId));
        }

        return skillMarketplace;
      },
      { ifExists: true }
    );
  }

  async listSkillMarketplaces(
    d: ResourceScope & {
      ids?: string[];
      skillConfigurationIds?: string[];
      statuses?: SkillMarketplaceStatusFilter[];
      search?: string;
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
    }
  ) {
    let skillMarketplaces = await resolveSkillMarketplaces(d, d.ids);
    let skillConfigurations = await resolveSkillConfigurations(d, d.skillConfigurationIds);
    let statuses: SkillMarketplaceStatus[] = d.statuses?.length ? d.statuses : ['active'];
    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.resourceTenant!.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.skillMarketplace.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillMarketplace.findMany({
            ...opts,
            where: {
              resourceTenantOid: d.resourceTenant.oid,
              resourceGroupOid: d.resourceGroup.oid,
              AND: [
                skillMarketplaces ? { oid: skillMarketplaces.in } : undefined!,
                skillConfigurations
                  ? { skillConfigurationOid: skillConfigurations.in }
                  : undefined!,
                { status: { in: statuses } },
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillMarketplaceInclude
          })
      )
    );
  }

  async getSkillMarketplaceById(
    d: ResourceScope & {
      skillMarketplaceId: string;
    }
  ) {
    return await this.getSkillMarketplaceRecord(d);
  }

  async createSkillMarketplace(
    d: ResourceScope & {
      input: {
        name: string;
        description?: string | null;
        slug?: string;
        providerOverrides?: Prisma.InputJsonValue | null;
        imageFileId?: string | null;
        skillConfigurationId?: string | null;
      };
    }
  ) {
    this.assertName(d.input.name);

    let skillConfigurationOid = await this.getSkillConfigurationOid({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      skillConfigurationId: d.input.skillConfigurationId
    });
    let ownerScope = await resolveInstanceResourceScope(d);

    return await withTransaction(async db => {
      let destination = await createSkillDestination({ resourceTenant: d.resourceTenant });
      let skillMarketplace = await db.skillMarketplace.create({
        data: {
          ...getId('skillMarketplace'),
          status: 'active',
          providerOverrides: d.input.providerOverrides as any,
          name: d.input.name,
          description: d.input.description,
          slug: `${slugify((d.input.slug ?? d.input.name).replaceAll('_', '-'))}-${generatePlainId(6)}`.toLowerCase(),
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid,
          ...ownerScope,
          skillConfigurationOid,
          destinationOid: destination.oid
        },
        include: skillMarketplaceInclude
      });

      if (d.input.imageFileId !== undefined) {
        let image = await internalImageService.resolveImageEntityImage({
          resourceTenant: d.resourceTenant!,
          resourceGroup: d.resourceGroup,
          entity: { id: skillMarketplace.id, type: 'skill_marketplace' },
          imageFileId: d.input.imageFileId,
          clearedImage: { type: 'default' }
        });

        skillMarketplace = await db.skillMarketplace.update({
          where: {
            id: skillMarketplace.id
          },
          data: {
            image
          },
          include: skillMarketplaceInclude
        });
      }

      await enqueueSkillMarketplaceLifecycle({
        skillMarketplaceId: skillMarketplace.id,
        event: 'created'
      });

      return skillMarketplace;
    });
  }

  async updateSkillMarketplace(
    d: ResourceScope & {
      skillMarketplace: SkillMarketplaceRecord;
      input: SkillMarketplaceInput;
    }
  ) {
    if (!this.hasUpdate(d.input)) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one skill marketplace field must be updated'
        })
      );
    }

    if (d.input.name !== undefined) this.assertName(d.input.name);

    let skillConfigurationOid = await this.getSkillConfigurationOid({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      skillConfigurationId: d.input.skillConfigurationId
    });
    let nextImage = d.input.image;
    if (d.input.imageFileId !== undefined) {
      nextImage = await internalImageService.resolveImageEntityImage({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        entity: { id: d.skillMarketplace.id, type: 'skill_marketplace' },
        imageFileId: d.input.imageFileId,
        clearedImage: { type: 'default' }
      });
    }

    await db.skillMarketplace.update({
      where: {
        id: d.skillMarketplace.id
      },
      data: {
        image: nextImage as any,
        providerOverrides: d.input.providerOverrides as any,
        name: d.input.name,
        description: d.input.description,
        skillConfigurationOid
      }
    });

    if (
      d.input.imageFileId !== undefined &&
      d.skillMarketplace.image &&
      canonicalize(d.skillMarketplace.image) !== canonicalize(nextImage)
    ) {
      await internalImageService.cleanupImageEntityImage({
        image: d.skillMarketplace.image as EntityImage
      });
    }

    await enqueueSkillMarketplaceLifecycle({
      skillMarketplaceId: d.skillMarketplace.id,
      event: 'updated'
    });

    return await this.getSkillMarketplaceRecord({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      skillMarketplaceId: d.skillMarketplace.id
    });
  }

  async archiveSkillMarketplace(
    d: ResourceScope & { skillMarketplace: SkillMarketplaceRecord }
  ) {
    await withTransaction(async db => {
      await db.skillMarketplacePlugin.updateMany({
        where: {
          skillMarketplaceOid: d.skillMarketplace.oid,
          status: 'active'
        },
        data: {
          status: 'archived',
          skillConfigurationOid: null
        }
      });

      await db.skillMarketplaceRepository.deleteMany({
        where: {
          skillMarketplaceOid: d.skillMarketplace.oid
        }
      });

      await db.skillMarketplace.update({
        where: {
          id: d.skillMarketplace.id
        },
        data: {
          status: 'archived'
        }
      });

      await enqueueSkillMarketplaceLifecycle({
        skillMarketplaceId: d.skillMarketplace.id,
        event: 'archived'
      });
    });

    return await this.getSkillMarketplaceRecord({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      skillMarketplaceId: d.skillMarketplace.id
    });
  }

  async getSkillMarketplaceEditorUrl(
    d: ResourceScope & {
      skillMarketplace: SkillMarketplaceRecord;
      isReadOnly?: boolean;
    }
  ) {
    return await getSkillDestinationEditorUrl({
      resourceTenant: d.resourceTenant!,
      destination: d.skillMarketplace.destination!,
      isReadOnly: d.isReadOnly
    });
  }

  async forceSkillMarketplaceSync(
    d: ResourceScope & { skillMarketplace: SkillMarketplaceRecord }
  ) {
    await forceSkillDestinationSync({
      destination: d.skillMarketplace.destination!
    });

    return await this.getSkillMarketplaceRecord({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      skillMarketplaceId: d.skillMarketplace.id
    });
  }
}

export let skillMarketplaceService = Service.create(
  'cargoSkillMarketplaceService',
  () => new SkillMarketplaceServiceImpl()
).build();
