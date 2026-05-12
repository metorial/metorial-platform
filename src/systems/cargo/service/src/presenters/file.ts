import type { Document, File, FilePurpose } from '../../prisma/generated/client';

import { filePurposePresenter } from './filePurpose';

export let filePresenter = (
  file: File & {
    purpose: FilePurpose;
    document: Pick<Document, 'id'> | null;
    effectiveStoreId?: string;
    resolvedTitle?: string;
    resolvedUpdatedAt?: Date;
  },
  opts?: {
    signedDownloadUrl?: string;
  }
) => ({
  object: 'cargo#file',
  id: file.id,
  type: file.document ? 'document' : 'file',
  status: file.status,
  documentId: file.document?.id,
  storeId: file.effectiveStoreId ?? file.storeId,
  fileName: file.fileName,
  fileSize: file.fileSize,
  fileType: file.fileType,
  title: file.resolvedTitle ?? file.title ?? file.fileName,
  purpose: filePurposePresenter(file.purpose),
  signedDownloadUrl: opts?.signedDownloadUrl,
  createdAt: file.createdAt,
  updatedAt: file.resolvedUpdatedAt ?? file.updatedAt
});
