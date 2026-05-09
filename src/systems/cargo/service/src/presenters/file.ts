import type { Document, File, FilePurpose } from '../../prisma/generated/client';

import { filePurposePresenter } from './filePurpose';

export let filePresenter = (
  file: File & {
    purpose: FilePurpose;
    document: Pick<Document, 'id'> | null;
  }
) => ({
  object: 'cargo#file',
  id: file.id,
  type: file.document ? 'document' : 'file',
  status: file.status,
  documentId: file.document?.id,
  storeId: file.storeId,
  fileName: file.fileName,
  fileSize: file.fileSize,
  fileType: file.fileType,
  title: file.title,
  purpose: filePurposePresenter(file.purpose),
  createdAt: file.createdAt,
  updatedAt: file.updatedAt
});
