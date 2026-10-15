import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsListingsListOutput = {
  items: {
    object: 'consumer.access_listing';
    id: string;
    name: string;
    description: string | null;
    readme: string | null;
    access:
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
        }
      | {
          type: 'skill';
          skill: {
            object: 'skill';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string;
          };
        }
      | {
          type: 'skill_template';
          skillTemplate: {
            object: 'skill.template';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            owner: 'system' | 'tenant';
            name: string;
            description: string | null;
          };
        }
      | {
          type: 'skill_group';
          skillGroup: {
            object: 'skill.group';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string;
            description: string | null;
          };
        }
      | {
          type: 'skill_marketplace';
          skillMarketplace: {
            object: 'skill.marketplace';
            id: string;
            status: 'active' | 'archived' | 'deleted';
          };
        }
      | {
          type: 'skill_plugin';
          skillPlugin: {
            object: 'skill.plugin';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string | null;
          };
        };
    groups: {
      id: string;
      name: string;
      description: string | null;
      index: number;
    }[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstancePortalsListingsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsListingsListOutput>(
    [
      7,
      [
        1,
        [
          [
            'access',
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
                      'magic_mcp_server',
                      'skill_template',
                      'skill_group',
                      'skill_marketplace',
                      'skill_plugin'
                    ]
                  ]
                ]
              ]
            ]
          ],
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstancePortalsListingsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  consumerSurfaceProviderGroupId?: string | string[] | undefined;
  providerTemplateId?: string | string[] | undefined;
  magicMcpServerId?: string | string[] | undefined;
  skillId?: string | string[] | undefined;
  skillTemplateId?: string | string[] | undefined;
  skillGroupId?: string | string[] | undefined;
  skillMarketplaceId?: string | string[] | undefined;
  type?:
    | 'provider_template'
    | 'magic_mcp_server'
    | 'skill'
    | 'skill_template'
    | 'skill_group'
    | 'skill_marketplace'
    | (
        | 'provider_template'
        | 'magic_mcp_server'
        | 'skill'
        | 'skill_template'
        | 'skill_group'
        | 'skill_marketplace'
      )[]
    | undefined;
};

export let mapDashboardInstancePortalsListingsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsListingsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'consumer_surface_provider_group_id',
            'provider_template_id',
            'magic_mcp_server_id',
            'skill_id',
            'skill_template_id',
            'skill_group_id',
            'skill_marketplace_id'
          ]
        ]
      ]
    ]
  ]);
