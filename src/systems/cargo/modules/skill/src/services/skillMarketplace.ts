import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import type { EntityImage, Prisma, SkillMarketplaceStatus } from '@metorial-cargo/db';
import { db, getId, withTransaction } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillConfigurations,
  resolveSkillMarketplaces
} from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { internalImageService } from '../internal/image';
import {
  createSkillDestination,
  enqueueSkillDestinationSync,
  getSkillDestinationEditorUrl
} from '../internal/skillDestination';
import { skillPluginInclude } from './skillPlugin';

export let skillMarketplaceInclude = {
  destination: true,
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
  slug?: string;
  skillConfigurationId?: string | null;
};

class SkillMarketplaceServiceImpl {
  private normalizeSlug(d: { slug?: string; name: string }) {
    let normalized = slugify(d.slug ?? d.name);
    if (!normalized) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill marketplace slug must include at least one slug character'
        })
      );
    }

    return normalized;
  }

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

  private async getSkillMarketplaceRecord(
    d: CargoTenantEnvironment & {
      skillMarketplaceId: string;
    }
  ) {
    return await withTransaction(
      async db => {
        let skillMarketplace = await db.skillMarketplace.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
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
    d: CargoTenantEnvironment & {
      ids?: string[];
      skillConfigurationIds?: string[];
      statuses?: SkillMarketplaceStatusFilter[];
      slug?: string;
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
    }
  ) {
    let skillMarketplaces = await resolveSkillMarketplaces(d, d.ids);
    let skillConfigurations = await resolveSkillConfigurations(d, d.skillConfigurationIds);
    let statuses: SkillMarketplaceStatus[] = d.statuses?.length ? d.statuses : ['active'];

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillMarketplace.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              AND: [
                skillMarketplaces ? { oid: skillMarketplaces.in } : undefined!,
                skillConfigurations
                  ? { skillConfigurationOid: skillConfigurations.in }
                  : undefined!,
                { status: { in: statuses } },
                d.slug ? { slug: d.slug } : undefined!,
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
    d: CargoTenantEnvironment & {
      skillMarketplaceId: string;
    }
  ) {
    return await this.getSkillMarketplaceRecord(d);
  }

  async createSkillMarketplace(
    d: CargoTenantEnvironment & {
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
      tenant: d.tenant,
      environment: d.environment,
      skillConfigurationId: d.input.skillConfigurationId
    });
    let slug = this.normalizeSlug({ slug: d.input.slug, name: d.input.name });

    return await withTransaction(async db => {
      let destination = await createSkillDestination({ tenant: d.tenant });
      let skillMarketplace = await db.skillMarketplace.create({
        data: {
          ...getId('skillMarketplace'),
          status: 'active',
          providerOverrides: d.input.providerOverrides as any,
          name: d.input.name,
          description: d.input.description,
          slug,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          skillConfigurationOid,
          destinationOid: destination.oid
        },
        include: skillMarketplaceInclude
      });

      if (d.input.imageFileId !== undefined) {
        let image = await internalImageService.resolveImageEntityImage({
          tenant: d.tenant,
          environment: d.environment,
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

      await enqueueSkillDestinationSync(skillMarketplace.destinationOid);

      return skillMarketplace;
    });
  }

  async updateSkillMarketplace(
    d: CargoTenantEnvironment & {
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
      tenant: d.tenant,
      environment: d.environment,
      skillConfigurationId: d.input.skillConfigurationId
    });
    let nextImage = d.input.image;
    if (d.input.imageFileId !== undefined) {
      nextImage = await internalImageService.resolveImageEntityImage({
        tenant: d.tenant,
        environment: d.environment,
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
        slug:
          d.input.slug !== undefined
            ? this.normalizeSlug({
                slug: d.input.slug,
                name: d.input.name ?? d.skillMarketplace.name
              })
            : undefined,
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

    await enqueueSkillDestinationSync(d.skillMarketplace.destinationOid);

    return await this.getSkillMarketplaceRecord({
      tenant: d.tenant,
      environment: d.environment,
      skillMarketplaceId: d.skillMarketplace.id
    });
  }

  async archiveSkillMarketplace(
    d: CargoTenantEnvironment & { skillMarketplace: SkillMarketplaceRecord }
  ) {
    await db.skillMarketplace.update({
      where: {
        id: d.skillMarketplace.id
      },
      data: {
        status: 'archived'
      }
    });

    await enqueueSkillDestinationSync(d.skillMarketplace.destinationOid);

    return await this.getSkillMarketplaceRecord({
      tenant: d.tenant,
      environment: d.environment,
      skillMarketplaceId: d.skillMarketplace.id
    });
  }

  async getSkillMarketplaceEditorUrl(
    d: CargoTenantEnvironment & {
      skillMarketplace: SkillMarketplaceRecord;
      isReadOnly?: boolean;
    }
  ) {
    return await getSkillDestinationEditorUrl({
      tenant: d.tenant,
      destination: d.skillMarketplace.destination,
      isReadOnly: d.isReadOnly
    });
  }
}

export let skillMarketplaceService = Service.create(
  'cargoSkillMarketplaceService',
  () => new SkillMarketplaceServiceImpl()
).build();
