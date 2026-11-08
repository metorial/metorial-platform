import { branding } from '@metorial/branding';
import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { ResourceAuthorization } from '@metorial/module-access';
import { fileLinkService, fileReferenceService, fileService } from '@metorial/module-file';
import { getConfig } from '@metorial/config';
import type {
  EntityImage,
  Instance,
  Project,
  ResourceActor,
  StoreParticipantPermissions
} from '@metorial/db';
import { db } from '@metorial/db';
import { domainSettings } from '@metorial/shared-settings';
import { maxDownloadedImageBytes, readBoundedResponse } from './boundedFetch';

export * from './boundedFetch';

export type GetImageFieldsParams = {
  id: string;
  image: EntityImage | null;
};

let allowedHosts = (() => {
  let domains = domainSettings();
  return [...domains.owned, ...domains.assets, ...domains.dev];
})();

let imageMimeTypeToExtensionMap: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
};

let getExtension = (fileName: string) => {
  let ext = fileName.split('.').pop()?.toLowerCase();
  if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext;
  }
  return null;
};

class InternalImageServiceImpl {
  private getFileLinkUrl(d: { fileId: string; key: string }) {
    let filesUrl = getConfig().urls.filesUrl;
    if (!filesUrl) return '';

    return `${filesUrl.replace(/\/$/, '')}/files/${d.fileId}/${d.key}`;
  }

  private async createImageEntityImage(d: {
    project: Project;
    instance: Instance;
    entity: { id: string; type: string };
    fileId: string;
    actor?: ResourceActor;
    authorization: ResourceAuthorization | undefined;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }): Promise<EntityImage> {
    if (!d.authorization) {
      throw new ServiceError(
        forbiddenError({
          message: 'Missing access to the image file'
        })
      );
    }

    let file = await fileService.getFileById({
      project: d.project,
      instance: d.instance,
      fileId: d.fileId,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions
    });
    if (file.status !== 'active') throw new ServiceError(notFoundError('file', d.fileId));
    if (!file.purpose.canHaveLinks) {
      throw new ServiceError(
        forbiddenError({
          message: 'File purpose does not allow creating links'
        })
      );
    }

    let link = await fileLinkService.createFileLink({
      project: d.project,
      instance: d.instance,
      file,
      input: {
        actor: d.actor
      }
    });
    let ref = await fileReferenceService.upsertFileReference({
      project: d.project,
      instance: d.instance,
      fileLink: link,
      input: {
        entityId: d.entity.id,
        entityType: d.entity.type
      }
    });

    return {
      type: 'file',
      fileId: file.id,
      fileLinkId: link.id,
      fileReferenceId: ref.id,
      fileUrl: this.getFileLinkUrl({ fileId: file.id, key: link.key })
    };
  }

  async resolveImageEntityImage<ClearImage extends EntityImage | null>(d: {
    project: Project;
    instance: Instance;
    entity: { id: string; type: string };
    imageFileId: string | null;
    clearedImage: ClearImage;
    actor?: ResourceActor;
    authorization: ResourceAuthorization | undefined;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }): Promise<EntityImage | ClearImage> {
    if (d.imageFileId === null) return d.clearedImage;

    return await this.createImageEntityImage({
      project: d.project,
      instance: d.instance,
      entity: d.entity,
      fileId: d.imageFileId,
      actor: d.actor,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions
    });
  }

  async cleanupImageEntityImage(d: { image: EntityImage | null | undefined }) {
    if (d.image?.type !== 'file' || !d.image.fileReferenceId || !d.image.fileLinkId) return;

    await fileReferenceService.deleteFileReferenceByIdAndCleanup({
      fileReferenceId: d.image.fileReferenceId
    });
  }

  async getImageUrl(entity: GetImageFieldsParams) {
    if (entity.image?.type == 'file') return entity.image.fileUrl ?? entity.image.url ?? '';

    if (entity.image?.type == 'url') return entity.image.url;

    return new URL(branding.avatarUrl(`aimg_${entity.id.split('_').pop()}`)).toString();
  }

  async downloadImage(entity: GetImageFieldsParams) {
    let url = await internalImageService.getImageUrl(entity);
    let extension = 'svg';

    let parsedUrl = new URL(url);
    if (
      !allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`))
    ) {
      url = await internalImageService.getImageUrl({
        ...entity,
        image: { type: 'default' }
      });
    }

    if (entity.image?.type === 'file') {
      let file = await db.file.findFirst({
        where: { id: entity.image.fileId }
      });

      if (file) {
        extension =
          imageMimeTypeToExtensionMap[file.fileType] ?? getExtension(file.fileName) ?? 'bin';
      }
    }

    return {
      url,
      fetch: () => fetch(url).then(res => res.arrayBuffer()),
      extension
    };
  }
}

export let internalImageService = Service.create(
  'cargoInternalImageService',
  () => new InternalImageServiceImpl()
).build();
