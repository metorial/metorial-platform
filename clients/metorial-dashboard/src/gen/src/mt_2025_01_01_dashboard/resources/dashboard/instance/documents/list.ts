import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceDocumentsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceDocumentsListOutput =
  mtMap.object<DashboardInstanceDocumentsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
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
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardInstanceDocumentsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceDocumentsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

