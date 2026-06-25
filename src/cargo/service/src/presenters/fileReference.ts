import type { FileLink, FileReference } from '@metorial-cargo/db';

export let fileReferencePresenter = (
  fileReference: FileReference & { fileLink: FileLink }
) => ({
  object: 'cargo#fileReference',
  id: fileReference.id,
  fileLinkId: fileReference.fileLink.id,
  entityType: fileReference.entityType,
  entityId: fileReference.entityId,
  createdAt: fileReference.createdAt
});
