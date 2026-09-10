import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationWebhookEventsListOutput = {
  items: { object: 'event.type'; name: string }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationWebhookEventsListOutput =
  mtMap.object<ManagementOrganizationWebhookEventsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough())
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

