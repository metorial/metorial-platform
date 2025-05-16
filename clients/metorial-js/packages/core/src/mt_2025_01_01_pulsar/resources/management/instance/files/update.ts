import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceFilesUpdateOutput = {
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

export let mapManagementInstanceFilesUpdateOutput =
  mtMap.object<ManagementInstanceFilesUpdateOutput>({
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

export type ManagementInstanceFilesUpdateBody = { title?: string | undefined };

export let mapManagementInstanceFilesUpdateBody =
  mtMap.object<ManagementInstanceFilesUpdateBody>({
    title: mtMap.objectField('title', mtMap.passthrough())
  });

