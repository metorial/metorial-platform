import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceFilesUpdateOutput = {
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
};

export let mapDashboardInstanceFilesUpdateOutput =
  mtMap.object<DashboardInstanceFilesUpdateOutput>({
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
  });

export type DashboardInstanceFilesUpdateBody = { title?: string | undefined };

export let mapDashboardInstanceFilesUpdateBody =
  mtMap.object<DashboardInstanceFilesUpdateBody>({
    title: mtMap.objectField('title', mtMap.passthrough())
  });
