import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceLinksListOutput = {
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

export let mapManagementInstanceLinksListOutput =
  mtMap.object<ManagementInstanceLinksListOutput>({
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
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

