import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderTemplatesUpdateOutput = {
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

export let mapDashboardInstanceProviderTemplatesUpdateOutput =
  mtMap.object<DashboardInstanceProviderTemplatesUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
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
            )
          })
        )
      ])
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceProviderTemplatesUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
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
};

export let mapDashboardInstanceProviderTemplatesUpdateBody =
  mtMap.object<DashboardInstanceProviderTemplatesUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    toolFilters: mtMap.objectField(
      'tool_filters',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            keys: mtMap.objectField('keys', mtMap.array(mtMap.passthrough())),
            pattern: mtMap.objectField('pattern', mtMap.passthrough()),
            uris: mtMap.objectField('uris', mtMap.array(mtMap.passthrough()))
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
                pattern: mtMap.objectField('pattern', mtMap.passthrough()),
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
  });

