import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderInvocationsListOutput = {
  object: 'provider.invocations';
  items: {
    object: 'provider.invocation';
    id: string;
    source: 'slates' | 'shuttle' | 'native';
    type:
      | 'tool_call'
      | 'auth_config_event'
      | 'oauth_setup'
      | 'callback_event'
      | 'unknown';
    status: 'success' | 'error';
    providerRunIds: string[];
    sessionMessageIds: string[];
    callbackEventIds: string[];
    authConfigEventIds: string[];
    providerOauthSetupIds: string[];
    toolCallId: string | null;
    action: { id: string; key: string; name: string } | null;
    requests: any[];
    responses: any[];
    requestTraces: any[];
    logs: {
      object: 'provider.invocation.log';
      timestamp: Date;
      message: string;
      outputType: string | null;
    }[];
    attachments: any[];
    error: { code: string; message: string } | null;
    provider: Record<string, any> | null;
    metadata: Record<string, any> | null;
    createdAt: Date;
  }[];
};

export let mapManagementInstanceProviderInvocationsListOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderInvocationsListOutput>(
    [
      [
        'items',
        0,
        [
          2,
          [
            1,
            [
              'provider_run_ids',
              'session_message_ids',
              'callback_event_ids',
              'auth_config_event_ids',
              'provider_oauth_setup_ids',
              'tool_call_id',
              'request_traces',
              ['logs', 0, [2, [1, [['timestamp', 0, 4], 'output_type']]]],
              'created_at'
            ]
          ]
        ]
      ]
    ],
    1
  );

export type ManagementInstanceProviderInvocationsListQuery = {
  providerRunId?: string | string[] | undefined;
  sessionMessageId?: string | string[] | undefined;
  chatEventId?: string | string[] | undefined;
  callbackEventId?: string | string[] | undefined;
  authConfigEventId?: string | string[] | undefined;
};

export let mapManagementInstanceProviderInvocationsListQuery =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderInvocationsListQuery>([
    'provider_run_id',
    'session_message_id',
    'chat_event_id',
    'callback_event_id',
    'auth_config_event_id'
  ]);
