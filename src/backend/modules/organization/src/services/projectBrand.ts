import { canonicalize } from '@lowerdeck/canonicalize';
import { Service } from '@lowerdeck/service';
import {
  db,
  ID,
  Organization,
  Project,
  type ProjectBrand,
  withTransaction
} from '@metorial/db';
import { fileReferenceService } from '@metorial/module-file';
import { getTenantForSubspace, subspaceBrandService } from '@metorial/module-subspace';

export type ProjectBrandOverride = Omit<ProjectBrand, 'image'> & {
  image: PrismaJson.EntityImage;
  project: Project & { organization: Organization };
};

class ProjectBrandService {
  async getProjectBrand(d: {
    project: Project & { organization: Organization };
  }): Promise<ProjectBrandOverride> {
    let brand = await this.getCustomProjectBrand(d);
    if (brand) return brand;

    await withTransaction(async db => {
      await db.projectBrand.upsert({
        where: {
          projectOid: d.project.oid
        },
        update: {},
        create: {
          id: await ID.generateId('projectBrand'),
          identifier: d.project.id,
          projectOid: d.project.oid,
          name: d.project.name,
          image: { type: 'default' }
        }
      });
    });

    brand = await this.getCustomProjectBrand(d);
    if (!brand) throw new Error('Project brand was not found after initialization');
    return brand;
  }

  async upsertProjectBrand(d: {
    project: Project & { organization: Organization };
    input: {
      name?: string;
      imageFileId?: string | null;
    };
  }): Promise<ProjectBrandOverride> {
    let currentBrand = await this.getProjectBrand({
      project: d.project
    });

    if (d.input.name === undefined && d.input.imageFileId === undefined) {
      return currentBrand;
    }

    let { name: currentName, image: currentImage } = currentBrand;
    let nextImage: PrismaJson.EntityImage | undefined;

    if (d.input.imageFileId !== undefined) {
      nextImage = await fileReferenceService.resolveImageEntityImage({
        imageFileId: d.input.imageFileId,
        clearedImage: { type: 'default' },
        owner: {
          type: 'organization',
          organizationId: d.project.organization.id
        },
        purpose: 'project_brand_image',
        entityType: 'project_brand',
        entityId: d.project.id
      });
    }

    let nextName = d.input.name ?? currentName;
    let resolvedNextImage = nextImage ?? currentImage;
    let didImageChange = canonicalize(currentImage) !== canonicalize(resolvedNextImage);

    await withTransaction(async db => {
      return await db.projectBrand.upsert({
        where: {
          projectOid: d.project.oid
        },
        update: {
          name: nextName,
          image: nextImage
        },
        create: {
          id: await ID.generateId('projectBrand'),
          identifier: d.project.id,
          projectOid: d.project.oid,
          name: nextName,
          image: resolvedNextImage
        }
      });
    });

    let brand = await this.getCustomProjectBrand({
      project: d.project
    });
    if (!brand) throw new Error('Project brand was not found after upsert');

    await this.syncProjectBrandToSubspace({
      project: brand.project,
      brand: {
        name: brand.name,
        image: brand.image
      }
    });

    if (didImageChange) {
      await fileReferenceService.cleanupImageEntityImage({
        image: currentImage
      });
    }

    return brand;
  }

  private async getCustomProjectBrand(d: {
    project: Project & { organization: Organization };
  }): Promise<ProjectBrandOverride | null> {
    return (await db.projectBrand.findUnique({
      where: {
        projectOid: d.project.oid
      },
      include: {
        project: {
          include: {
            organization: true
          }
        }
      }
    })) as ProjectBrandOverride | null;
  }

  private async syncProjectBrandToSubspace(d: {
    project: Project & { organization: Organization };
    brand: { name: string; image: PrismaJson.EntityImage };
  }) {
    let instance = await db.instance.findFirst({
      where: {
        projectOid: d.project.oid,
        status: 'active'
      },
      include: {
        project: true,
        organization: true
      }
    });

    if (!instance) return;

    let { tenant, environmentId } = await getTenantForSubspace(instance);

    await subspaceBrandService.upsert({
      instance,
      name: d.brand.name,
      image: d.brand.image,
      for: {
        type: 'tenant',
        tenantId: tenant.id,
        environmentId
      }
    });
  }
}

export let projectBrandService = Service.create(
  'projectBrandService',
  () => new ProjectBrandService()
).build();
