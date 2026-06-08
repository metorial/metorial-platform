import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProtoGuardAlertsGetOutput = {
  object: 'protoguard.alert';
  id: string;
  runId: string;
  sessionId: string | null;
  sessionMessageId: string | null;
  sessionConnectionId: string | null;
  providerRunId: string | null;
  filters: {
    object: 'protoguard.alert_filter';
    id: string;
    filterId: string;
    key: string;
    name: string;
    description: string | null;
    issueType:
      | 'instruction_override'
      | 'role_hijack'
      | 'jailbreak_persona'
      | 'prompt_exfiltration'
      | 'tool_call_forgery'
      | 'format_break'
      | 'instruction_block'
      | 'unicode_smuggling'
      | 'encoded_payload'
      | 'typoglycemia';
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number | null;
    createdAt: Date;
  }[];
  createdAt: Date;
};

export let mapDashboardInstanceProtoGuardAlertsGetOutput =
  mtMap.object<DashboardInstanceProtoGuardAlertsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    runId: mtMap.objectField('run_id', mtMap.passthrough()),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    sessionMessageId: mtMap.objectField(
      'session_message_id',
      mtMap.passthrough()
    ),
    sessionConnectionId: mtMap.objectField(
      'session_connection_id',
      mtMap.passthrough()
    ),
    providerRunId: mtMap.objectField('provider_run_id', mtMap.passthrough()),
    filters: mtMap.objectField(
      'filters',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          filterId: mtMap.objectField('filter_id', mtMap.passthrough()),
          key: mtMap.objectField('key', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          issueType: mtMap.objectField('issue_type', mtMap.passthrough()),
          severity: mtMap.objectField('severity', mtMap.passthrough()),
          confidence: mtMap.objectField('confidence', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

