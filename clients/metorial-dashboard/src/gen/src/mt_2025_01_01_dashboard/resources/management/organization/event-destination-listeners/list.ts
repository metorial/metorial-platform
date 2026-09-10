import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationEventDestinationListenersListOutput = {
  items: {
    object: 'event.destination_listener';
    id: string;
    instanceId: string;
    eventDestinationId: string;
    type: 'event' | 'callback';
    eventTypes: string[] | null;
    callbackId: string | null;
    triggers: string[] | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationEventDestinationListenersListOutput =
  mtMap.object<ManagementOrganizationEventDestinationListenersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
          eventDestinationId: mtMap.objectField(
            'event_destination_id',
            mtMap.passthrough()
          ),
          type: mtMap.objectField('type', mtMap.passthrough()),
          eventTypes: mtMap.objectField(
            'event_types',
            mtMap.array(mtMap.passthrough())
          ),
          callbackId: mtMap.objectField('callback_id', mtMap.passthrough()),
          triggers: mtMap.objectField(
            'triggers',
            mtMap.array(mtMap.passthrough())
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

export type ManagementOrganizationEventDestinationListenersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  eventDestinationId?: string | string[] | undefined;
  instanceId?: string | string[] | undefined;
  callbackId?: string | string[] | undefined;
  type?: 'event' | 'callback' | ('event' | 'callback')[] | undefined;
};

export let mapManagementOrganizationEventDestinationListenersListQuery =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        limit: mtMap.objectField('limit', mtMap.passthrough()),
        after: mtMap.objectField('after', mtMap.passthrough()),
        before: mtMap.objectField('before', mtMap.passthrough()),
        cursor: mtMap.objectField('cursor', mtMap.passthrough()),
        order: mtMap.objectField('order', mtMap.passthrough()),
        eventDestinationId: mtMap.objectField(
          'event_destination_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        instanceId: mtMap.objectField(
          'instance_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
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
        type: mtMap.objectField(
          'type',
          mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
        )
      })
    )
  ]);

