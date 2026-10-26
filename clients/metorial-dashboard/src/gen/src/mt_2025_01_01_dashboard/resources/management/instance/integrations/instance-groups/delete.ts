import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceIntegrationsInstanceGroupsDeleteOutput = {
  object: 'integration.instance.group';
  id: string;
  status: 'draft' | 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  implementation: {
    type: 'magic_mcp_endpoint';
    magicMcpEndpointId: string;
  } | null;
  providers: {
    object: 'integration.instance.group.provider';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    integrationId: string;
    integrationInstanceGroupId: string;
    integrationInstanceId: string;
    integrationProviderId: string | null;
    integrationInstanceProviderId: string;
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
        }
      | null;
    isOverrideToolFilter: boolean;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }[];
  access: {
    source: 'explorer' | null;
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
  archivedAt: Date | null;
};

export let mapManagementInstanceIntegrationsInstanceGroupsDeleteOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceIntegrationsInstanceGroupsDeleteOutput>(
    [
      ['implementation', 0, [1, ['magic_mcp_endpoint_id']]],
      [
        'providers',
        0,
        [
          2,
          [
            1,
            [
              'integration_id',
              'integration_instance_group_id',
              'integration_instance_id',
              'integration_provider_id',
              'integration_instance_provider_id',
              ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
              'is_override_tool_filter',
              'created_at',
              'updated_at',
              'archived_at'
            ]
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
      'archived_at'
    ],
    1
  );
