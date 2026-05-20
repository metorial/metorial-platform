import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceIntegrationsInstanceGroupsUpdateOutput = {
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
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export let mapManagementInstanceIntegrationsInstanceGroupsUpdateOutput =
  mtMap.object<ManagementInstanceIntegrationsInstanceGroupsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    implementation: mtMap.objectField(
      'implementation',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        magicMcpEndpointId: mtMap.objectField(
          'magic_mcp_endpoint_id',
          mtMap.passthrough()
        )
      })
    ),
    providers: mtMap.objectField(
      'providers',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          integrationId: mtMap.objectField(
            'integration_id',
            mtMap.passthrough()
          ),
          integrationInstanceGroupId: mtMap.objectField(
            'integration_instance_group_id',
            mtMap.passthrough()
          ),
          integrationInstanceId: mtMap.objectField(
            'integration_instance_id',
            mtMap.passthrough()
          ),
          integrationProviderId: mtMap.objectField(
            'integration_provider_id',
            mtMap.passthrough()
          ),
          integrationInstanceProviderId: mtMap.objectField(
            'integration_instance_provider_id',
            mtMap.passthrough()
          ),
          toolFilter: mtMap.objectField(
            'tool_filter',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  ignoreParentFilters: mtMap.objectField(
                    'ignore_parent_filters',
                    mtMap.passthrough()
                  ),
                  filters: mtMap.objectField(
                    'filters',
                    mtMap.array(
                      mtMap.union([
                        mtMap.unionOption(
                          'object',
                          mtMap.object({
                            type: mtMap.objectField(
                              'type',
                              mtMap.passthrough()
                            ),
                            keys: mtMap.objectField(
                              'keys',
                              mtMap.array(mtMap.passthrough())
                            ),
                            pattern: mtMap.objectField(
                              'pattern',
                              mtMap.passthrough()
                            ),
                            uris: mtMap.objectField(
                              'uris',
                              mtMap.array(mtMap.passthrough())
                            )
                          })
                        )
                      ])
                    )
                  )
                })
              )
            ])
          ),
          isOverrideToolFilter: mtMap.objectField(
            'is_override_tool_filter',
            mtMap.passthrough()
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          archivedAt: mtMap.objectField('archived_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    archivedAt: mtMap.objectField('archived_at', mtMap.date())
  });

export type ManagementInstanceIntegrationsInstanceGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  metadata?: Record<string, any> | null | undefined;
  providers?:
    | {
        integrationInstanceProviderId: string;
        toolFilters?:
          | (
              | { type: 'tool_keys'; keys: string[] }
              | { type: 'tool_regex'; pattern: string }
              | { type: 'resource_regex'; pattern: string }
              | { type: 'resource_uris'; uris: string[] }
              | { type: 'prompt_keys'; keys: string[] }
              | { type: 'prompt_regex'; pattern: string }
            )
          | (
              | { type: 'tool_keys'; keys: string[] }
              | { type: 'tool_regex'; pattern: string }
              | { type: 'resource_regex'; pattern: string }
              | { type: 'resource_uris'; uris: string[] }
              | { type: 'prompt_keys'; keys: string[] }
              | { type: 'prompt_regex'; pattern: string }
            )[]
          | null
          | undefined;
      }[]
    | undefined;
};

export let mapManagementInstanceIntegrationsInstanceGroupsUpdateBody =
  mtMap.object<ManagementInstanceIntegrationsInstanceGroupsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providers: mtMap.objectField(
      'providers',
      mtMap.array(
        mtMap.object({
          integrationInstanceProviderId: mtMap.objectField(
            'integration_instance_provider_id',
            mtMap.passthrough()
          ),
          toolFilters: mtMap.objectField(
            'tool_filters',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  keys: mtMap.objectField(
                    'keys',
                    mtMap.array(mtMap.passthrough())
                  ),
                  pattern: mtMap.objectField('pattern', mtMap.passthrough()),
                  uris: mtMap.objectField(
                    'uris',
                    mtMap.array(mtMap.passthrough())
                  )
                })
              ),
              mtMap.unionOption(
                'array',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      keys: mtMap.objectField(
                        'keys',
                        mtMap.array(mtMap.passthrough())
                      ),
                      pattern: mtMap.objectField(
                        'pattern',
                        mtMap.passthrough()
                      ),
                      uris: mtMap.objectField(
                        'uris',
                        mtMap.array(mtMap.passthrough())
                      )
                    })
                  )
                ])
              )
            ])
          )
        })
      )
    )
  });

