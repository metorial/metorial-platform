import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceWebhooksEventsGetOutput = {
  object: 'webhook.event';
  id: string;
  type: string;
  topics: string[];
  status: 'pending' | 'delivered' | 'failed';
  request: {
    body: string;
    headers: { key: string; value: string }[] | null;
  } | null;
  deliveryDestinationCount: number | null;
  deliverySuccessCount: number;
  deliveryFailureCount: number;
  source: {
    type: 'callback';
    callbackId: string;
    callbackInstanceId: string | null;
    callbackTriggerId: string | null;
  };
  deliveries:
    | {
        object: 'webhook.event.delivery';
        id: string;
        status: 'pending' | 'delivered' | 'retrying' | 'failed';
        error: { code: string; message: string } | null;
        attemptCount: number;
        destination: {
          object: 'webhook.destination.preview';
          id: string;
          name: string;
          url: string;
        } | null;
        attempts: {
          object: 'webhook.event.delivery.attempt';
          id: string;
          status: 'succeeded' | 'failed';
          attemptNumber: number;
          durationMs: number;
          error: { code: string; message: string } | null;
          response: { statusCode: number } | null;
          createdAt: Date;
        }[];
        lastAttemptAt: Date | null;
        nextAttemptAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }[]
    | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceWebhooksEventsGetOutput =
  mtMap.object<DashboardInstanceWebhooksEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    topics: mtMap.objectField('topics', mtMap.array(mtMap.passthrough())),
    status: mtMap.objectField('status', mtMap.passthrough()),
    request: mtMap.objectField(
      'request',
      mtMap.object({
        body: mtMap.objectField('body', mtMap.passthrough()),
        headers: mtMap.objectField(
          'headers',
          mtMap.array(
            mtMap.object({
              key: mtMap.objectField('key', mtMap.passthrough()),
              value: mtMap.objectField('value', mtMap.passthrough())
            })
          )
        )
      })
    ),
    deliveryDestinationCount: mtMap.objectField(
      'delivery_destination_count',
      mtMap.passthrough()
    ),
    deliverySuccessCount: mtMap.objectField(
      'delivery_success_count',
      mtMap.passthrough()
    ),
    deliveryFailureCount: mtMap.objectField(
      'delivery_failure_count',
      mtMap.passthrough()
    ),
    source: mtMap.objectField(
      'source',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        callbackId: mtMap.objectField('callback_id', mtMap.passthrough()),
        callbackInstanceId: mtMap.objectField(
          'callback_instance_id',
          mtMap.passthrough()
        ),
        callbackTriggerId: mtMap.objectField(
          'callback_trigger_id',
          mtMap.passthrough()
        )
      })
    ),
    deliveries: mtMap.objectField(
      'deliveries',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          error: mtMap.objectField(
            'error',
            mtMap.object({
              code: mtMap.objectField('code', mtMap.passthrough()),
              message: mtMap.objectField('message', mtMap.passthrough())
            })
          ),
          attemptCount: mtMap.objectField('attempt_count', mtMap.passthrough()),
          destination: mtMap.objectField(
            'destination',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              url: mtMap.objectField('url', mtMap.passthrough())
            })
          ),
          attempts: mtMap.objectField(
            'attempts',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                attemptNumber: mtMap.objectField(
                  'attempt_number',
                  mtMap.passthrough()
                ),
                durationMs: mtMap.objectField(
                  'duration_ms',
                  mtMap.passthrough()
                ),
                error: mtMap.objectField(
                  'error',
                  mtMap.object({
                    code: mtMap.objectField('code', mtMap.passthrough()),
                    message: mtMap.objectField('message', mtMap.passthrough())
                  })
                ),
                response: mtMap.objectField(
                  'response',
                  mtMap.object({
                    statusCode: mtMap.objectField(
                      'status_code',
                      mtMap.passthrough()
                    )
                  })
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date())
              })
            )
          ),
          lastAttemptAt: mtMap.objectField('last_attempt_at', mtMap.date()),
          nextAttemptAt: mtMap.objectField('next_attempt_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

