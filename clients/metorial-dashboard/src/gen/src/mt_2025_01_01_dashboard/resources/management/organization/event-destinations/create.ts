import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationEventDestinationsCreateOutput = {
  object: 'event.destination';
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  type: 'webhook';
  webhook: { url: string; method: 'POST'; signingSecret: string | null } | null;
  listeners: {
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
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export let mapManagementOrganizationEventDestinationsCreateOutput =
  mtMap.object<ManagementOrganizationEventDestinationsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    webhook: mtMap.objectField(
      'webhook',
      mtMap.object({
        url: mtMap.objectField('url', mtMap.passthrough()),
        method: mtMap.objectField('method', mtMap.passthrough()),
        signingSecret: mtMap.objectField('signing_secret', mtMap.passthrough())
      })
    ),
    listeners: mtMap.objectField(
      'listeners',
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
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    archivedAt: mtMap.objectField('archived_at', mtMap.date())
  });

export type ManagementOrganizationEventDestinationsCreateBody = {
  name: string;
  description?: string | undefined;
  type: 'webhook';
  webhook: { url: string };
};

export let mapManagementOrganizationEventDestinationsCreateBody =
  mtMap.object<ManagementOrganizationEventDestinationsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    webhook: mtMap.objectField(
      'webhook',
      mtMap.object({ url: mtMap.objectField('url', mtMap.passthrough()) })
    )
  });

