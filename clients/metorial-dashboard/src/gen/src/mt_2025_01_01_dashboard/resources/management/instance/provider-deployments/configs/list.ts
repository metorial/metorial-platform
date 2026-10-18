import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderDeploymentsConfigsListOutput = {
  items: {
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
    ownerActor: {
      id: string;
      type: 'person' | 'agent' | 'consumer';
      consumerId: string | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProviderDeploymentsConfigsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderDeploymentsConfigsListOutput>(
    [
      7,
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
                  [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
                ],
                'created_at',
                'updated_at'
              ]
            ]
          ],
          ['owner_actor', 1, [1, ['consumer_id']]],
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceProviderDeploymentsConfigsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined;
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerSpecificationId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  availableForUse?: boolean | undefined;
  availableForProviderDeploymentId?: string | undefined;
  providerConfigVaultId?: string | string[] | undefined;
  actorId?: string | string[] | undefined;
  consumerId?: string | string[] | undefined;
  identityId?: string | string[] | undefined;
  identityCredentialId?: string | string[] | undefined;
  search?: string | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceProviderDeploymentsConfigsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderDeploymentsConfigsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'provider_id',
              'provider_specification_id',
              'provider_deployment_id',
              'available_for_use',
              'available_for_provider_deployment_id',
              'provider_config_vault_id',
              'actor_id',
              'consumer_id',
              'identity_id',
              'identity_credential_id',
              ['created_at', 1, 5],
              ['updated_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
