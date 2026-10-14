import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProvidersListOutput = {
  items: {
    object: 'provider';
    id: string;
    access: 'public' | 'tenant';
    status: 'active' | 'archived' | 'deleted';
    publisher: {
      object: 'provider.publisher';
      id: string;
      name: string;
      description: string | null;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    };
    currentVersion: {
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
    } | null;
    oauth: {
      status: 'enabled' | 'disabled';
      callbackUrl: string | null;
      autoRegistration: { status: 'supported' | 'unsupported' };
    } | null;
    identifier: string;
    name: string;
    description: string | null;
    slug: string;
    metadata: Record<string, any> | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProvidersListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProvidersListOutput>(
    [
      7,
      [
        1,
        [
          ['publisher', 0, [1, ['image_url', 'created_at', 'updated_at']]],
          [
            'current_version',
            1,
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
          ['oauth', 0, [1, ['callback_url', 'auto_registration']]],
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { id?: string | string[] | undefined };

export let mapDashboardInstanceProvidersListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceProvidersListQuery>(0);
