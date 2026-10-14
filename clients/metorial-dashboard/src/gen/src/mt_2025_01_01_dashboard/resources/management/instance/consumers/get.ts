import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceConsumersGetOutput = {
  object: 'consumer';
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
} & { isPortalConsumer: boolean; isOrganizationMember: boolean };

export let mapManagementInstanceConsumersGetOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceConsumersGetOutput>(
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
