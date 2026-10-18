import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceConsumersUpdateOutput = {
  object: 'consumer';
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
} & {
  isPortalConsumer: boolean;
  isOrganizationMember: boolean;
  isServiceAccount: boolean;
};

export let mapDashboardInstanceConsumersUpdateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceConsumersUpdateOutput>(
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
              'is_organization_member',
              'is_service_account'
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceConsumersUpdateBody = {
  name?: string | undefined;
  email?: string | undefined;
};

export let mapDashboardInstanceConsumersUpdateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceConsumersUpdateBody>(0);
