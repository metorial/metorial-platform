import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIdentityActorsCreateOutput = {
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

export let mapDashboardInstanceIdentityActorsCreateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceIdentityActorsCreateOutput>(
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

export type DashboardInstanceIdentityActorsCreateBody = {
  type: 'person' | 'agent';
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapDashboardInstanceIdentityActorsCreateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceIdentityActorsCreateBody>(0);
