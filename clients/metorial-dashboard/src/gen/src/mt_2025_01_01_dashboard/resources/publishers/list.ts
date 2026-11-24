import { createMapper } from '@metorial/util-resource-mapper/compact';

export type PublishersListOutput = {
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

export let mapPublishersListOutput =
  /* @__PURE__ */ createMapper<PublishersListOutput>(
    [7, [1, ['image_url', 'created_at', 'updated_at']]],
    1
  );

export type PublishersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapPublishersListQuery =
  /* @__PURE__ */ createMapper<PublishersListQuery>(0);
