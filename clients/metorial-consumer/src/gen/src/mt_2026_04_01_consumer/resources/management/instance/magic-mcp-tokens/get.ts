import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceMagicMcpTokensGetOutput = {
  object: 'magic_mcp.token';
  id: string;
  status: 'active' | 'deleted';
  secret: string;
  name: string | null;
  description: string | null;
  server: {
    object: 'magic_mcp.server#preview';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string | null;
    description: string | null;
  } | null;
  endpoint: {
    object: 'magic_mcp.endpoint#preview';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    slug: string;
    name: string | null;
    description: string | null;
  } | null;
  groups: {
    object: 'magic_mcp.group';
    id: string;
    status: 'active' | 'deleted' | 'archived';
    slug: string;
    name: string | null;
    description: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  }[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
} & {
  consumerTokens: {
    object: 'consumer.token';
    id: string;
    consumerId: string;
    consumerProfileId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
};

export let mapManagementInstanceMagicMcpTokensGetOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceMagicMcpTokensGetOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              ['groups', 0, [2, 8]],
              'created_at',
              'updated_at',
              [
                'consumer_tokens',
                1,
                [
                  2,
                  [
                    1,
                    [
                      'consumer_id',
                      'consumer_profile_id',
                      'created_at',
                      'updated_at'
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
