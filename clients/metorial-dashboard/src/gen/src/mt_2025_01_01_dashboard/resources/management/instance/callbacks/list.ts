import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCallbacksListOutput = {
  items: {
    object: 'callback';
    id: string;
    url: string | null;
    type: 'webhook_managed' | 'polling' | 'webhook_manual';
    schedule: {
      object: 'callback.schedule';
      intervalSeconds: number;
      nextRunAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceCallbacksListOutput =
  mtMap.object<ManagementInstanceCallbacksListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          url: mtMap.objectField('url', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          schedule: mtMap.objectField(
            'schedule',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              intervalSeconds: mtMap.objectField(
                'interval_seconds',
                mtMap.passthrough()
              ),
              nextRunAt: mtMap.objectField('next_run_at', mtMap.date())
            })
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

export type ManagementInstanceCallbacksListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceCallbacksListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

