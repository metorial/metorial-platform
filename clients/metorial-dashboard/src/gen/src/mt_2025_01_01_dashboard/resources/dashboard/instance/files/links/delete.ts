import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceFilesLinksDeleteOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapDashboardInstanceFilesLinksDeleteOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceFilesLinksDeleteOutput>(
    ['file_id', 'created_at', 'expires_at'],
    1
  );
