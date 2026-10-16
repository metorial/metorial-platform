import { mapObject } from '@metorial/util-resource-mapper/compact';

export type FilesLinksDeleteOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapFilesLinksDeleteOutput =
  /* @__PURE__ */ mapObject<FilesLinksDeleteOutput>(
    ['file_id', 'created_at', 'expires_at'],
    1
  );
