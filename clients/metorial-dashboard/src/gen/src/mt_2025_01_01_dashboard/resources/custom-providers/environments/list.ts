import { createMapper } from '@metorial/util-resource-mapper/compact';

export type CustomProvidersEnvironmentsListOutput = {
  items: {
    object: 'custom_provider.environment';
    id: string;
    customProviderId: string;
    providerId: string | null;
    currentProviderVersionId: string | null;
    instanceId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapCustomProvidersEnvironmentsListOutput =
  /* @__PURE__ */ createMapper<CustomProvidersEnvironmentsListOutput>(
    [
      7,
      [
        1,
        [
          'custom_provider_id',
          'provider_id',
          'current_provider_version_id',
          'instance_id',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type CustomProvidersEnvironmentsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  customProviderVersionId?: string | string[] | undefined;
  customProviderId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapCustomProvidersEnvironmentsListQuery =
  /* @__PURE__ */ createMapper<CustomProvidersEnvironmentsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'custom_provider_version_id',
            'custom_provider_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
