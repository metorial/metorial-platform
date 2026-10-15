import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ConsumerProfileGroupsListOutput = {
  items: {
    object: 'consumer.group';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapConsumerProfileGroupsListOutput =
  /* @__PURE__ */ createMapper<ConsumerProfileGroupsListOutput>(
    [7, [1, ['is_default', 'created_at', 'updated_at']]],
    1
  );

export type ConsumerProfileGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapConsumerProfileGroupsListQuery =
  /* @__PURE__ */ createMapper<ConsumerProfileGroupsListQuery>(0);
