import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCallbacksDeleteOutput = {
  object: 'callback';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  pollIntervalSecondsOverride: number | null;
  providerDeployment: {
    object: 'provider.deployment#preview';
    id: string;
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  destinations: {
    object: 'callback.destination';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    url: string;
    method: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  providerTriggers: {
    object: 'callback.provider_trigger';
    id: string;
    providerTriggerId: string;
    providerTriggerKey: string;
    providerTriggerName: string;
    eventTypes: string[];
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceCallbacksDeleteOutput =
  mtMap.object<ManagementInstanceCallbacksDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    pollIntervalSecondsOverride: mtMap.objectField(
      'poll_interval_seconds_override',
      mtMap.passthrough()
    ),
    providerDeployment: mtMap.objectField(
      'provider_deployment',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    destinations: mtMap.objectField(
      'destinations',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          url: mtMap.objectField('url', mtMap.passthrough()),
          method: mtMap.objectField('method', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    providerTriggers: mtMap.objectField(
      'provider_triggers',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          providerTriggerId: mtMap.objectField(
            'provider_trigger_id',
            mtMap.passthrough()
          ),
          providerTriggerKey: mtMap.objectField(
            'provider_trigger_key',
            mtMap.passthrough()
          ),
          providerTriggerName: mtMap.objectField(
            'provider_trigger_name',
            mtMap.passthrough()
          ),
          eventTypes: mtMap.objectField(
            'event_types',
            mtMap.array(mtMap.passthrough())
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

