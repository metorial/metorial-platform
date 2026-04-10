import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsConsumerAccessDeleteOutput = {
  object: 'consumer.access';
  id: string;
  access:
    | {
        type: 'provider_template';
        providerTemplate: {
          object: 'provider.template';
          id: string;
          status: 'active' | 'archived' | 'deleted';
          name: string;
          description: string | null;
          metadata: Record<string, any>;
          providerDeploymentId: string;
          toolFilters:
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
              };
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
      };
  consumerGroup: {
    object: 'consumer.group';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    isDefault: boolean;
    ssoGroupIds: string[];
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsConsumerAccessDeleteOutput =
  mtMap.object<PortalsConsumerAccessDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    access: mtMap.objectField(
      'access',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            providerTemplate: mtMap.objectField(
              'provider_template',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                metadata: mtMap.objectField('metadata', mtMap.passthrough()),
                providerDeploymentId: mtMap.objectField(
                  'provider_deployment_id',
                  mtMap.passthrough()
                ),
                toolFilters: mtMap.objectField(
                  'tool_filters',
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
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            ),
            magicMcpServer: mtMap.objectField(
              'magic_mcp_server',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                )
              })
            )
          })
        )
      ])
    ),
    consumerGroup: mtMap.objectField(
      'consumer_group',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        ssoGroupIds: mtMap.objectField(
          'sso_group_ids',
          mtMap.array(mtMap.passthrough())
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

