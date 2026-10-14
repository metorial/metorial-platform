import { createMapper } from '@metorial/util-resource-mapper/compact';

export type IdentityActorsListOutput = {
  items: ({
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
  })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapIdentityActorsListOutput =
  /* @__PURE__ */ createMapper<IdentityActorsListOutput>(
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
      ]
    ],
    1
  );

export type IdentityActorsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  agentId?: string | string[] | undefined;
  consumerId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapIdentityActorsListQuery =
  /* @__PURE__ */ createMapper<IdentityActorsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'agent_id',
            'consumer_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
