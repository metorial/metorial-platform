import { canonicalize } from '@lowerdeck/canonicalize';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getImageUrl,
  ID,
  Organization,
  OrganizationActor,
  Project,
  type ProjectBrand,
  withTransaction
} from '@metorial/db';
import { fileReferenceService } from '@metorial/module-file';
import { getTenantForSubspace, subspaceBrandService } from '@metorial/module-subspace';
import { syncBrandQueue } from '../queues/syncBrand';

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
      image?: PrismaJson.EntityImage;
    };
    performedBy: OrganizationActor;
    isAutoUpdate?: boolean;
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
    } else if (d.input.image !== undefined) {
      nextImage = d.input.image;
    }

    let nextName = d.input.name ?? currentName;
    let resolvedNextImage = nextImage ?? currentImage;
    let didImageChange = canonicalize(currentImage) !== canonicalize(resolvedNextImage);
    let didNameChange = currentName !== nextName;

    await withTransaction(async db => {
      if (didNameChange || didImageChange) {
        await db.projectBrandUpdate.create({
          data: {
            id: await ID.generateId('projectBrandUpdate'),
            brandOid: currentBrand.oid,
            createdByOid: d.performedBy.oid,
            isAutoUpdate: !!d.isAutoUpdate,
            before: {
              name: currentName,
              image: currentImage
            },
            after: {
              name: nextName,
              image: resolvedNextImage
            }
          }
        });
      }

      let newId = await ID.generateId('projectBrand');
      let res = await db.projectBrand.upsert({
        where: {
          projectOid: d.project.oid
        },
        update: {
          name: nextName,
          image: nextImage,
          isCustomized: !d.isAutoUpdate
        },
        create: {
          id: newId,
          identifier: d.project.id,
          projectOid: d.project.oid,
          name: nextName,
          image: resolvedNextImage,
          isDefault: false,
          isCustomized: false
        }
      });

      if (res.id === newId) {
        await addAfterTransactionHook(() => syncBrandQueue.add({ projectId: d.project.id }));
      }

      return res;
    });

    let brand = await this.getCustomProjectBrand({
      project: d.project
    });
    if (!brand) throw new Error('Project brand was not found after upsert');

    await this.syncProjectBrandToSubspace({
      project: brand.project,
      brand: {
        name: brand.name,
        image:
          brand.image.type === 'default'
            ? { type: 'url', url: await getImageUrl(brand) }
            : brand.image
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
    brand: { name: string; image: PrismaJson.EntityImage };
  }) {
    return withTransaction(async db => {
      let instance = await db.instance.findFirst({
        where: { projectOid: d.project.oid, status: 'active' },
        include: { project: true, organization: true }
      });
      if (!instance) return;

      let { tenant } = await getTenantForSubspace(instance);

      let brand = await subspaceBrandService.upsert({
        instance,
        name: d.brand.name,
        image: d.brand.image,
        for: {
          type: 'tenant',
          tenantId: tenant.id
        }
      });

      await db.projectBrand.update({
        where: { projectOid: d.project.oid },
        data: { subspaceBrandId: brand.id }
      });
    });
  }
}

export let projectBrandService = Service.create(
  'projectBrandService',
  () => new ProjectBrandService()
).build();
