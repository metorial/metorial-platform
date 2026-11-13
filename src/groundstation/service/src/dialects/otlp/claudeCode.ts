import type { ContentInput } from '../../content/engine';
import type { OtlpLogRecord, OtlpSpan } from '../../otlp/model';
import type { RecordDraft } from '../../records/draft';
import { readFields, withCoerced, type FieldReader } from '../fields';
import { measurementDraft } from '../measure';
import { classifyTool } from '../tools';
import { dateFromNanos, dateFromValue, firstDate } from '../time';
import type { Mapped, OtlpDialect, OtlpGroupContext } from '../types';
import {
  buildUsage,
  errorFromStatus,
  nativeLabel,
  normalizeEffort,
  normalizeSpeed,
  own,
  usdCost,
  type Decision
} from '../values';
import {
  clientVersionOf,
  otlpSource,
  safeNativeName,
  stripPrefix,
  surfaceFromLabel,
  terminalOf,
  traceOf
} from './common';

export let claudeCodeOtlpId = 'claude-code.otlp.v1';

let adapter = 'claude-code';
let eventPrefix = 'claude_code.';
let scopePrefix = 'com.anthropic.claude_code';

let serviceNames = new Set(['claude-code', 'claude-code-desktop', 'cowork', 'claude-desktop']);

let desktopServices = new Set(['claude-code-desktop', 'cowork', 'claude-desktop']);

let sessionFacts = (fields: FieldReader) => ({
  sessionId: fields.str('session.id'),
  turnId: fields.str('prompt.id')
});

// Claude Code's user.id is an anonymous per-install id; the account is user.account_uuid.
let actorFrom = (
  fields: FieldReader,
  resource: FieldReader
): RecordDraft['actor'] | undefined => {
  let pick = (key: string) => fields.str(key) ?? resource.str(key);

  let installId = pick('user.id');
  let account = pick('user.account_uuid');
  let email = pick('user.email');
  let org = pick('organization.id');

  if (!installId && !account && !email && !org) return undefined;

  let claimed = ['user.id', 'user.account_uuid', 'user.email', 'organization.id'].some(key =>
    fields.str(key)
  );

  return {
    ...(installId ? { install_id: installId } : {}),
    ...(account || email
      ? { user: { ...(account ? { id: account } : {}), ...(email ? { email } : {}) } }
      : {}),
    ...(org ? { org_claim: org } : {}),
    identity_source: claimed ? 'client_claim' : 'resource_attribute'
  };
};

let surfaceOf = (context: OtlpGroupContext, fields: FieldReader) =>
  surfaceFromLabel(fields.str('app.entrypoint', 'entrypoint')) ??
  (context.serviceName && desktopServices.has(context.serviceName) ? 'desktop' : undefined);

let clientOf = (context: OtlpGroupContext, fields: FieldReader): RecordDraft['client'] => {
  let surface = surfaceOf(context, fields);
  let version = clientVersionOf(context.resourceFields, fields);
  let terminal = terminalOf(fields);

  return {
    family: 'claude-code',
    ...(surface ? { surface } : {}),
    ...(version ? { version } : {}),
    ...(terminal ? { terminal } : {})
  };
};

let purposeOf = (querySource: string | undefined) => {
  if (!querySource) return {};

  if (querySource == 'repl_main_thread') return { purpose: 'main' };
  if (querySource == 'compact') return { purpose: 'compaction' };

  let name = nativeLabel(querySource);

  return name ? { purpose: 'subagent', agent_name: name } : {};
};

let contentFrom = (
  fields: FieldReader,
  role: ContentInput['role'],
  key: string,
  options: { clientLength?: number; hints?: ContentInput['hints'] } = {}
): ContentInput[] => {
  let value = fields.raw(key);

  if (value === undefined || value === null) return [];

  let originalLength = fields.count(`${key}_original_length`);
  let truncated = fields.bool(`${key}_truncated`);

  return [
    {
      role,
      value,
      clientLength: options.clientLength,
      ...(truncated && originalLength !== undefined
        ? { clientTruncated: { originalLength } }
        : {}),
      ...(options.hints ? { hints: options.hints } : {})
    } as ContentInput
  ];
};

let usageFrom = (fields: FieldReader) =>
  buildUsage({
    inputUncached: fields.count('input_tokens'),
    cacheRead: fields.count('cache_read_tokens'),
    cacheWrite: fields.count('cache_creation_tokens'),
    cacheWrite5m: fields.count('cache_creation_5m_tokens'),
    cacheWrite1h: fields.count('cache_creation_1h_tokens'),
    output: fields.count('output_tokens')
  });

let decisionFrom = (
  decision: string | undefined,
  source: string | undefined
): Decision | undefined => {
  if (decision != 'accept' && decision != 'reject') return undefined;

  let value: Decision['value'] = decision == 'accept' ? 'allow' : 'deny';

  switch (source) {
    case 'config':
      return { value, source: 'config', scope: 'none', automatic: true };
    case 'hook':
      return { value, source: 'hook', scope: 'none', automatic: true };
    case 'user_permanent':
      return { value, source: 'user', scope: 'persistent', automatic: false };
    case 'user_temporary':
      return { value, source: 'user', scope: 'session', automatic: false };
    case 'user_abort':
      return { value: 'abort', source: 'user', scope: 'once', automatic: false };
    case 'user_reject':
      return { value: 'deny', source: 'user', scope: 'once', automatic: false };
    default:
      return { value, source: 'unknown', scope: 'unknown', automatic: false };
  }
};

type LogState = {
  context: OtlpGroupContext;
  log: OtlpLogRecord;
  name: string;
  fields: FieldReader;
};

let logName = (log: OtlpLogRecord, fields: FieldReader): string => {
  let fromAttribute = fields.str('event.name');
  if (fromAttribute) return stripPrefix(fromAttribute, eventPrefix);

  if (typeof log.body == 'string' && log.body.startsWith(eventPrefix)) {
    return log.body.slice(eventPrefix.length);
  }

  return log.eventName ? stripPrefix(log.eventName, eventPrefix) : '';
};

let logDraft = (
  state: LogState,
  type: string,
  extra: Partial<RecordDraft> = {}
): RecordDraft => {
  let { context, log, name, fields } = state;

  let actor = actorFrom(fields, context.resourceFields);
  let trace = traceOf({ traceId: log.traceId, spanId: log.spanId });

  let identityKey = fields.str('request_id', 'tool_use_id') ?? '';

  return {
    kind: 'event',
    type,
    identity: [
      fields.str('session.id') ?? '',
      name,
      fields.text('event.sequence') ?? '',
      String(log.timeNs),
      fields.str('prompt.id') ?? '',
      identityKey
    ].join('|'),
    signalName: safeNativeName(name),
    occurredAt: firstDate(
      dateFromNanos(log.timeNs),
      dateFromValue(fields.str('event.timestamp'))
    ),
    client: clientOf(context, fields),
    ...(actor ? { actor } : {}),
    ctx: {
      ...sessionFacts(fields),
      requestId: fields.str('request_id'),
      toolCallId: fields.str('tool_use_id'),
      ...(trace ? { trace } : {})
    },
    data: {},
    ...extra
  };
};

let withData = (draft: RecordDraft, data: Record<string, unknown>): RecordDraft => ({
  ...draft,
  data: { ...draft.data, ...data }
});

let requestFact = (fields: FieldReader) => {
  let id = fields.str('request_id');

  return id ? `req:{session_key}:${id}` : null;
};

let toolFact = (fields: FieldReader) => {
  let id = fields.str('tool_use_id');

  return id ? `tool:{session_key}:${id}` : null;
};

let toolOf = (fields: FieldReader) => {
  let name = fields.str('tool_name', 'tool_name_safe');
  if (!name) return undefined;

  let server = fields.str('mcp_server_name', 'anthropic.mcp.server.name');

  return classifyTool(name, server ? { mcpServer: server } : {});
};

let ok = <T>(value: T | undefined, key: string) =>
  value === undefined ? {} : { [key]: value };

let mapApiRequest = (state: LogState): RecordDraft => {
  let { fields } = state;

  let usage = usageFrom(fields);
  let cost = usdCost(
    { micros: fields.int('cost_usd_micros'), usd: fields.num('cost_usd') },
    'client_estimate'
  );

  let duration = fields.count('duration_ms');
  let speed = normalizeSpeed(fields.str('speed'));
  let effort = normalizeEffort(fields.str('effort'));
  let model = nativeLabel(fields.str('model'));

  return withData(
    {
      ...logDraft(state, 'model.request'),
      factKey: requestFact(fields),
      durationMs: duration,
      derived: usage.derived,
      warnings: usage.warnings
    },
    {
      outcome: 'ok',
      ...ok(model, 'model'),
      ...(usage.usage ? { usage: usage.usage } : {}),
      ...(cost ? { cost } : {}),
      ...ok(duration, 'duration_ms'),
      ...ok(speed, 'speed'),
      ...ok(effort, 'effort'),
      ...purposeOf(fields.str('query_source'))
    }
  );
};

let mapApiError = (state: LogState): RecordDraft => {
  let { fields } = state;

  let status = fields.int('status_code');
  let duration = fields.count('duration_ms');
  let model = nativeLabel(fields.str('model'));
  let attempt = fields.count('attempt');

  return withData(
    {
      ...logDraft(state, 'model.request'),
      factKey: requestFact(fields),
      durationMs: duration,
      content: contentFrom(fields, 'error_message', 'error')
    },
    {
      outcome: 'error',
      error: errorFromStatus(status, undefined, 'unknown'),
      ...ok(model, 'model'),
      ...ok(attempt, 'attempt'),
      ...ok(duration, 'duration_ms')
    }
  );
};

let mapEvent = (state: LogState): RecordDraft[] => {
  let { fields, name } = state;

  switch (name) {
    case 'api_request':
      return [mapApiRequest(state)];

    case 'api_error':
      return [mapApiError(state)];

    case 'api_retries_exhausted': {
      let attempts = fields.count('total_attempts');
      let duration = fields.count('total_retry_duration_ms');
      let status = fields.int('status_code');

      return [
        withData(
          {
            ...logDraft(state, 'model.retry'),
            content: contentFrom(fields, 'error_message', 'error')
          },
          {
            outcome: 'exhausted',
            error: errorFromStatus(status, undefined, 'unknown'),
            ...ok(attempts, 'attempts'),
            ...ok(duration, 'retry_duration_ms')
          }
        )
      ];
    }

    case 'api_refusal': {
      let model = nativeLabel(fields.str('model'));
      let category = nativeLabel(fields.str('category'));
      let attempt = fields.count('attempt');

      return [
        withData(
          { ...logDraft(state, 'model.request'), factKey: requestFact(fields) },
          {
            outcome: 'refused',
            ...ok(model, 'model'),
            ...ok(category, 'refusal_category'),
            ...ok(attempt, 'attempt')
          }
        )
      ];
    }

    case 'tool_decision': {
      let tool = toolOf(fields);
      let decision = decisionFrom(fields.str('decision'), fields.str('source'));
      let verdict = nativeLabel(fields.str('classifier_verdict'));
      let mode = nativeLabel(fields.str('permission_mode'));

      return [
        withData(
          { ...logDraft(state, 'tool.decision'), factKey: toolFact(fields) },
          {
            ...(tool ? { tool } : {}),
            ...(decision ? { decision } : {}),
            ...ok(verdict, 'classifier_verdict'),
            ...ok(mode, 'permission_mode')
          }
        )
      ];
    }

    case 'tool_result': {
      let tool = toolOf(fields);
      let success = fields.bool('success');
      let duration = fields.count('duration_ms');
      let errorType = nativeLabel(fields.str('error_type'));
      let inputBytes = fields.count('tool_input_size_bytes');
      let outputBytes = fields.count('tool_result_size_bytes');
      let decisionSource = nativeLabel(fields.str('decision_source'));

      let hints = { tool: tool?.name };

      return [
        withData(
          {
            ...logDraft(state, 'tool.call'),
            factKey: toolFact(fields),
            durationMs: duration,
            content: [
              ...contentFrom(fields, 'tool_input', 'tool_parameters', { hints }),
              ...contentFrom(fields, 'tool_input', 'tool_input', { hints }),
              ...contentFrom(fields, 'error_message', 'error')
            ]
          },
          {
            ...(tool ? { tool } : {}),
            ...(success !== undefined ? { outcome: success ? 'ok' : 'error' } : {}),
            ...(success === false
              ? { error: { class: 'tool', ...(errorType ? { native_type: errorType } : {}) } }
              : {}),
            ...ok(duration, 'duration_ms'),
            ...ok(inputBytes, 'input_bytes'),
            ...ok(outputBytes, 'output_bytes'),
            ...ok(decisionSource, 'decision_source')
          }
        )
      ];
    }

    case 'user_prompt': {
      let length = fields.count('prompt_length');
      let command = nativeLabel(fields.str('command_name'));

      return [
        withData(
          {
            ...logDraft(state, 'prompt.submitted'),
            content: contentFrom(fields, 'prompt', 'prompt', { clientLength: length })
          },
          { ...ok(length, 'length_chars'), ...ok(command, 'command_name') }
        )
      ];
    }

    case 'assistant_response': {
      let length = fields.count('response_length');
      let model = nativeLabel(fields.str('model'));

      return [
        withData(
          {
            ...logDraft(state, 'message.assistant'),
            content: contentFrom(fields, 'response', 'response', { clientLength: length })
          },
          { ...ok(length, 'length_chars'), ...ok(model, 'model') }
        )
      ];
    }

    case 'permission_mode_changed': {
      let from = nativeLabel(fields.str('from_mode'));
      let to = nativeLabel(fields.str('to_mode'));
      let trigger = nativeLabel(fields.str('trigger'));

      return [
        withData(logDraft(state, 'settings.changed'), {
          setting: 'permission_mode',
          ...ok(from, 'from'),
          ...ok(to, 'to'),
          ...ok(trigger, 'trigger')
        })
      ];
    }

    case 'auth': {
      let action = nativeLabel(fields.str('action'));
      let success = fields.bool('success');
      let method = nativeLabel(fields.str('auth_method'));
      let category = nativeLabel(fields.str('error_category'));
      let status = fields.int('status_code');

      return [
        withData(logDraft(state, 'auth.event'), {
          ...ok(action, 'action'),
          ...(success !== undefined ? { outcome: success ? 'ok' : 'error' } : {}),
          ...ok(method, 'method'),
          ...ok(category, 'error_category'),
          ...ok(status, 'status_code')
        })
      ];
    }

    case 'mcp_server_connection': {
      let status = nativeLabel(fields.str('status'));
      let transport = nativeLabel(fields.str('transport_type'));
      let scope = nativeLabel(fields.str('server_scope'));
      let duration = fields.count('duration_ms');
      let code = nativeLabel(fields.text('error_code'));
      let server = nativeLabel(fields.str('server_name'));

      return [
        withData(
          { ...logDraft(state, 'mcp.connection'), durationMs: duration },
          {
            ...ok(status, 'status'),
            ...ok(transport, 'transport'),
            ...ok(scope, 'scope'),
            ...ok(code, 'error_code'),
            ...ok(server, 'server_name'),
            ...ok(duration, 'duration_ms')
          }
        )
      ];
    }

    case 'internal_error': {
      let errorName = nativeLabel(fields.str('error_name'));
      let code = nativeLabel(fields.text('error_code'));

      return [
        withData(logDraft(state, 'client.error'), {
          error: {
            class: 'internal',
            ...(errorName ? { native_type: errorName } : {})
          },
          ...ok(code, 'error_code')
        })
      ];
    }

    case 'compaction': {
      let trigger = nativeLabel(fields.str('trigger'));
      let success = fields.bool('success');
      let duration = fields.count('duration_ms');
      let before = fields.count('pre_tokens');
      let after = fields.count('post_tokens');

      return [
        withData(
          { ...logDraft(state, 'context.compaction'), durationMs: duration },
          {
            ...ok(trigger, 'trigger'),
            ...(success !== undefined ? { outcome: success ? 'ok' : 'error' } : {}),
            ...ok(duration, 'duration_ms'),
            ...ok(before, 'tokens_before'),
            ...ok(after, 'tokens_after')
          }
        )
      ];
    }

    case 'subagent_completed': {
      let agentType = nativeLabel(fields.str('agent_type'));
      let toolUses = fields.count('total_tool_uses');
      let duration = fields.count('duration_ms');
      let model = nativeLabel(fields.str('model'));

      let usage = buildUsage({
        totalReported: fields.count('total_tokens'),
        provenance: 'aggregate'
      });

      return [
        withData(
          {
            ...logDraft(state, 'agent.end'),
            role: 'aggregate',
            durationMs: duration,
            warnings: usage.warnings
          },
          {
            status: 'completed',
            ...(agentType ? { name: agentType, type: agentType } : {}),
            ...(usage.usage ? { usage: usage.usage } : {}),
            ...ok(toolUses, 'tool_uses'),
            ...ok(duration, 'duration_ms'),
            ...ok(model, 'model')
          }
        )
      ];
    }

    case 'skill_activated': {
      let skill = nativeLabel(fields.str('skill.name'));
      let trigger = nativeLabel(fields.str('invocation_trigger'));
      let source = nativeLabel(fields.str('skill.source'));

      return [
        withData(logDraft(state, 'extension.event'), {
          kind: 'skill',
          action: 'activated',
          ...ok(skill, 'name'),
          ...ok(trigger, 'trigger'),
          ...ok(source, 'source')
        })
      ];
    }

    case 'hook_execution_complete': {
      let hookEvent = nativeLabel(fields.str('hook_event'));
      let hookName = nativeLabel(fields.str('hook_name'));
      let total = fields.count('num_hooks');
      let succeeded = fields.count('num_success');
      let blocking = fields.count('num_blocking');
      let duration = fields.count('total_duration_ms');

      return [
        withData(
          { ...logDraft(state, 'hook.run'), durationMs: duration },
          {
            ...ok(hookEvent, 'hook_event'),
            ...ok(hookName, 'hook_name'),
            ...ok(total, 'hooks'),
            ...ok(succeeded, 'succeeded'),
            ...ok(blocking, 'blocking'),
            ...ok(duration, 'duration_ms')
          }
        )
      ];
    }

    case 'plugin_installed':
    case 'plugin_loaded':
      return [
        withData(logDraft(state, 'extension.event'), {
          kind: 'plugin',
          action: name == 'plugin_installed' ? 'installed' : 'loaded'
        })
      ];

    default:
      return [
        withData(logDraft(state, 'unmapped'), {
          native_name: safeNativeName(name),
          category: 'diagnostic'
        })
      ];
  }
};

let mapLog = (context: OtlpGroupContext, log: OtlpLogRecord): Mapped[] => {
  let fields = readFields(log.attributes, 'log.');
  let name = logName(log, fields);

  let state: LogState = { context, log, name, fields };
  let source = otlpSource(adapter, claudeCodeOtlpId, 'logs');

  return withCoerced(
    mapEvent(state).map(draft => ({ source, draft })),
    fields
  );
};

let metricCatalog: Record<
  string,
  {
    type: Parameters<typeof measurementDraft>[2]['type'];
    unit: string;
    covers?: string[];
    dims: (fields: FieldReader) => Record<string, string | undefined>;
    used: string[];
  }
> = {
  'session.count': { type: 'sessions', unit: '{session}', dims: () => ({}), used: [] },

  'lines_of_code.count': {
    type: 'lines_changed',
    unit: '{line}',
    dims: fields => ({ line_op: fields.str('type') }),
    used: ['type']
  },

  'pull_request.count': { type: 'pull_requests', unit: '{pr}', dims: () => ({}), used: [] },

  'commit.count': { type: 'commits', unit: '{commit}', dims: () => ({}), used: [] },

  'cost.usage': {
    type: 'cost',
    unit: 'usd',
    covers: ['model.request'],
    dims: fields => ({ model: nativeLabel(fields.str('model')) }),
    used: ['model']
  },

  'token.usage': {
    type: 'tokens',
    unit: '{token}',
    covers: ['model.request'],
    dims: fields => ({
      model: nativeLabel(fields.str('model')),
      token_type: own(tokenTypes, fields.str('type'))
    }),
    used: ['model', 'type']
  },

  'code_edit_tool.decision': {
    type: 'tool.calls',
    unit: '{call}',
    dims: fields => {
      let decision = fields.str('decision');

      return {
        tool_name: nativeLabel(fields.str('tool_name')),
        decision: decision == 'accept' ? 'allow' : decision == 'reject' ? 'deny' : undefined
      };
    },
    used: ['tool_name', 'decision']
  },

  'active_time.total': {
    type: 'active_time',
    unit: 's',
    dims: fields => ({ type: fields.str('type') }),
    used: ['type']
  }
};

let tokenTypes: Record<string, string> = {
  input: 'input_uncached',
  output: 'output',
  cacheRead: 'cache_read',
  cacheCreation: 'cache_write'
};

let mapMetric: OtlpDialect['mapMetric'] = (context, point) => {
  let entry = own(metricCatalog, stripPrefix(point.name, eventPrefix));
  if (!entry) return [];

  let fields = readFields(point.attributes, 'metric.');

  let draft = measurementDraft(context, point, {
    type: entry.type,
    unit: entry.unit,
    covers: entry.covers,
    dims: entry.dims(fields),
    usedAttributes: entry.used,
    client: clientOf(context, fields)
  });

  if (!draft) return [];

  return withCoerced(
    [{ source: otlpSource(adapter, claudeCodeOtlpId, 'metrics'), draft }],
    fields
  );
};

let spanDuration = (span: OtlpSpan, fields: FieldReader) => {
  if (span.startNs > 0n && span.endNs >= span.startNs) {
    return Number((span.endNs - span.startNs) / 1_000_000n);
  }

  return fields.count('duration_ms');
};

let mapSpan: OtlpDialect['mapSpan'] = (context, span) => {
  let fields = readFields(span.attributes, 'span.');
  let name = stripPrefix(span.name, eventPrefix);

  let actor = actorFrom(fields, context.resourceFields);
  let duration = spanDuration(span, fields);
  let agentId = fields.str('agent_id');
  let parentAgentId = fields.str('parent_agent_id');

  let base: RecordDraft = {
    kind: 'event',
    type: 'unmapped',
    identity: `span|${span.traceId}|${span.spanId}`,
    signalName: safeNativeName(name),
    role: 'supplemental',
    occurredAt: dateFromNanos(span.startNs),
    durationMs: duration,
    client: clientOf(context, fields),
    ...(actor ? { actor } : {}),
    ctx: {
      ...sessionFacts(fields),
      requestId: fields.str('request_id'),
      toolCallId: fields.str('tool_use_id'),
      ...(agentId || parentAgentId
        ? { agent: { ...(agentId ? { id: agentId } : {}), parentId: parentAgentId } }
        : {}),
      trace: traceOf({
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId
      })
    },
    data: {},
    coerced: fields.coerced
  };

  let failed = span.statusCode == 2;
  let source = otlpSource(adapter, claudeCodeOtlpId, 'traces');
  let finish = (draft: RecordDraft): Mapped[] => withCoerced([{ source, draft }], fields);

  switch (name) {
    case 'interaction': {
      let turnId = fields.str('prompt.id');
      let length = fields.count('user_prompt_length');

      return finish(
        withData(
          {
            ...base,
            type: 'turn.completed',
            factKey: turnId ? `turn:{session_key}:${turnId}` : null
          },
          { outcome: failed ? 'error' : 'ok', ...ok(length, 'prompt_length_chars') }
        )
      );
    }

    case 'llm_request': {
      let usage = usageFrom(fields);
      let model = nativeLabel(fields.str('model'));
      let ttft = fields.count('ttft_ms');
      let status = fields.int('status_code');
      let success = fields.bool('success');
      let stop = nativeLabel(fields.str('stop_reason'));
      let attempt = fields.count('attempt');
      let speed = normalizeSpeed(fields.str('speed'));
      let effort = normalizeEffort(fields.str('effort'));
      let errored = success === false || failed;

      return finish(
        withData(
          {
            ...base,
            type: 'model.request',
            factKey: requestFact(fields),
            derived: usage.derived,
            warnings: usage.warnings
          },
          {
            outcome: errored ? 'error' : 'ok',
            ...(errored
              ? {
                  error: errorFromStatus(
                    status,
                    nativeLabel(fields.str('error_class')),
                    'unknown'
                  )
                }
              : {}),
            ...ok(model, 'model'),
            ...(usage.usage ? { usage: usage.usage } : {}),
            ...ok(ttft, 'ttft_ms'),
            ...ok(stop, 'stop_reason'),
            ...ok(attempt, 'attempt'),
            ...ok(speed, 'speed'),
            ...ok(effort, 'effort')
          }
        )
      );
    }

    case 'tool':
    case 'tool.execution': {
      let tool = toolOf(fields);
      let success = fields.bool('success');
      let errored = success === false || failed;
      let errorClass = nativeLabel(fields.str('error_class'));

      return finish(
        withData(
          { ...base, type: 'tool.call', factKey: toolFact(fields) },
          {
            ...(tool ? { tool } : {}),
            outcome: errored ? 'error' : 'ok',
            ...(errored
              ? {
                  error: { class: 'tool', ...(errorClass ? { native_type: errorClass } : {}) }
                }
              : {}),
            ...ok(duration, 'duration_ms')
          }
        )
      );
    }

    case 'tool.blocked_on_user': {
      let decision = decisionFrom(fields.str('decision'), fields.str('source'));

      return finish(
        withData(
          { ...base, type: 'tool.decision', factKey: toolFact(fields) },
          { ...(decision ? { decision } : {}), ...ok(duration, 'wait_ms') }
        )
      );
    }

    case 'hook':
      return finish(withData({ ...base, type: 'hook.run' }, ok(duration, 'duration_ms')));

    default:
      return finish(
        withData(base, { native_name: safeNativeName(name), category: 'diagnostic' })
      );
  }
};

export let claudeCodeOtlp: OtlpDialect = {
  id: claudeCodeOtlpId,
  adapter,
  client: 'claude-code',

  matches: context => {
    if (context.serviceName && serviceNames.has(context.serviceName)) return true;
    if (context.scope.name.startsWith(scopePrefix)) return true;

    return context.sampleName !== undefined && context.sampleName.startsWith(eventPrefix);
  },

  mapLog,
  mapMetric,
  mapSpan
};
