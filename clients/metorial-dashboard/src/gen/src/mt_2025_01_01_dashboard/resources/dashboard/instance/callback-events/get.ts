import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbackEventsGetOutput = {
  object: 'callback_event';
  id: string;
  status: 'pending' | 'processed' | 'failed';
  source: 'webhook' | 'polling';
  providerTriggerKey: string;
  mappedType: string | null;
  mappedId: string | null;
  callbackId: string;
  callbackInstanceId: string;
  details: {
    object: 'callback_event.details';
    status: string;
    payload: Record<string, any> | null;
    error: {
      object: 'callback_event.details.error';
      code: string;
      message: string;
    } | null;
    webhook: {
      object: 'callback_event.details.webhook';
      status: string;
      request: {
        object: 'callback_event.details.webhook.request';
        method: string;
        url: string;
        headers: Record<string, string>;
        body: { encoding: 'base64'; content: string } | null;
      } | null;
      receivedAt: Date;
    } | null;
  } | null;
  occurredAt: Date;
  createdAt: Date;
};

export let mapDashboardInstanceCallbackEventsGetOutput =
  mtMap.object<DashboardInstanceCallbackEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    source: mtMap.objectField('source', mtMap.passthrough()),
    providerTriggerKey: mtMap.objectField(
      'provider_trigger_key',
      mtMap.passthrough()
    ),
    mappedType: mtMap.objectField('mapped_type', mtMap.passthrough()),
    mappedId: mtMap.objectField('mapped_id', mtMap.passthrough()),
    callbackId: mtMap.objectField('callback_id', mtMap.passthrough()),
    callbackInstanceId: mtMap.objectField(
      'callback_instance_id',
      mtMap.passthrough()
    ),
    details: mtMap.objectField(
      'details',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        payload: mtMap.objectField('payload', mtMap.passthrough()),
        error: mtMap.objectField(
          'error',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            code: mtMap.objectField('code', mtMap.passthrough()),
            message: mtMap.objectField('message', mtMap.passthrough())
          })
        ),
        webhook: mtMap.objectField(
          'webhook',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            status: mtMap.objectField('status', mtMap.passthrough()),
            request: mtMap.objectField(
              'request',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                method: mtMap.objectField('method', mtMap.passthrough()),
                url: mtMap.objectField('url', mtMap.passthrough()),
                headers: mtMap.objectField('headers', mtMap.passthrough()),
                body: mtMap.objectField(
                  'body',
                  mtMap.object({
                    encoding: mtMap.objectField(
                      'encoding',
                      mtMap.passthrough()
                    ),
                    content: mtMap.objectField('content', mtMap.passthrough())
                  })
                )
              })
            ),
            receivedAt: mtMap.objectField('received_at', mtMap.date())
          })
        )
      })
    ),
    occurredAt: mtMap.objectField('occurred_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

