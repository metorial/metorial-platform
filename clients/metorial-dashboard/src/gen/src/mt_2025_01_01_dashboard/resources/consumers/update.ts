import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ConsumersUpdateOutput = {
  object: 'consumer';
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
} & { isPortalConsumer: boolean; isOrganizationMember: boolean };

export let mapConsumersUpdateOutput =
  /* @__PURE__ */ createMapper<ConsumersUpdateOutput>(
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

export type ConsumersUpdateBody = {
  name?: string | undefined;
  email?: string | undefined;
};

export let mapConsumersUpdateBody =
  /* @__PURE__ */ createMapper<ConsumersUpdateBody>(0);
