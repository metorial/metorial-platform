import { mapObject } from '@metorial/util-resource-mapper/compact';

export type FilesLinksCreateOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapFilesLinksCreateOutput =
  /* @__PURE__ */ mapObject<FilesLinksCreateOutput>(
    ['file_id', 'created_at', 'expires_at'],
    1
  );

export type FilesLinksCreateBody = {
  fileId: string;
  expiresAt?: Date | undefined;
};

export let mapFilesLinksCreateBody =
  /* @__PURE__ */ mapObject<FilesLinksCreateBody>(['file_id', 'expires_at'], 1);
