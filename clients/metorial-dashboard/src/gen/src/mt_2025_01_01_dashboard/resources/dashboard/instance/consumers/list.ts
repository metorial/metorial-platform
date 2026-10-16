import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceConsumersListOutput = {
  items: ({
    object: 'consumer';
    id: string;
    name: string;
    email: string;
    imageUrl: string;
    userId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } & { isPortalConsumer: boolean; isOrganizationMember: boolean })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceConsumersListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceConsumersListOutput>(
    [
      7,
      [
        3,
        [
          [
            0,
            [
              1,
              [
                'image_url',
                'user_id',
                'created_at',
                'updated_at',
                'is_portal_consumer',
                'is_organization_member'
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceConsumersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  email?: string | string[] | undefined;
  id?: string | undefined;
};

export let mapDashboardInstanceConsumersListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceConsumersListQuery>(0);
