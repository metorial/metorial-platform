import { canonicalize } from '@lowerdeck/canonicalize';
import { Service } from '@lowerdeck/service';
import {
  db,
  ID,
  Organization,
  Prisma,
  Project,
  type ProjectBrand,
  withTransaction
} from '@metorial/db';
import { fileReferenceService } from '@metorial/module-file';
import { subspaceBrandService } from '@metorial/module-subspace';

export type ProjectBrandOverride = ProjectBrand & {
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
          image: Prisma.DbNull
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
    let nextImage = currentImage;
    
    if (d.input.imageFileId !== undefined) {
      nextImage = await fileReferenceService.resolveImageEntityImage({
        imageFileId: d.input.imageFileId,
        clearedImage: null,
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
    let didImageChange = canonicalize(currentImage) !== canonicalize(nextImage);

    await withTransaction(async db => {
      return await db.projectBrand.upsert({
        where: {
          projectOid: d.project.oid
        },
        update: {
          name: nextName,
          image: nextImage ?? Prisma.DbNull
        },
        create: {
          id: await ID.generateId('projectBrand'),
          identifier: d.project.id,
          projectOid: d.project.oid,
          name: nextName,
          image: nextImage ?? Prisma.DbNull
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
    return await db.projectBrand.findUnique({
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
    });
  }

  private async syncProjectBrandToSubspace(d: {
    project: Project & { organization: Organization };
    brand: { name: string; image: PrismaJson.EntityImage | null };
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

    await subspaceBrandService.upsertBrand({
      instance,
      input: {
        name: d.brand.name,
        image: d.brand.image
      }
    });
  }
}

export let projectBrandService = Service.create(
  'projectBrandService',
  () => new ProjectBrandService()
).build();
