import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePortalsAccessUpdateOutput = {
  object: 'consumer.access';
  id: string;
  accessLevel: 'read' | 'manage' | null;
  name: string;
  description: string | null;
  readme: string | null;
  listing: { id: string; name: string; description: string | null } | null;
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
  consumerGroup: {
    object: 'consumer.group';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePortalsAccessUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementInstancePortalsAccessUpdateOutput>(
    [
      'access_level',
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
      ['consumer_group', 1, [1, ['is_default', 'created_at', 'updated_at']]],
      'created_at',
      'updated_at'
    ],
    1
  );

export type ManagementInstancePortalsAccessUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  readme?: string | null | undefined;
};

export let mapManagementInstancePortalsAccessUpdateBody =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsAccessUpdateBody>(0);
