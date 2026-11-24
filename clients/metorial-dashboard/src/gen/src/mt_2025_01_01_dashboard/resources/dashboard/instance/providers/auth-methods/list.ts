import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProvidersAuthMethodsListOutput = {
  items: {
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
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProvidersAuthMethodsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProvidersAuthMethodsListOutput>(
    [
      7,
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
    ],
    1
  );

export type DashboardInstanceProvidersAuthMethodsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { providerVersionId: string; adapter?: string | undefined };

export let mapDashboardInstanceProvidersAuthMethodsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceProvidersAuthMethodsListQuery>([
    3,
    [[0, [1, ['provider_version_id']]]]
  ]);
