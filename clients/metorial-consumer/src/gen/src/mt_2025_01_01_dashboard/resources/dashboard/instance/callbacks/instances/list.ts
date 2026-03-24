import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksInstancesListOutput = {
  items: {
    object: 'callback.instance';
    id: string;
    status: 'attached' | 'detached';
    registrationStatus: 'pending' | 'registered';
    triggers: {
      object: 'callback.instance.trigger';
      id: string;
      source: string;
      pollIntervalSeconds: number | null;
      nextPollAt: Date | null;
      lastPolledAt: Date | null;
      webhookUrl: string | null;
      isWebhookRegistered: boolean;
      providerTrigger: any | null;
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
          registrationStatus: mtMap.objectField(
            'registration_status',
            mtMap.passthrough()
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
                  mtMap.passthrough()
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

