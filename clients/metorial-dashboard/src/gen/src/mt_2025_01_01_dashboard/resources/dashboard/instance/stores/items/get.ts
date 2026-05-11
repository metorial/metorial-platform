import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceStoresItemsGetOutput = {
  object: 'store.item';
  id: string;
  kind: 'file' | 'document' | 'directory';
  path: string;
  storeId: string;
  directoryId: string | null;
  file: {
    object: 'file';
    id: string;
    status: 'active' | 'deleted';
    fileName: string;
    fileSize: number;
    fileType: string;
    title: string;
    purpose: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  document: {
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
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceStoresItemsGetOutput =
  mtMap.object<DashboardInstanceStoresItemsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    kind: mtMap.objectField('kind', mtMap.passthrough()),
    path: mtMap.objectField('path', mtMap.passthrough()),
    storeId: mtMap.objectField('store_id', mtMap.passthrough()),
    directoryId: mtMap.objectField('directory_id', mtMap.passthrough()),
    file: mtMap.objectField(
      'file',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        fileName: mtMap.objectField('file_name', mtMap.passthrough()),
        fileSize: mtMap.objectField('file_size', mtMap.passthrough()),
        fileType: mtMap.objectField('file_type', mtMap.passthrough()),
        title: mtMap.objectField('title', mtMap.passthrough()),
        purpose: mtMap.objectField('purpose', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    document: mtMap.objectField(
      'document',
      mtMap.object({
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
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

