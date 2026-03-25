import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksInstancesListOutput = {
  items: {
    object: 'callback.instance';
    id: string;
    status: 'attached' | 'detached';
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
    authConfig: {
      object: 'provider.auth_config#preview';
      id: string;
      isDefault: boolean;
      name: string | null;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    triggers: {
      object: 'callback.instance.trigger';
      id: string;
      source: 'polling' | 'webhook';
      pollIntervalSeconds: number | null;
      nextPollAt: Date | null;
      lastPolledAt: Date | null;
      webhookUrl: string | null;
      isWebhookRegistered: boolean | null;
      providerTrigger: {
        object: 'provider.capabilities.trigger';
        id: string;
        key: string;
        name: string;
        description: string | null;
        inputSchema: {
          type: 'json_schema';
          schema: Record<string, any>;
        } | null;
        outputSchema: {
          type: 'json_schema';
          schema: Record<string, any>;
        } | null;
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
      } | null;
    }[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceCallbacksInstancesListOutput =
  mtMap.object<DashboardInstanceCallbacksInstancesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
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
          triggers: mtMap.objectField(
            'triggers',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                source: mtMap.objectField('source', mtMap.passthrough()),
                pollIntervalSeconds: mtMap.objectField(
                  'poll_interval_seconds',
                  mtMap.passthrough()
                ),
                nextPollAt: mtMap.objectField('next_poll_at', mtMap.date()),
                lastPolledAt: mtMap.objectField('last_polled_at', mtMap.date()),
                webhookUrl: mtMap.objectField(
                  'webhook_url',
                  mtMap.passthrough()
                ),
                isWebhookRegistered: mtMap.objectField(
                  'is_webhook_registered',
                  mtMap.passthrough()
                ),
                providerTrigger: mtMap.objectField(
                  'provider_trigger',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    key: mtMap.objectField('key', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    description: mtMap.objectField(
                      'description',
                      mtMap.passthrough()
                    ),
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
                            type: mtMap.objectField(
                              'type',
                              mtMap.passthrough()
                            ),
                            intervalSeconds: mtMap.objectField(
                              'interval_seconds',
                              mtMap.passthrough()
                            ),
                            autoRegistration: mtMap.objectField(
                              'auto_registration',
                              mtMap.object({
                                status: mtMap.objectField(
                                  'status',
                                  mtMap.passthrough()
                                )
                              })
                            ),
                            autoUnregistration: mtMap.objectField(
                              'auto_unregistration',
                              mtMap.object({
                                status: mtMap.objectField(
                                  'status',
                                  mtMap.passthrough()
                                )
                              })
                            )
                          })
                        )
                      ])
                    ),
                    providerId: mtMap.objectField(
                      'provider_id',
                      mtMap.passthrough()
                    ),
                    providerSpecificationId: mtMap.objectField(
                      'provider_specification_id',
                      mtMap.passthrough()
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                )
              })
            )
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

export type DashboardInstanceCallbacksInstancesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  status?: 'attached' | 'detached' | ('attached' | 'detached')[] | undefined;
  providerConfigId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
};

export let mapDashboardInstanceCallbacksInstancesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      id: mtMap.objectField(
        'id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      providerConfigId: mtMap.objectField(
        'provider_config_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerAuthConfigId: mtMap.objectField(
        'provider_auth_config_id',
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

