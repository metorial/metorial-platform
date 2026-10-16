import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProtoGuardAlertsGetOutput = {
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

export let mapManagementInstanceProtoGuardAlertsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProtoGuardAlertsGetOutput>(
    [
      'run_id',
      'session_id',
      'session_message_id',
      'session_connection_id',
      'provider_run_id',
      ['filters', 0, [2, [1, ['filter_id', 'issue_type', 'created_at']]]],
      'created_at'
    ],
    1
  );
