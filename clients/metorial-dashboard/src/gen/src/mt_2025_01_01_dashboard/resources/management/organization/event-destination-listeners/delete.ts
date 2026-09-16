import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationEventDestinationListenersDeleteOutput = {
  object: 'event.destination_listener';
  id: string;
  instanceId: string;
  eventDestinationId: string;
  type: 'event' | 'callback' | 'chat';
  eventTypes: string[] | null;
  callbackId: string | null;
  triggers: string[] | null;
  chatConnectionId: string | null;
  providerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationEventDestinationListenersDeleteOutput =
  mtMap.object<ManagementOrganizationEventDestinationListenersDeleteOutput>({
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
    triggers: mtMap.objectField('triggers', mtMap.array(mtMap.passthrough())),
    chatConnectionId: mtMap.objectField(
      'chat_connection_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

