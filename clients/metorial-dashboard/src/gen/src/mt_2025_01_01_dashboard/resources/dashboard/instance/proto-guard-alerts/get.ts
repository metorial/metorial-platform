import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProtoGuardAlertsGetOutput = {
  object: 'protoguard.alert';
  id: string;
  runId: string;
  sessionId: string | null;
  sessionMessageId: string | null;
  sessionConnectionId: string | null;
  providerRunId: string | null;
  issueId: string | null;
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
      | 'typoglycemia'
      | 'ascii_smuggling'
      | 'exfil_channel'
      | 'hidden_content'
      | 'cross_tool_reference'
      | 'addressed_to_agent'
      | 'secret_in_arguments'
      | 'tool_poisoning'
      | 'tool_shadowing'
      | 'tool_rug_pull'
      | 'injection_followed_by_sink';
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number | null;
    ruleKey: string | null;
    direction: 'input' | 'output' | 'session' | null;
    contentHash: string | null;
    createdAt: Date;
  }[];
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
};

export let mapDashboardInstanceProtoGuardAlertsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProtoGuardAlertsGetOutput>(
    [
      'run_id',
      'session_id',
      'session_message_id',
      'session_connection_id',
      'provider_run_id',
      'issue_id',
      [
        'filters',
        0,
        [
          2,
          [
            1,
            [
              'filter_id',
              'issue_type',
              'rule_key',
              'content_hash',
              'created_at'
            ]
          ]
        ]
      ],
      'occurrence_count',
      'first_seen_at',
      'last_seen_at',
      'created_at'
    ],
    1
  );
