import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderInvocationsListOutput = {
  object: 'provider.invocations';
  items: {
    object: 'provider.invocation';
    id: string;
    source: 'slates' | 'shuttle' | 'native';
    type: 'tool_call' | 'auth_config_event' | 'oauth_setup' | 'unknown';
    status: 'success' | 'error';
    providerRunIds: string[];
    sessionMessageIds: string[];
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

export let mapDashboardInstanceProviderInvocationsListOutput =
  mtMap.object<DashboardInstanceProviderInvocationsListOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          source: mtMap.objectField('source', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          providerRunIds: mtMap.objectField(
            'provider_run_ids',
            mtMap.array(mtMap.passthrough())
          ),
          sessionMessageIds: mtMap.objectField(
            'session_message_ids',
            mtMap.array(mtMap.passthrough())
          ),
          authConfigEventIds: mtMap.objectField(
            'auth_config_event_ids',
            mtMap.array(mtMap.passthrough())
          ),
          providerOauthSetupIds: mtMap.objectField(
            'provider_oauth_setup_ids',
            mtMap.array(mtMap.passthrough())
          ),
          toolCallId: mtMap.objectField('tool_call_id', mtMap.passthrough()),
          action: mtMap.objectField(
            'action',
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              key: mtMap.objectField('key', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough())
            })
          ),
          requests: mtMap.objectField(
            'requests',
            mtMap.array(mtMap.passthrough())
          ),
          responses: mtMap.objectField(
            'responses',
            mtMap.array(mtMap.passthrough())
          ),
          requestTraces: mtMap.objectField(
            'request_traces',
            mtMap.array(mtMap.passthrough())
          ),
          logs: mtMap.objectField(
            'logs',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                timestamp: mtMap.objectField('timestamp', mtMap.date()),
                message: mtMap.objectField('message', mtMap.passthrough()),
                outputType: mtMap.objectField(
                  'output_type',
                  mtMap.passthrough()
                )
              })
            )
          ),
          attachments: mtMap.objectField(
            'attachments',
            mtMap.array(mtMap.passthrough())
          ),
          error: mtMap.objectField(
            'error',
            mtMap.object({
              code: mtMap.objectField('code', mtMap.passthrough()),
              message: mtMap.objectField('message', mtMap.passthrough())
            })
          ),
          provider: mtMap.objectField('provider', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    )
  });

export type DashboardInstanceProviderInvocationsListQuery = {
  providerRunId?: string | string[] | undefined;
  sessionMessageId?: string | string[] | undefined;
  authConfigEventId?: string | string[] | undefined;
};

export let mapDashboardInstanceProviderInvocationsListQuery =
  mtMap.object<DashboardInstanceProviderInvocationsListQuery>({
    providerRunId: mtMap.objectField(
      'provider_run_id',
      mtMap.union([
        mtMap.unionOption('string', mtMap.passthrough()),
        mtMap.unionOption(
          'array',
          mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
        )
      ])
    ),
    sessionMessageId: mtMap.objectField(
      'session_message_id',
      mtMap.union([
        mtMap.unionOption('string', mtMap.passthrough()),
        mtMap.unionOption(
          'array',
          mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
        )
      ])
    ),
    authConfigEventId: mtMap.objectField(
      'auth_config_event_id',
      mtMap.union([
        mtMap.unionOption('string', mtMap.passthrough()),
        mtMap.unionOption(
          'array',
          mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
        )
      ])
    )
  });

