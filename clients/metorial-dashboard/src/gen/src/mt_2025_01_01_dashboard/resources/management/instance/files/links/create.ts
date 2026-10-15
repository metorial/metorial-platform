import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceFilesLinksCreateOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapManagementInstanceFilesLinksCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceFilesLinksCreateOutput>(
    ['file_id', 'created_at', 'expires_at'],
    1
  );

export type ManagementInstanceFilesLinksCreateBody = {
  fileId: string;
  expiresAt?: Date | undefined;
};

export let mapManagementInstanceFilesLinksCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceFilesLinksCreateBody>(
    ['file_id', 'expires_at'],
    1
  );
