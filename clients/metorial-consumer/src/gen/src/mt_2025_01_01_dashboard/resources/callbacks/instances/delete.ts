import { mtMap } from '@metorial/util-resource-mapper';

export type CallbacksInstancesDeleteOutput = {
  object: 'callback.instance';
  id: string;
  status: 'attached' | 'detached';
  registrationStatus: 'pending' | 'registered';
  triggers: {
    object: 'callback.instance.trigger';
    id: string;
    source: string;
    pollIntervalSeconds: number | null;
    nextPollAt: Date | null;
    lastPolledAt: Date | null;
    webhookUrl: string | null;
    isWebhookRegistered: boolean;
    providerTrigger: any | null;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapCallbacksInstancesDeleteOutput =
  mtMap.object<CallbacksInstancesDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    registrationStatus: mtMap.objectField(
      'registration_status',
      mtMap.passthrough()
    ),
    triggers: mtMap.objectField(
      'triggers',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          source: mtMap.objectField('source', mtMap.passthrough()),
          pollIntervalSeconds: mtMap.objectField(
            'poll_interval_seconds',
            mtMap.passthrough()
          ),
          nextPollAt: mtMap.objectField('next_poll_at', mtMap.date()),
          lastPolledAt: mtMap.objectField('last_polled_at', mtMap.date()),
          webhookUrl: mtMap.objectField('webhook_url', mtMap.passthrough()),
          isWebhookRegistered: mtMap.objectField(
            'is_webhook_registered',
            mtMap.passthrough()
          ),
          providerTrigger: mtMap.objectField(
            'provider_trigger',
            mtMap.passthrough()
          )
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

