import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceFileLinksCreateOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapManagementInstanceFileLinksCreateOutput =
  mtMap.object<ManagementInstanceFileLinksCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    fileId: mtMap.objectField('file_id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type ManagementInstanceFileLinksCreateBody = {
  fileId: string;
  expiresAt?: Date | undefined;
};

export let mapManagementInstanceFileLinksCreateBody =
  mtMap.object<ManagementInstanceFileLinksCreateBody>({
    fileId: mtMap.objectField('file_id', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

