import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProvidersVersionsListOutput = {
  items: {
    object: 'provider.version';
    id: string;
    version: string;
    providerId: string;
    isCurrent: boolean;
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    specificationId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapProvidersVersionsListOutput =
  /* @__PURE__ */ createMapper<ProvidersVersionsListOutput>(
    [
      7,
      [
        1,
        [
          'provider_id',
          'is_current',
          'specification_id',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ProvidersVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  search?: string | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapProvidersVersionsListQuery =
  /* @__PURE__ */ createMapper<ProvidersVersionsListQuery>([
    3,
    [[0, [1, ['provider_id', ['created_at', 1, 5], ['updated_at', 1, 5]]]]]
  ]);
