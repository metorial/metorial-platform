import { mapObject } from '@metorial/util-resource-mapper/compact';

export type FilesLinksGetOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapFilesLinksGetOutput =
  /* @__PURE__ */ mapObject<FilesLinksGetOutput>(
    ['file_id', 'created_at', 'expires_at'],
    1
  );
