import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceIncomingWebhooksListOutput = {
  items: {
    object: 'incoming_webhook';
    id: string;
    status: string;
    attemptCount: number;
    webhookRegistrationId: string | null;
    providerId: string;
    receivedAt: Date;
    details: {
      object: 'incoming_webhook.details';
      method: string;
      url: string;
      headers: Record<string, string>;
      body: { encoding: 'base64'; content: string } | null;
    } | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceIncomingWebhooksListOutput =
  mtMap.object<ManagementInstanceIncomingWebhooksListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          attemptCount: mtMap.objectField('attempt_count', mtMap.passthrough()),
          webhookRegistrationId: mtMap.objectField(
            'webhook_registration_id',
            mtMap.passthrough()
          ),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          receivedAt: mtMap.objectField('received_at', mtMap.date()),
          details: mtMap.objectField(
            'details',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              method: mtMap.objectField('method', mtMap.passthrough()),
              url: mtMap.objectField('url', mtMap.passthrough()),
              headers: mtMap.objectField('headers', mtMap.passthrough()),
              body: mtMap.objectField(
                'body',
                mtMap.object({
                  encoding: mtMap.objectField('encoding', mtMap.passthrough()),
                  content: mtMap.objectField('content', mtMap.passthrough())
                })
              )
            })
          )
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

export type ManagementInstanceIncomingWebhooksListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  webhookRegistrationId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  status?:
    | 'pending'
    | 'failed_retrying'
    | 'failed_final'
    | 'succeeded'
    | ('pending' | 'failed_retrying' | 'failed_final' | 'succeeded')[]
    | undefined;
};

export let mapManagementInstanceIncomingWebhooksListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      webhookRegistrationId: mtMap.objectField(
        'webhook_registration_id',
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
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

