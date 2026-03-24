import { mtMap } from '@metorial/util-resource-mapper';

export type ProvidersTriggersListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapProvidersTriggersListOutput =
  mtMap.object<ProvidersTriggersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
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
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type ProvidersTriggersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { providerVersionId: string };

export let mapProvidersTriggersListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      providerVersionId: mtMap.objectField(
        'provider_version_id',
        mtMap.passthrough()
      )
    })
  )
]);

