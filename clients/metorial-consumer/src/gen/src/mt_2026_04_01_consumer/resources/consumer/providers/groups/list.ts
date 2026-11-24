import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ConsumerProvidersGroupsListOutput = {
  items: {
    object: 'consumer.surface.provider_group';
    id: string;
    name: string;
    description: string | null;
    index: number;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapConsumerProvidersGroupsListOutput =
  /* @__PURE__ */ createMapper<ConsumerProvidersGroupsListOutput>([7, 8]);

export type ConsumerProvidersGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapConsumerProvidersGroupsListQuery =
  /* @__PURE__ */ createMapper<ConsumerProvidersGroupsListQuery>(0);
