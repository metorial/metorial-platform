import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProtoGuardAlertsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProtoGuardAlertsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProtoGuardAlertsListOutput>(
    [
      7,
      [
        1,
        [
          'run_id',
          'session_id',
          'session_message_id',
          'session_connection_id',
          'provider_run_id',
          ['filters', 0, [2, [1, ['filter_id', 'issue_type', 'created_at']]]],
          'created_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceProtoGuardAlertsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  runId?: string | string[] | undefined;
  filterId?: string | string[] | undefined;
  sessionId?: string | string[] | undefined;
  sessionMessageId?: string | string[] | undefined;
  sessionConnectionId?: string | string[] | undefined;
  providerRunId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceProtoGuardAlertsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceProtoGuardAlertsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'run_id',
            'filter_id',
            'session_id',
            'session_message_id',
            'session_connection_id',
            'provider_run_id',
            ['created_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
