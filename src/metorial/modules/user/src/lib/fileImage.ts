import { getConfig } from '@metorial/config';
import type { EntityImage, User } from '@metorial/db';
import {
  fileLinkService,
  fileReferenceService,
  fileService,
  resolveOwnerScope
} from '@metorial/cargo-module-file';

export let resolveUserFileImage = async <ClearImage extends EntityImage | null>(d: {
  user: Pick<User, 'id'>;
  imageFileId: string | null;
  clearedImage: ClearImage;
}): Promise<EntityImage | ClearImage> => {
  if (d.imageFileId === null) return d.clearedImage;

  let scope = await resolveOwnerScope({
    type: 'user',
    user: d.user
  });
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
      entityType: 'user',
      entityId: d.user.id
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

export let cleanupUserFileImage = async (image: EntityImage | null | undefined) => {
  if (image?.type !== 'file' || !image.fileReferenceId) return;

  await fileReferenceService.deleteFileReferenceByIdAndCleanup({
    fileReferenceId: image.fileReferenceId
  });
};
