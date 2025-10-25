import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksDestinationsListOutput = {
  items: {
    object: 'callback.destination';
    id: string;
    type: 'webhook';
    name: string;
    description: string;
    webhookDestination: { url: string; signingSecret: string } | null;
    callbacks: { type: 'all' } | { type: 'selected'; callbackIds: string[] };
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceCallbacksDestinationsListOutput =
  mtMap.object<DashboardInstanceCallbacksDestinationsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          webhookDestination: mtMap.objectField(
            'webhook_destination',
            mtMap.object({
              url: mtMap.objectField('url', mtMap.passthrough()),
              signingSecret: mtMap.objectField(
                'signing_secret',
                mtMap.passthrough()
              )
            })
          ),
          callbacks: mtMap.objectField(
            'callbacks',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  callbackIds: mtMap.objectField(
                    'callback_ids',
                    mtMap.array(mtMap.passthrough())
                  )
                })
              )
            ])
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

export type DashboardInstanceCallbacksDestinationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { callbackId?: string | string[] | undefined };

export let mapDashboardInstanceCallbacksDestinationsListQuery = mtMap.union([
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

