import { mtMap } from '@metorial/util-resource-mapper';

export type ConsumerProvidersDeployOutput = {
  object: 'magic_mcp.server';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  source: 'manual' | 'consumer_provider_template';
  sessionTemplateId: string;
  providerTemplateId: string | null;
  endpoints: { id: string; alias: string; url: string }[];
  name: string | null;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapConsumerProvidersDeployOutput =
  mtMap.object<ConsumerProvidersDeployOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    source: mtMap.objectField('source', mtMap.passthrough()),
    sessionTemplateId: mtMap.objectField(
      'session_template_id',
      mtMap.passthrough()
    ),
    providerTemplateId: mtMap.objectField(
      'provider_template_id',
      mtMap.passthrough()
    ),
    endpoints: mtMap.objectField(
      'endpoints',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          alias: mtMap.objectField('alias', mtMap.passthrough()),
          url: mtMap.objectField('url', mtMap.passthrough())
        })
      )
    ),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ConsumerProvidersDeployBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  config?: Record<string, any> | undefined;
  auth?:
    | { type: 'setup_session'; providerSetupSessionId: string }
    | {
        type: 'manual';
        providerAuthMethodId: string;
        value: Record<string, any>;
      }
    | undefined;
};

export let mapConsumerProvidersDeployBody =
  mtMap.object<ConsumerProvidersDeployBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    config: mtMap.objectField('config', mtMap.passthrough()),
    auth: mtMap.objectField(
      'auth',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            providerSetupSessionId: mtMap.objectField(
              'provider_setup_session_id',
              mtMap.passthrough()
            ),
            providerAuthMethodId: mtMap.objectField(
              'provider_auth_method_id',
              mtMap.passthrough()
            ),
            value: mtMap.objectField('value', mtMap.passthrough())
          })
        )
      ])
    )
  });

