import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceFilesLinksListOutput = {
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

export let mapManagementInstanceFilesLinksListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceFilesLinksListOutput>(
    [7, [1, ['file_id', 'created_at', 'expires_at']]],
    1
  );

export type ManagementInstanceFilesLinksListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { fileId?: string | undefined };

export let mapManagementInstanceFilesLinksListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceFilesLinksListQuery>([
    3,
    [[0, [1, ['file_id']]]]
  ]);
