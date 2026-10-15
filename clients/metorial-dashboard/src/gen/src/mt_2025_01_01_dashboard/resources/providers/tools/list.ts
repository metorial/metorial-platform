import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProvidersToolsListOutput = {
  items: {
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
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapProvidersToolsListOutput =
  /* @__PURE__ */ createMapper<ProvidersToolsListOutput>(
    [
      7,
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
    ],
    1
  );

export type ProvidersToolsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  providerVersionId: string;
  providerAuthMethodId?: string | string[] | undefined;
};

export let mapProvidersToolsListQuery =
  /* @__PURE__ */ createMapper<ProvidersToolsListQuery>([
    3,
    [[0, [1, ['provider_version_id', 'provider_auth_method_id']]]]
  ]);
