import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceFilesLinksGetOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapDashboardInstanceFilesLinksGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceFilesLinksGetOutput>(
    ['file_id', 'created_at', 'expires_at'],
    1
  );
