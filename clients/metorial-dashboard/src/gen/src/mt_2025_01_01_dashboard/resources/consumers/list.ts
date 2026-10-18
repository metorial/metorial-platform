import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ConsumersListOutput = {
  items: ({
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
  })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapConsumersListOutput =
  /* @__PURE__ */ createMapper<ConsumersListOutput>(
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
                'is_organization_member',
                'is_service_account'
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type ConsumersListQuery = {
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

export let mapConsumersListQuery =
  /* @__PURE__ */ createMapper<ConsumersListQuery>(0);
