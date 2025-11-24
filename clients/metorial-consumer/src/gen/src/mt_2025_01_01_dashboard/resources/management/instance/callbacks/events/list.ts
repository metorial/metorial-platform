import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCallbacksEventsListOutput = {
  items: {
    object: 'callback.event';
    id: string;
    type: string | null;
    status: 'pending' | 'succeeded' | 'retrying' | 'failed';
    payloadIncoming: string;
    payloadOutgoing: string | null;
    processingAttempts: {
      object: 'callback.event.attempt';
      id: string;
      status: 'succeeded' | 'failed';
      index: number;
      errorCode: string | null;
      errorMessage: string | null;
      createdAt: Date;
    }[];
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceCallbacksEventsListOutput =
  mtMap.object<ManagementInstanceCallbacksEventsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          payloadIncoming: mtMap.objectField(
            'payload_incoming',
            mtMap.passthrough()
          ),
          payloadOutgoing: mtMap.objectField(
            'payload_outgoing',
            mtMap.passthrough()
          ),
          processingAttempts: mtMap.objectField(
            'processing_attempts',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                index: mtMap.objectField('index', mtMap.passthrough()),
                errorCode: mtMap.objectField('error_code', mtMap.passthrough()),
                errorMessage: mtMap.objectField(
                  'error_message',
                  mtMap.passthrough()
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

export type ManagementInstanceCallbacksEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { callbackId?: string | string[] | undefined };

export let mapManagementInstanceCallbacksEventsListQuery = mtMap.union([
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
      )
    })
  )
]);

