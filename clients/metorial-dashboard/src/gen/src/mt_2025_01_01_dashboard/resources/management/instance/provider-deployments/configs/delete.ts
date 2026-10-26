import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderDeploymentsConfigsDeleteOutput = {
  object: 'provider.config';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  isDefault: boolean;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  toolFilter:
    | { type: 'allow_all'; ignoreParentFilters: boolean }
    | {
        type: 'filter';
        filters: (
          | { type: 'tool_keys'; keys: string[] }
          | { type: 'tool_categories'; keys: string[] }
          | { type: 'tool_regex'; pattern: string }
          | { type: 'resource_regex'; pattern: string }
          | { type: 'resource_uris'; uris: string[] }
          | { type: 'prompt_keys'; keys: string[] }
          | { type: 'prompt_regex'; pattern: string }
        )[];
        ignoreParentFilters: boolean;
      };
  providerId: string;
  specificationId: string;
  deployment: {
    object: 'provider.deployment#preview';
    id: string;
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  fromVault: {
    object: 'provider.config_vault';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    deployment: {
      object: 'provider.deployment#preview';
      id: string;
      isDefault: boolean;
      name: string | null;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  access: {
    source:
      | 'explorer'
      | 'manual'
      | 'setup_session'
      | 'system'
      | 'public_mcp'
      | 'consumer_provider_template'
      | null;
    type: 'public' | 'owner_locked';
    visibility: 'anyone' | 'owner';
    owner: {
      type: 'person' | 'agent' | 'consumer' | 'organization_member';
      name: string | null;
      imageUrl: string | null;
      email: string | null;
      organizationMember?: { id: string } | undefined;
      consumer?:
        { id: string; profileId: string; portalId: string | null } | undefined;
    } | null;
  };
  createdAt: Date;
  updatedAt: Date;
} & { publicMcpServerId: string | null };

export let mapManagementInstanceProviderDeploymentsConfigsDeleteOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderDeploymentsConfigsDeleteOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'is_default',
              ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
              'provider_id',
              'specification_id',
              [
                'deployment',
                0,
                [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
              ],
              [
                'from_vault',
                1,
                [
                  1,
                  [
                    'provider_id',
                    [
                      'deployment',
                      0,
                      [
                        1,
                        [
                          'is_default',
                          'provider_id',
                          'created_at',
                          'updated_at'
                        ]
                      ]
                    ],
                    'created_at',
                    'updated_at'
                  ]
                ]
              ],
              [
                'access',
                0,
                [
                  1,
                  [
                    [
                      'owner',
                      0,
                      [
                        1,
                        [
                          'image_url',
                          'organization_member',
                          ['consumer', 0, [1, ['profile_id', 'portal_id']]]
                        ]
                      ]
                    ]
                  ]
                ]
              ],
              'created_at',
              'updated_at',
              'public_mcp_server_id'
            ]
          ]
        ]
      ]
    ],
    1
  );
