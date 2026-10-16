import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsListingsUpdateOutput = {
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
};

export let mapDashboardInstancePortalsListingsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstancePortalsListingsUpdateOutput>(
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
    ],
    1
  );

export type DashboardInstancePortalsListingsUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  readme?: string | null | undefined;
};

export let mapDashboardInstancePortalsListingsUpdateBody =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsListingsUpdateBody>(0);
