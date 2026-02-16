import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCallbacksNotificationsListOutput = {
  items: {
    object: 'callback.notification';
    id: string;
    type: 'webhook_http';
    status: 'pending' | 'succeeded' | 'retrying' | 'failed';
    url: string | null;
    attempts: {
      object: 'callback.notification.attempt';
      id: string;
      status: 'succeeded' | 'failed';
      index: number;
      webhookRequest: {
        object: 'callback.notification.attempt.webhook_request';
        id: string;
        url: string;
        requestMethod: 'POST';
        requestBody: string;
        requestHeaders: Record<string, string>;
        responseStatus: number;
        responseBody: string;
        responseHeaders: Record<string, string>;
        requestError: string | null;
        duration: number;
        createdAt: Date;
      } | null;
      createdAt: Date;
    }[];
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceCallbacksNotificationsListOutput =
  mtMap.object<ManagementInstanceCallbacksNotificationsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          url: mtMap.objectField('url', mtMap.passthrough()),
          attempts: mtMap.objectField(
            'attempts',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                index: mtMap.objectField('index', mtMap.passthrough()),
                webhookRequest: mtMap.objectField(
                  'webhook_request',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    url: mtMap.objectField('url', mtMap.passthrough()),
                    requestMethod: mtMap.objectField(
                      'request_method',
                      mtMap.passthrough()
                    ),
                    requestBody: mtMap.objectField(
                      'request_body',
                      mtMap.passthrough()
                    ),
                    requestHeaders: mtMap.objectField(
                      'request_headers',
                      mtMap.passthrough()
                    ),
                    responseStatus: mtMap.objectField(
                      'response_status',
                      mtMap.passthrough()
                    ),
                    responseBody: mtMap.objectField(
                      'response_body',
                      mtMap.passthrough()
                    ),
                    responseHeaders: mtMap.objectField(
                      'response_headers',
                      mtMap.passthrough()
                    ),
                    requestError: mtMap.objectField(
                      'request_error',
                      mtMap.passthrough()
                    ),
                    duration: mtMap.objectField(
                      'duration',
                      mtMap.passthrough()
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date())
                  })
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date())
              })
            )
          ),
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

export type ManagementInstanceCallbacksNotificationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  callbackId?: string | string[] | undefined;
  eventId?: string | string[] | undefined;
  destinationId?: string | string[] | undefined;
};

export let mapManagementInstanceCallbacksNotificationsListQuery = mtMap.union([
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
      eventId: mtMap.objectField(
        'event_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      destinationId: mtMap.objectField(
        'destination_id',
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

