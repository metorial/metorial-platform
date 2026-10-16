import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceIdentityActorsGetOutput = {
  object: 'identity.actor';
  id: string;
  type: 'person' | 'agent';
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  agentId: string | null;
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
      } & { isPortalConsumer: boolean; isOrganizationMember: boolean })
    | null;
};

export let mapManagementInstanceIdentityActorsGetOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceIdentityActorsGetOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'agent_id',
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
                          'is_organization_member'
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
