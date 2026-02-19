import { mtMap } from '@metorial/util-resource-mapper';

export type SessionTemplatesProvidersListOutput = {
  items: {
    object: 'session.template.provider';
    id: string;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    sessionTemplateId: string;
    providerId: string;
    providerDeploymentId: string | null;
    providerDeploymentName: string | null;
    providerConfigName: string | null;
    providerAuthConfigName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSessionTemplatesProvidersListOutput =
  mtMap.object<SessionTemplatesProvidersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          sessionTemplateId: mtMap.objectField('session_template_id', mtMap.passthrough()),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          providerDeploymentId: mtMap.objectField(
            'provider_deployment_id',
            mtMap.passthrough()
          ),
          providerDeploymentName: mtMap.objectField(
            'provider_deployment_name',
            mtMap.passthrough()
          ),
          providerConfigName: mtMap.objectField('provider_config_name', mtMap.passthrough()),
          providerAuthConfigName: mtMap.objectField(
            'provider_auth_config_name',
            mtMap.passthrough()
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type SessionTemplatesProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { providerId?: string | string[] | undefined };

export let mapSessionTemplatesProvidersListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      providerId: mtMap.objectField(
        'provider_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      )
    })
  )
]);
