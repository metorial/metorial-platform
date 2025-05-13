import { mtMap } from '@metorial/util-resource-mapper';

export type FilesLinksUpdateOutput = {
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapFilesLinksUpdateOutput = mtMap.object<FilesLinksUpdateOutput>({
  id: mtMap.objectField('id', mtMap.passthrough()),
  fileId: mtMap.objectField('file_id', mtMap.passthrough()),
  url: mtMap.objectField('url', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  expiresAt: mtMap.objectField('expires_at', mtMap.date())
});

export type FilesLinksUpdateBody = { expiresAt?: Date | undefined };

export let mapFilesLinksUpdateBody = mtMap.object<FilesLinksUpdateBody>({
  expiresAt: mtMap.objectField('expires_at', mtMap.date())
});

