import { mtMap } from '@metorial/util-resource-mapper';

export type DocumentsCloneOutput = {
  object: 'document';
  id: string;
  status: 'active' | 'deleted';
  title: string;
  content: string;
  fileId: string;
  parentDocumentId: string | null;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDocumentsCloneOutput = mtMap.object<DocumentsCloneOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  status: mtMap.objectField('status', mtMap.passthrough()),
  title: mtMap.objectField('title', mtMap.passthrough()),
  content: mtMap.objectField('content', mtMap.passthrough()),
  fileId: mtMap.objectField('file_id', mtMap.passthrough()),
  parentDocumentId: mtMap.objectField(
    'parent_document_id',
    mtMap.passthrough()
  ),
  currentVersionId: mtMap.objectField(
    'current_version_id',
    mtMap.passthrough()
  ),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});

export type DocumentsCloneBody = {
  targetDocumentId?: string | undefined;
  title?: string | undefined;
};

export let mapDocumentsCloneBody = mtMap.object<DocumentsCloneBody>({
  targetDocumentId: mtMap.objectField(
    'target_document_id',
    mtMap.passthrough()
  ),
  title: mtMap.objectField('title', mtMap.passthrough())
});

