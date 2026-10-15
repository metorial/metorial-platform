import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProvidersSpecificationsGetOutput = {
  object: 'provider.specification';
  id: string;
  key: string;
  name: string;
  description: string | null;
  configSchema: Record<string, any>;
  configVisibility: 'encrypted' | 'plain';
  tools: {
    object: 'provider.tool';
    id: string;
    key: string;
    name: string;
    description: string | null;
    capabilities: Record<string, any>;
    constraints: string[];
    instructions: string[];
    inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
    outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
    tags: { destructive: boolean | null; readOnly: boolean | null } | null;
    toolCategoryKeys: string[];
    specificationId: string;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  toolCategories: {
    object: 'provider.tool_category';
    key: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    toolCount: number;
  }[];
  authMethods: {
    object: 'provider.capabilities.auth_method';
    id: string;
    type: 'oauth' | 'token' | 'custom';
    key: string;
    name: string;
    description: string | null;
    capabilities: Record<string, any>;
    inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
    outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
    scopes:
      | {
          object: 'provider.capabilities.auth_method.scope';
          id: string;
          scope: string;
          name: string;
          description: string | null;
        }[]
      | null;
    adapters: string[] | null;
    providerId: string;
    providerSpecificationId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProvidersSpecificationsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProvidersSpecificationsGetOutput>(
    [
      'config_schema',
      'config_visibility',
      [
        'tools',
        0,
        [
          2,
          [
            1,
            [
              'input_schema',
              'output_schema',
              ['tags', 0, [1, ['read_only']]],
              'tool_category_keys',
              'specification_id',
              'provider_id',
              'created_at',
              'updated_at'
            ]
          ]
        ]
      ],
      ['tool_categories', 1, [2, [1, ['image_url', 'tool_count']]]],
      [
        'auth_methods',
        1,
        [
          2,
          [
            1,
            [
              'input_schema',
              'output_schema',
              'provider_id',
              'provider_specification_id',
              'created_at',
              'updated_at'
            ]
          ]
        ]
      ],
      'provider_id',
      'created_at',
      'updated_at'
    ],
    1
  );
