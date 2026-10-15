import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderSpecificationChangeNotificationsListOutput =
  {
    items: {
      object: 'provider.specification_change_notification';
      id: string;
      providerId: string;
      providerVersionId: string;
      fromSpecification: {
        object: 'provider.capabilities.specification#preview';
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      toSpecification: {
        object: 'provider.capabilities.specification#preview';
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      fromProviderVersion: {
        object: 'provider.version#preview';
        id: string;
        version: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      toProviderVersion: {
        object: 'provider.version#preview';
        id: string;
        version: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      createdAt: Date;
    }[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  };

export let mapDashboardInstanceProviderSpecificationChangeNotificationsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderSpecificationChangeNotificationsListOutput>(
    [
      7,
      [
        1,
        [
          'provider_id',
          'provider_version_id',
          ['from_specification', 1, 8],
          ['to_specification', 1, 8],
          ['from_provider_version', 1, 8],
          ['to_provider_version', 1, 8],
          'created_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceProviderSpecificationChangeNotificationsListQuery =
  {
    limit?: number | undefined;
    after?: string | undefined;
    before?: string | undefined;
    cursor?: string | undefined;
    order?: 'asc' | 'desc' | undefined;
  } & {
    id?: string | string[] | undefined;
    target?:
      | 'version'
      | 'deployment_config_pair'
      | ('version' | 'deployment_config_pair')[]
      | undefined;
    providerId?: string | string[] | undefined;
    providerVersionId?: string | string[] | undefined;
    providerSpecificationId?: string | string[] | undefined;
    createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  };

export let mapDashboardInstanceProviderSpecificationChangeNotificationsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderSpecificationChangeNotificationsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'provider_id',
              'provider_version_id',
              'provider_specification_id',
              ['created_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
