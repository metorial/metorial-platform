import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderInvocationsGetOutput = {
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
};

export let mapDashboardInstanceProviderInvocationsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderInvocationsGetOutput>(
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
    ],
    1
  );
