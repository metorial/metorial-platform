import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { fileLinkService, fileReferenceService } from '@metorial/module-file';
import { getConfig } from '@metorial/config';
import type {
  EntityImage,
  Instance,
  Project,
  ResourceActor,
  StoreParticipantPermissions
} from '@metorial/db';
import { db } from '@metorial/db';

export type GetImageFieldsParams = {
  id: string;
  image: EntityImage | null;
};

let allowedHosts = [
  'metorial.com',
  'metorial.net',
  'metorial-cdn.com',
  'metorial-files.com',
  'localhost'
];

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
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }): Promise<EntityImage> {
    let file = await db.file.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.fileId,
        status: 'active'
      },
      include: {
        purpose: true
      }
    });
    if (!file) throw new ServiceError(notFoundError('file', d.fileId));
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

    return new URL(
      `https://avatar-cdn.metorial.com/aimg_${entity.id.split('_').pop()}`
    ).toString();
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
