import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceFilesLinksCreateOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapDashboardInstanceFilesLinksCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceFilesLinksCreateOutput>(
    ['file_id', 'created_at', 'expires_at'],
    1
  );

export type DashboardInstanceFilesLinksCreateBody = {
  fileId: string;
  expiresAt?: Date | undefined;
};

export let mapDashboardInstanceFilesLinksCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceFilesLinksCreateBody>(
    ['file_id', 'expires_at'],
    1
  );
