import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePublishersListOutput = {
  items: {
    object: 'provider.publisher';
    id: string;
    name: string;
    description: string | null;
    imageUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstancePublishersListOutput =
  /* @__PURE__ */ createMapper<ManagementInstancePublishersListOutput>(
    [7, [1, ['image_url', 'created_at', 'updated_at']]],
    1
  );

export type ManagementInstancePublishersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstancePublishersListQuery =
  /* @__PURE__ */ createMapper<ManagementInstancePublishersListQuery>(0);
