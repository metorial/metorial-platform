import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProvidersToolsListOutput = {
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

export let mapDashboardInstanceProvidersToolsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProvidersToolsListOutput>(
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

export type DashboardInstanceProvidersToolsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  providerVersionId: string;
  providerAuthMethodId?: string | string[] | undefined;
};

export let mapDashboardInstanceProvidersToolsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceProvidersToolsListQuery>([
    3,
    [[0, [1, ['provider_version_id', 'provider_auth_method_id']]]]
  ]);
