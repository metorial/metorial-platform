import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionsDeleteOutput = {
  object: 'session';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  connectionState: 'connected' | 'disconnected';
  connectionUrl: string;
  clientSecret: string | null;
  usage: {
    totalProductiveClientMessageCount: number;
    totalProductiveProviderMessageCount: number;
  };
  providers: {
    object: 'session.provider';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    usage: {
      totalProductiveClientMessageCount: number;
      totalProductiveProviderMessageCount: number;
    };
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
    sessionId: string;
    fromTemplateId: string | null;
    fromTemplateProviderId: string | null;
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
    };
    config: {
      object: 'provider.config#preview';
      id: string;
      isDefault: boolean;
      name: string | null;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    };
    authConfig: { object: 'provider.auth_config#preview'; id: string } | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  fromTemplatesIds: string[];
  hasErrors: boolean;
  hasWarnings: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceSessionsDeleteOutput =
  mtMap.object<DashboardInstanceSessionsDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    connectionState: mtMap.objectField('connection_state', mtMap.passthrough()),
    connectionUrl: mtMap.objectField('connection_url', mtMap.passthrough()),
    clientSecret: mtMap.objectField('client_secret', mtMap.passthrough()),
    usage: mtMap.objectField(
      'usage',
      mtMap.object({
        totalProductiveClientMessageCount: mtMap.objectField(
          'total_productive_client_message_count',
          mtMap.passthrough()
        ),
        totalProductiveProviderMessageCount: mtMap.objectField(
          'total_productive_provider_message_count',
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
          usage: mtMap.objectField(
            'usage',
            mtMap.object({
              totalProductiveClientMessageCount: mtMap.objectField(
                'total_productive_client_message_count',
                mtMap.passthrough()
              ),
              totalProductiveProviderMessageCount: mtMap.objectField(
                'total_productive_provider_message_count',
                mtMap.passthrough()
              )
            })
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
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
          fromTemplateId: mtMap.objectField(
            'from_template_id',
            mtMap.passthrough()
          ),
          fromTemplateProviderId: mtMap.objectField(
            'from_template_provider_id',
            mtMap.passthrough()
          ),
          deployment: mtMap.objectField(
            'deployment',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          config: mtMap.objectField(
            'config',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          authConfig: mtMap.objectField(
            'auth_config',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    fromTemplatesIds: mtMap.objectField(
      'from_templates_ids',
      mtMap.array(mtMap.passthrough())
    ),
    hasErrors: mtMap.objectField('has_errors', mtMap.passthrough()),
    hasWarnings: mtMap.objectField('has_warnings', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

