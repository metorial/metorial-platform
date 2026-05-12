import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceFilesGetOutput = {
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
} & { downloadUrl: string | null };

export let mapDashboardInstanceFilesGetOutput = mtMap.union([
  mtMap.unionOption(
    'object',
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
      updatedAt: mtMap.objectField('updated_at', mtMap.date()),
      downloadUrl: mtMap.objectField('download_url', mtMap.passthrough())
    })
  )
]);

