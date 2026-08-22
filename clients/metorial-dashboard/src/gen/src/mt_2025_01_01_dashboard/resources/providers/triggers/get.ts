import { mtMap } from '@metorial/util-resource-mapper';

export type ProvidersTriggersGetOutput = {
  object: 'provider.capabilities.trigger';
  id: string;
  key: string;
  name: string;
  description: string | null;
  inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
  outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
  invocation:
    | { type: 'polling'; intervalSeconds: number }
    | {
        type: 'webhook';
        autoRegistration: { status: 'supported' | 'unsupported' };
        autoUnregistration: { status: 'supported' | 'unsupported' };
      };
  providerId: string;
  providerSpecificationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProvidersTriggersGetOutput =
  mtMap.object<ProvidersTriggersGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    key: mtMap.objectField('key', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    inputSchema: mtMap.objectField(
      'input_schema',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        schema: mtMap.objectField('schema', mtMap.passthrough())
      })
    ),
    outputSchema: mtMap.objectField(
      'output_schema',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        schema: mtMap.objectField('schema', mtMap.passthrough())
      })
    ),
    invocation: mtMap.objectField(
      'invocation',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            intervalSeconds: mtMap.objectField(
              'interval_seconds',
              mtMap.passthrough()
            ),
            autoRegistration: mtMap.objectField(
              'auto_registration',
              mtMap.object({
                status: mtMap.objectField('status', mtMap.passthrough())
              })
            ),
            autoUnregistration: mtMap.objectField(
              'auto_unregistration',
              mtMap.object({
                status: mtMap.objectField('status', mtMap.passthrough())
              })
            )
          })
        )
      ])
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerSpecificationId: mtMap.objectField(
      'provider_specification_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

