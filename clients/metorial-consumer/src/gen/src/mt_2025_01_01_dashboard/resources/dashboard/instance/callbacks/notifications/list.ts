import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksNotificationsListOutput = {
  items: {
    object: 'callback.notification';
    id: string;
    status: string;
    error: any | null;
    attemptCount: number;
    event: {
      object: 'callback.notification.event';
      id: string;
      type: string;
      topics: string[];
      status: string;
      destinationCount: number;
      successCount: number;
      failureCount: number;
      request: any;
      createdAt: Date;
      updatedAt: Date;
    };
    destination: {
      object: 'callback.notification.destination';
      id: string;
      name: string;
      description: string | null;
      type: string;
      eventTypes: string[];
      retry: any;
      webhook: {
        id: string;
        url: string;
        method: string;
        createdAt: Date;
      } | null;
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
    lastAttemptAt: Date | null;
    nextAttemptAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceCallbacksNotificationsListOutput =
  mtMap.object<DashboardInstanceCallbacksNotificationsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          error: mtMap.objectField('error', mtMap.passthrough()),
          attemptCount: mtMap.objectField('attempt_count', mtMap.passthrough()),
          event: mtMap.objectField(
            'event',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              topics: mtMap.objectField(
                'topics',
                mtMap.array(mtMap.passthrough())
              ),
              status: mtMap.objectField('status', mtMap.passthrough()),
              destinationCount: mtMap.objectField(
                'destination_count',
                mtMap.passthrough()
              ),
              successCount: mtMap.objectField(
                'success_count',
                mtMap.passthrough()
              ),
              failureCount: mtMap.objectField(
                'failure_count',
                mtMap.passthrough()
              ),
              request: mtMap.objectField('request', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          destination: mtMap.objectField(
            'destination',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              type: mtMap.objectField('type', mtMap.passthrough()),
              eventTypes: mtMap.objectField(
                'event_types',
                mtMap.array(mtMap.passthrough())
              ),
              retry: mtMap.objectField('retry', mtMap.passthrough()),
              webhook: mtMap.objectField(
                'webhook',
                mtMap.object({
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  url: mtMap.objectField('url', mtMap.passthrough()),
                  method: mtMap.objectField('method', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date())
                })
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          lastAttemptAt: mtMap.objectField('last_attempt_at', mtMap.date()),
          nextAttemptAt: mtMap.objectField('next_attempt_at', mtMap.date())
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

export type DashboardInstanceCallbacksNotificationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  destinationId?: string | string[] | undefined;
  status?:
    | 'pending'
    | 'failed'
    | 'delivered'
    | 'retrying'
    | ('pending' | 'failed' | 'delivered' | 'retrying')[]
    | undefined;
};

export let mapDashboardInstanceCallbacksNotificationsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      destinationId: mtMap.objectField(
        'destination_id',
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

