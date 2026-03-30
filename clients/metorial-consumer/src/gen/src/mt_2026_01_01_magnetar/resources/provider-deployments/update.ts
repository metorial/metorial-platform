import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderDeploymentsUpdateOutput = {
  object: 'provider.deployment';
  id: string;
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
          | { type: 'tool_regex'; pattern: string }
          | { type: 'resource_regex'; pattern: string }
          | { type: 'resource_uris'; uris: string[] }
          | { type: 'prompt_keys'; keys: string[] }
          | { type: 'prompt_regex'; pattern: string }
        )[];
        ignoreParentFilters: boolean;
      };
  providerId: string;
  lockedVersion: {
    object: 'provider.version';
    id: string;
    version: string;
    providerId: string;
    isCurrent: boolean;
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    specificationId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  defaultConfig: {
    object: 'provider.config#preview';
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
};

export let mapProviderDeploymentsUpdateOutput =
  mtMap.object<ProviderDeploymentsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
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
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    lockedVersion: mtMap.objectField(
      'locked_version',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        version: mtMap.objectField('version', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        isCurrent: mtMap.objectField('is_current', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        specificationId: mtMap.objectField(
          'specification_id',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    defaultConfig: mtMap.objectField(
      'default_config',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ProviderDeploymentsUpdateBody = {
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

export let mapProviderDeploymentsUpdateBody =
  mtMap.object<ProviderDeploymentsUpdateBody>({
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

