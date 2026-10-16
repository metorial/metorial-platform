import { createMapper } from '@metorial/util-resource-mapper/compact';

export type PortalsAccessRequestsListOutput = {
  items: {
    object: 'consumer.access_request';
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    message: string | null;
    resolutionMessage: string | null;
    consumerProfile: {
      object: 'consumer.profile#preview';
      id: string;
      name: string;
      email: string;
    };
    target:
      | {
          type: 'provider_template';
          providerTemplate: {
            object: 'provider.template#preview';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string;
            description: string | null;
            metadata: Record<string, any>;
            integrationId: string | null;
            createdAt: Date;
            updatedAt: Date;
          };
        }
      | {
          type: 'magic_mcp_server';
          magicMcpServer: {
            object: 'magic_mcp.server#preview';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string | null;
            description: string | null;
          };
        };
    createdAt: Date;
    updatedAt: Date;
    reviewedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapPortalsAccessRequestsListOutput =
  /* @__PURE__ */ createMapper<PortalsAccessRequestsListOutput>(
    [
      7,
      [
        1,
        [
          'resolution_message',
          'consumer_profile',
          [
            'target',
            0,
            [
              3,
              [
                [
                  0,
                  [
                    1,
                    [
                      [
                        'provider_template',
                        1,
                        [1, ['integration_id', 'created_at', 'updated_at']]
                      ],
                      'magic_mcp_server'
                    ]
                  ]
                ]
              ]
            ]
          ],
          'created_at',
          'updated_at',
          'reviewed_at'
        ]
      ]
    ],
    1
  );

export type PortalsAccessRequestsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'pending'
    | 'approved'
    | 'rejected'
    | ('pending' | 'approved' | 'rejected')[]
    | undefined;
  consumerProfileId?: string | string[] | undefined;
  search?: string | undefined;
};

export let mapPortalsAccessRequestsListQuery =
  /* @__PURE__ */ createMapper<PortalsAccessRequestsListQuery>([
    3,
    [[0, [1, ['consumer_profile_id']]]]
  ]);
