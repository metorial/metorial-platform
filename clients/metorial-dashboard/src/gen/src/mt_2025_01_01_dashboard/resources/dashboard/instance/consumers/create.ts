import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceConsumersCreateOutput = {
  object: 'consumer';
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
} & { isPortalConsumer: boolean; isOrganizationMember: boolean };

export let mapDashboardInstanceConsumersCreateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceConsumersCreateOutput>(
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
    ],
    1
  );

export type DashboardInstanceConsumersCreateBody = {
  name: string;
  email: string;
};

export let mapDashboardInstanceConsumersCreateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceConsumersCreateBody>(0);
