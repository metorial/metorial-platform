import { mtMap } from '@metorial/util-resource-mapper';

export type FilesLinksDeleteOutput = {
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapFilesLinksDeleteOutput = mtMap.object<FilesLinksDeleteOutput>({
  id: mtMap.objectField('id', mtMap.passthrough()),
  fileId: mtMap.objectField('file_id', mtMap.passthrough()),
  url: mtMap.objectField('url', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  expiresAt: mtMap.objectField('expires_at', mtMap.date())
});

