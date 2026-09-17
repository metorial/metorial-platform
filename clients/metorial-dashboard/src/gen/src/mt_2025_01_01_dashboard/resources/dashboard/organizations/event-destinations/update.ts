import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsEventDestinationsUpdateOutput = {
  object: 'event.destination';
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  type: 'webhook';
  webhook: { url: string; method: 'POST'; signingSecret: string | null } | null;
  retry: {
    strategy: 'exponential' | 'linear' | 'fixed';
    maxAttempts: number;
    baseDelaySeconds: number;
    maxDelaySeconds: number;
  };
  listeners: {
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
  }[];
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export let mapDashboardOrganizationsEventDestinationsUpdateOutput =
  mtMap.object<DashboardOrganizationsEventDestinationsUpdateOutput>({
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
    retry: mtMap.objectField(
      'retry',
      mtMap.object({
        strategy: mtMap.objectField('strategy', mtMap.passthrough()),
        maxAttempts: mtMap.objectField('max_attempts', mtMap.passthrough()),
        baseDelaySeconds: mtMap.objectField(
          'base_delay_seconds',
          mtMap.passthrough()
        ),
        maxDelaySeconds: mtMap.objectField(
          'max_delay_seconds',
          mtMap.passthrough()
        )
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
          chatConnectionId: mtMap.objectField(
            'chat_connection_id',
            mtMap.passthrough()
          ),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    archivedAt: mtMap.objectField('archived_at', mtMap.date())
  });

export type DashboardOrganizationsEventDestinationsUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  webhook?: { url?: string | undefined } | undefined;
  retry?:
    | {
        strategy?: 'exponential' | 'linear' | 'fixed' | undefined;
        maxAttempts?: number | undefined;
        baseDelaySeconds?: number | undefined;
        maxDelaySeconds?: number | undefined;
      }
    | undefined;
};

export let mapDashboardOrganizationsEventDestinationsUpdateBody =
  mtMap.object<DashboardOrganizationsEventDestinationsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    webhook: mtMap.objectField(
      'webhook',
      mtMap.object({ url: mtMap.objectField('url', mtMap.passthrough()) })
    ),
    retry: mtMap.objectField(
      'retry',
      mtMap.object({
        strategy: mtMap.objectField('strategy', mtMap.passthrough()),
        maxAttempts: mtMap.objectField('max_attempts', mtMap.passthrough()),
        baseDelaySeconds: mtMap.objectField(
          'base_delay_seconds',
          mtMap.passthrough()
        ),
        maxDelaySeconds: mtMap.objectField(
          'max_delay_seconds',
          mtMap.passthrough()
        )
      })
    )
  });

