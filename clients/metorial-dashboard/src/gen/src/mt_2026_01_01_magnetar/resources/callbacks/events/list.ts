import { mtMap } from '@metorial/util-resource-mapper';

export type CallbacksEventsListOutput = {
  items: {
    object: 'callback.event';
    id: string;
    type: string;
    sourceId: string;
    triggerKey: string;
    input: Record<string, any>;
    output: Record<string, any>;
    deliveryStatus: 'pending' | 'sent' | 'failed' | 'skipped';
    callbackId: string;
    callbackInstanceId: string | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapCallbacksEventsListOutput =
  mtMap.object<CallbacksEventsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          sourceId: mtMap.objectField('source_id', mtMap.passthrough()),
          triggerKey: mtMap.objectField('trigger_key', mtMap.passthrough()),
          input: mtMap.objectField('input', mtMap.passthrough()),
          output: mtMap.objectField('output', mtMap.passthrough()),
          deliveryStatus: mtMap.objectField(
            'delivery_status',
            mtMap.passthrough()
          ),
          callbackId: mtMap.objectField('callback_id', mtMap.passthrough()),
          callbackInstanceId: mtMap.objectField(
            'callback_instance_id',
            mtMap.passthrough()
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

export type CallbacksEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  type?: string | string[] | undefined;
  sourceId?: string | string[] | undefined;
};

export let mapCallbacksEventsListQuery = mtMap.union([
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
      type: mtMap.objectField(
        'type',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sourceId: mtMap.objectField(
        'source_id',
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

