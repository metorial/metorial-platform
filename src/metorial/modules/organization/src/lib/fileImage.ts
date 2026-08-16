import { getConfig } from '@metorial/config';
import type { EntityImage } from '@metorial/db';
import {
  fileLinkService,
  fileReferenceService,
  fileService
} from '@metorial/cargo-module-file';
import {
  resolveOwnerScope,
  type ScopeOwner
} from '@metorial/module-resource-tenant';

export let resolveFileImage = async <ClearImage extends EntityImage | null>(d: {
  owner: ScopeOwner;
  imageFileId: string | null;
  clearedImage: ClearImage;
  entity: {
    type: string;
    id: string;
  };
}): Promise<EntityImage | ClearImage> => {
  if (d.imageFileId === null) return d.clearedImage;

  let scope = await resolveOwnerScope(d.owner);
  let file = await fileService.getFileById({
    ...scope,
    fileId: d.imageFileId,
    authorization: { type: 'privileged' }
  });
  let link = await fileLinkService.createFileLink({
    ...scope,
    file,
    input: {}
  });
  let reference = await fileReferenceService.upsertFileReference({
    ...scope,
    fileLink: link,
    input: {
      entityType: d.entity.type,
      entityId: d.entity.id
    }
  });

  return {
    type: 'file',
    fileId: file.id,
    fileLinkId: link.id,
    fileReferenceId: reference.id,
    fileUrl: `${getConfig().urls.filesUrl.replace(/\/$/, '')}/files/${file.id}/${link.key}`
  };
};

export let cleanupFileImage = async (image: EntityImage | null | undefined) => {
  if (image?.type !== 'file' || !image.fileReferenceId) return;

  await fileReferenceService.deleteFileReferenceByIdAndCleanup({
    fileReferenceId: image.fileReferenceId
  });
};
