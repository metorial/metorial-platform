import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationEventsListOutput = {
  items: {
    object: 'event';
    id: string;
    organizationId: string;
    instanceId: string | null;
    source: 'resource' | 'callback';
    eventType: string;
    payload: Record<string, any> | null;
    callbackId: string | null;
    callbackTriggerKey: string | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationEventsListOutput =
  mtMap.object<ManagementOrganizationEventsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
          instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
          source: mtMap.objectField('source', mtMap.passthrough()),
          eventType: mtMap.objectField('event_type', mtMap.passthrough()),
          payload: mtMap.objectField('payload', mtMap.passthrough()),
          callbackId: mtMap.objectField('callback_id', mtMap.passthrough()),
          callbackTriggerKey: mtMap.objectField(
            'callback_trigger_key',
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

export type ManagementOrganizationEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  instanceId?: string | undefined;
  eventType?: string | string[] | undefined;
  source?: 'resource' | 'callback' | ('resource' | 'callback')[] | undefined;
  callbackId?: string | string[] | undefined;
  callbackTriggerKey?: string | string[] | undefined;
};

export let mapManagementOrganizationEventsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
      eventType: mtMap.objectField(
        'event_type',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      source: mtMap.objectField(
        'source',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
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
      callbackTriggerKey: mtMap.objectField(
        'callback_trigger_key',
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

