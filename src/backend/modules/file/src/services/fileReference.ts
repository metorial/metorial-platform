import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { EntityImage } from '@metorial/db';
import {
  type CargoFile,
  type CargoFileLink,
  cargo,
  ensureCargoScope,
  reconcileCargoPurposes,
  resolveCargoScopeDescriptorForOwner,
  resolveCargoScopeDescriptorForProject
} from '../cargo';
import type { FileOwner } from './file';
import { resolveCargoScopeForOwner } from './scope';

export type ImageFileOwner =
  | {
      type: 'user';
      userId: string;
    }
  | {
      type: 'organization';
      organizationId: string;
    };

class FileReferenceServiceImpl {
  private async getScopeForOwner(owner: FileOwner) {
    return await resolveCargoScopeForOwner(owner);
  }

  async hasReferences(d: { fileLink: CargoFileLink; owner: FileOwner }) {
    let scope = await this.getScopeForOwner(d.owner);
    let result = await cargo.fileReference.hasReferences({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileLinkId: d.fileLink.id
    });

    return result.hasReferences;
  }

  async hasReferencesForFile(d: { file: Pick<CargoFile, 'id'>; owner: FileOwner }) {
    let scope = await this.getScopeForOwner(d.owner);
    let result = await cargo.fileReference.hasReferencesForFile({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileId: d.file.id
    });

    return result.hasReferences;
  }

  async createImageEntityImage(d: {
    fileId: string;
    owner: ImageFileOwner;
    purpose: string;
    entityType: string;
    entityId: string;
  }): Promise<EntityImage> {
    await reconcileCargoPurposes();

    let descriptor =
      d.entityType === 'project_brand'
        ? await resolveCargoScopeDescriptorForProject(d.entityId)
        : await resolveCargoScopeDescriptorForOwner(
            d.owner.type === 'user'
              ? {
                  type: 'user',
                  user: {
                    id: d.owner.userId
                  }
                }
              : {
                  type: 'organization',
                  organization: {
                    id: d.owner.organizationId
                  }
                }
          );
    if (!descriptor) {
      throw new ServiceError(notFoundError('file.scope', d.fileId));
    }

    let scope = await ensureCargoScope(descriptor);

    let file = await cargo.file.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileId: d.fileId
    });
    if (!file.purpose.canHaveLinks) {
      throw new ServiceError(
        forbiddenError({
          message: 'File purpose does not allow creating links'
        })
      );
    }

    let link = await cargo.fileLink.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileId: file.id
    });

    let ref = await cargo.fileReference.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileLinkId: link.id,
      entityType: d.entityType,
      entityId: d.entityId
    });

    let image = {
      type: 'file' as const,
      fileId: file.id,
      fileLinkId: link.id,
      fileReferenceId: ref.id,
      fileUrl: link.downloadUrl!
    };

    return image;
  }

  async resolveImageEntityImage<ClearImage extends EntityImage | null>(d: {
    imageFileId: string | null;
    clearedImage: ClearImage;
    owner: ImageFileOwner;
    purpose: string;
    entityType: string;
    entityId: string;
  }): Promise<EntityImage | ClearImage> {
    if (d.imageFileId === null) {
      return d.clearedImage;
    }

    return await this.createImageEntityImage({
      fileId: d.imageFileId,
      owner: d.owner,
      purpose: d.purpose,
      entityType: d.entityType,
      entityId: d.entityId
    });
  }

  async cleanupImageEntityImage(d: { image: EntityImage | null | undefined }) {
    if (d.image?.type != 'file' || !d.image.fileReferenceId || !d.image.fileLinkId) return;

    await cargo.fileReference.deleteAndCleanup({
      fileReferenceId: d.image.fileReferenceId
    });
  }
}

export let fileReferenceService = Service.create(
  'fileReference',
  () => new FileReferenceServiceImpl()
).build();
