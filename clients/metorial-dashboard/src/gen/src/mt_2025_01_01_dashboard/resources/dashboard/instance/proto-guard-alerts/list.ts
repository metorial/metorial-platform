import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProtoGuardAlertsListOutput = {
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

export let mapDashboardInstanceProtoGuardAlertsListOutput =
  mtMap.object<DashboardInstanceProtoGuardAlertsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
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
          providerRunId: mtMap.objectField(
            'provider_run_id',
            mtMap.passthrough()
          ),
          filters: mtMap.objectField(
            'filters',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                filterId: mtMap.objectField('filter_id', mtMap.passthrough()),
                key: mtMap.objectField('key', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                issueType: mtMap.objectField('issue_type', mtMap.passthrough()),
                severity: mtMap.objectField('severity', mtMap.passthrough()),
                confidence: mtMap.objectField(
                  'confidence',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date())
              })
            )
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardInstanceProtoGuardAlertsListQuery = {
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

export let mapDashboardInstanceProtoGuardAlertsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      id: mtMap.objectField(
        'id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      runId: mtMap.objectField(
        'run_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      filterId: mtMap.objectField(
        'filter_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionId: mtMap.objectField(
        'session_id',
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
      sessionConnectionId: mtMap.objectField(
        'session_connection_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
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
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

