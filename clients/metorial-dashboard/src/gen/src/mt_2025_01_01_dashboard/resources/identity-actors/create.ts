import { createMapper } from '@metorial/util-resource-mapper/compact';

export type IdentityActorsCreateOutput = {
  object: 'identity.actor';
  id: string;
  type: 'person' | 'agent' | 'consumer';
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  agentId: string | null;
  consumerId: string | null;
  defaultIdentityId: string | null;
  createdAt: Date;
  updatedAt: Date;
} & {
  consumer:
    | ({
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
      })
    | null;
};

export let mapIdentityActorsCreateOutput =
  /* @__PURE__ */ createMapper<IdentityActorsCreateOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'agent_id',
              'consumer_id',
              'default_identity_id',
              'created_at',
              'updated_at',
              [
                'consumer',
                0,
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
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type IdentityActorsCreateBody = {
  type: 'person' | 'agent';
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapIdentityActorsCreateBody =
  /* @__PURE__ */ createMapper<IdentityActorsCreateBody>(0);
