import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksNotificationsGetOutput = {
  object: 'callback.notification';
  id: string;
  type: 'webhook_http';
  status: 'pending' | 'succeeded' | 'retrying' | 'failed';
  url: string | null;
  attempts: {
    object: 'callback.notification.attempt';
    id: string;
    status: 'succeeded' | 'failed';
    index: number;
    webhookRequest: {
      object: 'callback.notification.attempt.webhook_request';
      id: string;
      url: string;
      requestMethod: 'POST';
      requestBody: string;
      requestHeaders: Record<string, string>;
      responseStatus: number;
      responseBody: string;
      responseHeaders: Record<string, string>;
      requestError: string | null;
      duration: number;
      createdAt: Date;
    } | null;
    createdAt: Date;
  }[];
  createdAt: Date;
};

export let mapDashboardInstanceCallbacksNotificationsGetOutput =
  mtMap.object<DashboardInstanceCallbacksNotificationsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    attempts: mtMap.objectField(
      'attempts',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          index: mtMap.objectField('index', mtMap.passthrough()),
          webhookRequest: mtMap.objectField(
            'webhook_request',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              url: mtMap.objectField('url', mtMap.passthrough()),
              requestMethod: mtMap.objectField(
                'request_method',
                mtMap.passthrough()
              ),
              requestBody: mtMap.objectField(
                'request_body',
                mtMap.passthrough()
              ),
              requestHeaders: mtMap.objectField(
                'request_headers',
                mtMap.passthrough()
              ),
              responseStatus: mtMap.objectField(
                'response_status',
                mtMap.passthrough()
              ),
              responseBody: mtMap.objectField(
                'response_body',
                mtMap.passthrough()
              ),
              responseHeaders: mtMap.objectField(
                'response_headers',
                mtMap.passthrough()
              ),
              requestError: mtMap.objectField(
                'request_error',
                mtMap.passthrough()
              ),
              duration: mtMap.objectField('duration', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

