import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceFilesLinksGetOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapManagementInstanceFilesLinksGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceFilesLinksGetOutput>(
    ['file_id', 'created_at', 'expires_at'],
    1
  );
