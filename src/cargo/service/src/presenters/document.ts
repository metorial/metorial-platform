import type {
  Document,
  DocumentContent,
  DocumentVersion,
  File,
  FilePurpose,
  TenantActor
} from '@metorial-cargo/db';
import { actorPresenter } from './actor';
import { filePresenter } from './file';

export let documentPresenter = (
  document: Document & {
    parentDocument: Document | null;
    content: DocumentContent;
    currentVersion: DocumentVersion | null;
    resolvedTitle?: string;
    resolvedContent?: string;
    hasDraft?: boolean;
    draftUpdatedAt?: Date;
    draftRevision?: number;
    file: File & {
      effectiveStoreId?: string;
      purpose: FilePurpose;
      createdByTenantActor?: TenantActor | null;
    };
    createdByTenantActor?: TenantActor | null;
  }
) => {
  let updatedAt = document.draftUpdatedAt
    ? new Date(Math.max(document.updatedAt.getTime(), document.draftUpdatedAt.getTime()))
    : document.updatedAt;

  return {
    object: 'cargo#document',
    id: document.id,
    title: document.resolvedTitle ?? document.title,
    status: document.file.status,
    fileId: document.file.id,
    file: filePresenter({
      ...document.file,
      resolvedTitle: document.resolvedTitle ?? document.title,
      resolvedUpdatedAt: updatedAt,
      document: {
        id: document.id
      }
    }),
    parentDocumentId: document.parentDocument?.id,
    currentVersionId: document.currentVersion?.id,
    content: document.resolvedContent ?? document.content.content,
    isReadOnly: document.isReadOnly,
    isTemplateBacking: document.isTemplateBacking,
    createdBy: document.createdByTenantActor
      ? actorPresenter(document.createdByTenantActor)
      : null,
    createdAt: document.createdAt,
    updatedAt
  };
};
