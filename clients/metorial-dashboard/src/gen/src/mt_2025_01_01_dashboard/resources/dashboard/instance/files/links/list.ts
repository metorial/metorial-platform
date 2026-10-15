import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceFilesLinksListOutput = {
  items: {
    object: 'file.file_link';
    id: string;
    fileId: string;
    url: string;
    createdAt: Date;
    expiresAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceFilesLinksListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceFilesLinksListOutput>(
    [7, [1, ['file_id', 'created_at', 'expires_at']]],
    1
  );

export type DashboardInstanceFilesLinksListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { fileId?: string | undefined };

export let mapDashboardInstanceFilesLinksListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceFilesLinksListQuery>([
    3,
    [[0, [1, ['file_id']]]]
  ]);
