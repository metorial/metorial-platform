import { mtMap } from '@metorial/util-resource-mapper';

export type FilesListOutput = {
  items: {
    object: 'file';
    id: string;
    status: 'active' | 'deleted';
    fileName: string;
    fileSize: number;
    fileType: string;
    title: string | null;
    purpose: { name: string; identifier: string };
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapFilesListOutput = mtMap.object<FilesListOutput>({
  items: mtMap.objectField(
    'items',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        fileName: mtMap.objectField('file_name', mtMap.passthrough()),
        fileSize: mtMap.objectField('file_size', mtMap.passthrough()),
        fileType: mtMap.objectField('file_type', mtMap.passthrough()),
        title: mtMap.objectField('title', mtMap.passthrough()),
        purpose: mtMap.objectField(
          'purpose',
          mtMap.object({
            name: mtMap.objectField('name', mtMap.passthrough()),
            identifier: mtMap.objectField('identifier', mtMap.passthrough())
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    )
  ),
  pagination: mtMap.objectField(
    'pagination',
    mtMap.object({
      hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
      hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
    })
  )
});

export type FilesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  purpose?: 'user_image' | 'organization_image' | undefined;
  organizationId?: string | undefined;
};

export let mapFilesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      purpose: mtMap.objectField('purpose', mtMap.passthrough()),
      organizationId: mtMap.objectField('organization_id', mtMap.passthrough())
    })
  )
]);
