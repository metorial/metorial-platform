import { mtMap } from '@metorial/util-resource-mapper';

export type FilesLinksCreateOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapFilesLinksCreateOutput = mtMap.object<FilesLinksCreateOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  fileId: mtMap.objectField('file_id', mtMap.passthrough()),
  url: mtMap.objectField('url', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  expiresAt: mtMap.objectField('expires_at', mtMap.date())
});

export type FilesLinksCreateBody = {
  fileId: string;
  expiresAt?: Date | undefined;
};

export let mapFilesLinksCreateBody = mtMap.object<FilesLinksCreateBody>({
  fileId: mtMap.objectField('file_id', mtMap.passthrough()),
  expiresAt: mtMap.objectField('expires_at', mtMap.date())
});

