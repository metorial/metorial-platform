import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProvidersSpecificationsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapProvidersSpecificationsListOutput =
  /* @__PURE__ */ createMapper<ProvidersSpecificationsListOutput>(
    [
      7,
      [
        1,
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
        ]
      ]
    ],
    1
  );

export type ProvidersSpecificationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerVersionId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerConfigId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapProvidersSpecificationsListQuery =
  /* @__PURE__ */ createMapper<ProvidersSpecificationsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'provider_id',
            'provider_version_id',
            'provider_deployment_id',
            'provider_config_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
