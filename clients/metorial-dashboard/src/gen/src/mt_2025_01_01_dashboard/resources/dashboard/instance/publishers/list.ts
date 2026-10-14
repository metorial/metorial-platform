import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePublishersListOutput = {
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

export let mapDashboardInstancePublishersListOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePublishersListOutput>(
    [7, [1, ['image_url', 'created_at', 'updated_at']]],
    1
  );

export type DashboardInstancePublishersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstancePublishersListQuery =
  /* @__PURE__ */ createMapper<DashboardInstancePublishersListQuery>(0);
