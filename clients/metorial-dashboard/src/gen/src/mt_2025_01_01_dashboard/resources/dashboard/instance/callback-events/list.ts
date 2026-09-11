import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbackEventsListOutput = {
  items: {
    object: 'callback_event';
    id: string;
    status: 'pending' | 'processed' | 'failed';
    source: 'webhook' | 'polling';
    providerTriggerKey: string;
    mappedType: string | null;
    mappedId: string | null;
    callbackId: string;
    callbackInstanceId: string;
    details: {
      object: 'callback_event.details';
      status: string;
      payload: Record<string, any> | null;
      error: {
        object: 'callback_event.details.error';
        code: string;
        message: string;
      } | null;
      webhook: {
        object: 'callback_event.details.webhook';
        status: string;
        request: {
          object: 'callback_event.details.webhook.request';
          method: string;
          url: string;
          headers: Record<string, string>;
          body: { encoding: 'base64'; content: string } | null;
        } | null;
        receivedAt: Date;
      } | null;
    } | null;
    occurredAt: Date;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceCallbackEventsListOutput =
  mtMap.object<DashboardInstanceCallbackEventsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          source: mtMap.objectField('source', mtMap.passthrough()),
          providerTriggerKey: mtMap.objectField(
            'provider_trigger_key',
            mtMap.passthrough()
          ),
          mappedType: mtMap.objectField('mapped_type', mtMap.passthrough()),
          mappedId: mtMap.objectField('mapped_id', mtMap.passthrough()),
          callbackId: mtMap.objectField('callback_id', mtMap.passthrough()),
          callbackInstanceId: mtMap.objectField(
            'callback_instance_id',
            mtMap.passthrough()
          ),
          details: mtMap.objectField(
            'details',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              payload: mtMap.objectField('payload', mtMap.passthrough()),
              error: mtMap.objectField(
                'error',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  code: mtMap.objectField('code', mtMap.passthrough()),
                  message: mtMap.objectField('message', mtMap.passthrough())
                })
              ),
              webhook: mtMap.objectField(
                'webhook',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  request: mtMap.objectField(
                    'request',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      method: mtMap.objectField('method', mtMap.passthrough()),
                      url: mtMap.objectField('url', mtMap.passthrough()),
                      headers: mtMap.objectField(
                        'headers',
                        mtMap.passthrough()
                      ),
                      body: mtMap.objectField(
                        'body',
                        mtMap.object({
                          encoding: mtMap.objectField(
                            'encoding',
                            mtMap.passthrough()
                          ),
                          content: mtMap.objectField(
                            'content',
                            mtMap.passthrough()
                          )
                        })
                      )
                    })
                  ),
                  receivedAt: mtMap.objectField('received_at', mtMap.date())
                })
              )
            })
          ),
          occurredAt: mtMap.objectField('occurred_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
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

export type DashboardInstanceCallbackEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  callbackId?: string | string[] | undefined;
  callbackInstanceId?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  integrationProviderId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerTriggerKey?: string | string[] | undefined;
  status?:
    | 'pending'
    | 'processed'
    | 'failed'
    | ('pending' | 'processed' | 'failed')[]
    | undefined;
  source?: 'webhook' | 'polling' | ('webhook' | 'polling')[] | undefined;
  occurredAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceCallbackEventsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      callbackId: mtMap.objectField(
        'callback_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      callbackInstanceId: mtMap.objectField(
        'callback_instance_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      integrationId: mtMap.objectField(
        'integration_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      integrationProviderId: mtMap.objectField(
        'integration_provider_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerId: mtMap.objectField(
        'provider_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerTriggerKey: mtMap.objectField(
        'provider_trigger_key',
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
      source: mtMap.objectField(
        'source',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      occurredAt: mtMap.objectField(
        'occurred_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      ),
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

