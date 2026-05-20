import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceFilesLinksCreateOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapManagementInstanceFilesLinksCreateOutput =
  mtMap.object<ManagementInstanceFilesLinksCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    fileId: mtMap.objectField('file_id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type ManagementInstanceFilesLinksCreateBody = {
  fileId: string;
  expiresAt?: Date | undefined;
};

export let mapManagementInstanceFilesLinksCreateBody =
  mtMap.object<ManagementInstanceFilesLinksCreateBody>({
    fileId: mtMap.objectField('file_id', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

