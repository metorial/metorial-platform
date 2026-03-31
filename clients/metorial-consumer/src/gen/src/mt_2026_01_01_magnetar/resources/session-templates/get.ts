import { mtMap } from '@metorial/util-resource-mapper';

export type SessionTemplatesGetOutput = {
  object: 'session.template';
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  providers: {
    object: 'session.template.provider';
    id: string;
    status: 'active' | 'archived' | 'deleted';
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
    sessionTemplateId: string;
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
  createdAt: Date;
  updatedAt: Date;
};

export let mapSessionTemplatesGetOutput =
  mtMap.object<SessionTemplatesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providers: mtMap.objectField(
      'providers',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
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
          sessionTemplateId: mtMap.objectField(
            'session_template_id',
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
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

