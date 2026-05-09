import type { File, FilePurpose } from '../../prisma/generated/client';

export let filePresenter = (file: File & { purpose: FilePurpose }) => ({
  object: 'cargo#file',
  id: file.id,
  status: file.status,
  storeId: file.storeId,
  fileName: file.fileName,
  fileSize: file.fileSize,
  fileType: file.fileType,
  title: file.title,
  purpose: filePurposePresenter(file.purpose),
  createdAt: file.createdAt,
  updatedAt: file.updatedAt
});

import { filePurposePresenter } from './filePurpose';
