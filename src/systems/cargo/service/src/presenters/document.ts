import type {
  Document,
  DocumentContent,
  DocumentVersion,
  File,
  FilePurpose
} from '../../prisma/generated/client';
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
      purpose: FilePurpose;
    };
  }
) => ({
  object: 'cargo#document',
  id: document.id,
  title: document.resolvedTitle ?? document.title,
  status: document.file.status,
  fileId: document.file.id,
  file: filePresenter(document.file),
  parentDocumentId: document.parentDocument?.id,
  isContentOwner: document.isContentOwner,
  maxVersionNumber: document.maxVersionNumber,
  currentVersionId: document.currentVersion?.id,
  content: document.resolvedContent ?? document.content.content,
  hasDraft: document.hasDraft ?? false,
  draftUpdatedAt: document.draftUpdatedAt,
  draftRevision: document.draftRevision,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt
});
