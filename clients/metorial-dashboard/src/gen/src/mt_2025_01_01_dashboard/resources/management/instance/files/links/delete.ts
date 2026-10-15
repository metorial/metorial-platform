import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceFilesLinksDeleteOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapManagementInstanceFilesLinksDeleteOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceFilesLinksDeleteOutput>(
    ['file_id', 'created_at', 'expires_at'],
    1
  );
