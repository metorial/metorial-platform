import type { ContentInput } from '../../content/engine';
import type { OtlpLogRecord } from '../../otlp/model';
import type { RecordDraft } from '../../records/draft';
import { codexBilling } from '../billing';
import { readFields, withCoerced, type FieldReader } from '../fields';
import { measurementDraft } from '../measure';
import { classifyTool } from '../tools';
import { dateFromNanos, dateFromValue, firstDate } from '../time';
import type { Mapped, OtlpDialect, OtlpGroupContext } from '../types';
import {
  buildUsage,
  errorFromStatus,
  modelRef,
  nativeLabel,
  normalizeEffort,
  normalizeProvider,
  normalizeSpeed,
  own,
  type Decision,
  usdCost
} from '../values';
import {
  actorOf,
  clientVersionOf,
  otlpSource,
  safeNativeName,
  stripPrefix,
  surfaceFromLabel,
  terminalOf,
  traceOf
} from './common';

export let codexOtlpId = 'codex.otlp.v1';

let adapter = 'codex';
let eventPrefix = 'codex.';
let scopePrefix = 'codex_otel';

let serviceNames = new Set([
  'codex_cli_rs',
  'codex_exec',
  'codex-app-server',
  'codex-exec-server'
]);

let surfaceByService: Record<string, string> = {
  codex_cli_rs: 'cli',
  codex_exec: 'cli',
  'codex-exec-server': 'cli',
  'codex-app-server': 'app_server'
};

let sessionKeys = ['conversation.id', 'session.id', 'thread.id'];

let quietSpans = new Set([
  'session_loop',
  'session_task.run',
  'run_turn',
  'codex.sampling',
  'mcp.http.request',
  'app_server.request',
  'receiving_stream'
]);

let decisionTable: Record<string, Decision> = {
  approved: { value: 'allow', source: 'unknown', scope: 'once', automatic: false },
  approved_with_amendment: {
    value: 'allow',
    source: 'unknown',
    scope: 'once',
    automatic: false
  },
  approved_for_session: {
    value: 'allow',
    source: 'unknown',
    scope: 'session',
    automatic: false
  },
  approved_mcp_policy_amendment: {
    value: 'allow',
    source: 'unknown',
    scope: 'persistent',
    automatic: false
  },
  approved_with_network_policy_allow: {
    value: 'allow',
    source: 'unknown',
    scope: 'once',
    automatic: false
  },
  denied_with_network_policy_deny: {
    value: 'deny',
    source: 'unknown',
    scope: 'once',
    automatic: false
  },
  denied: { value: 'deny', source: 'unknown', scope: 'once', automatic: false },
  timed_out: { value: 'deny', source: 'unknown', scope: 'once', automatic: true },
  abort: { value: 'abort', source: 'unknown', scope: 'once', automatic: false }
};

let decisionSources: Record<string, Decision['source']> = {
  Config: 'config',
  User: 'user',
  AutomatedReviewer: 'reviewer'
};

let tokenTypes: Record<string, { type: string; warning?: string } | null> = {
  total: null,
  input: { type: 'input', warning: 'token_type_includes_cache' },
  cached_input: { type: 'cache_read' },
  cache_write_input: { type: 'cache_write' },
  output: { type: 'output', warning: 'token_type_includes_reasoning' },
  reasoning_output: { type: 'reasoning' }
};

let sessionIdOf = (fields: FieldReader) => fields.str(...sessionKeys);

let clientOf = (context: OtlpGroupContext, fields: FieldReader): RecordDraft['client'] => {
  let surface =
    surfaceFromLabel(fields.str('originator')) ?? own(surfaceByService, context.serviceName);

  let version = clientVersionOf(context.resourceFields, fields);
  let terminal = terminalOf(fields);
  let authMode = nativeLabel(fields.str('auth_mode'));

  return {
    family: 'codex',
    ...(surface ? { surface } : {}),
    ...(version ? { version } : {}),
    ...(terminal ? { terminal } : {}),
    ...(authMode ? { auth_mode: authMode } : {})
  };
};

let ok = <T>(value: T | undefined, key: string) =>
  value === undefined ? {} : { [key]: value };

let billingOf = (fields: FieldReader) => ok(codexBilling(fields.str('auth_mode')), 'billing');

let withData = (draft: RecordDraft, data: Record<string, unknown>): RecordDraft => ({
  ...draft,
  data: { ...draft.data, ...data }
});

let contentFrom = (
  fields: FieldReader,
  role: ContentInput['role'],
  key: string,
  options: { clientLength?: number; hints?: ContentInput['hints'] } = {}
): ContentInput[] => {
  let value = fields.raw(key);

  if (value === undefined || value === null) return [];

  return [
    {
      role,
      value,
      clientLength: options.clientLength,
      ...(options.hints ? { hints: options.hints } : {})
    } as ContentInput
  ];
};

let toolFact = (fields: FieldReader) => {
  let id = fields.str('call_id', 'tool.call_id');

  return id ? `tool:{session_key}:${id}` : null;
};

let turnFact = (fields: FieldReader) => {
  let id = fields.str('turn.id', 'turn_id');

  return id ? `turn:{session_key}:${id}` : null;
};

let toolOf = (fields: FieldReader) => {
  let name = fields.str('tool_name', 'tool.name');
  if (!name) return undefined;

  let server = fields.str('mcp_server', 'mcp.server.name');

  return classifyTool(name, server ? { mcpServer: server } : {});
};

let usageFromSse = (fields: FieldReader) =>
  buildUsage({
    inputIncludingCache: fields.count('input_token_count'),
    cacheRead: fields.count('cached_token_count'),
    cacheWrite: fields.count('cache_write_token_count'),
    outputIncludingReasoning: fields.count('output_token_count'),
    reasoning: fields.count('reasoning_token_count'),
    totalReported: fields.count('tool_token_count')
  });

type LogState = {
  context: OtlpGroupContext;
  log: OtlpLogRecord;
  name: string;
  fields: FieldReader;
};

let logName = (log: OtlpLogRecord, fields: FieldReader) => {
  let raw = fields.str('event.name') ?? (log.eventName || undefined);

  return raw ? stripPrefix(raw, eventPrefix) : '';
};

let logDraft = (
  state: LogState,
  type: string,
  extra: Partial<RecordDraft> = {}
): RecordDraft => {
  let { context, log, name, fields } = state;

  let actor = actorOf(fields, context.resourceFields);
  let trace = traceOf({ traceId: log.traceId, spanId: log.spanId });

  return {
    kind: 'event',
    type,
    identity: [
      sessionIdOf(fields) ?? '',
      name,
      String(log.timeNs),
      fields.str('turn.id', 'turn_id') ?? '',
      fields.str('call_id') ?? '',
      fields.str('event.kind') ?? ''
    ].join('|'),
    signalName: safeNativeName(name),
    occurredAt: firstDate(
      dateFromNanos(log.timeNs),
      dateFromValue(fields.str('event.timestamp'))
    ),
    client: clientOf(context, fields),
    ...(actor ? { actor } : {}),
    ctx: {
      sessionId: sessionIdOf(fields),
      parentSessionId: fields.str('parent.conversation.id'),
      turnId: fields.str('turn.id', 'turn_id'),
      toolCallId: fields.str('call_id'),
      ...(trace ? { trace } : {})
    },
    data: {},
    coerced: fields.coerced,
    ...extra
  };
};

let diagnostic = (state: LogState): RecordDraft =>
  withData(logDraft(state, 'unmapped'), {
    native_name: safeNativeName(state.name),
    category: 'diagnostic'
  });

let mapEvent = (state: LogState): RecordDraft[] => {
  let { fields, name } = state;

  switch (name) {
    case 'conversation_starts': {
      let provider = normalizeProvider(fields.str('provider_name'));
      let effort = normalizeEffort(fields.str('reasoning_effort'));
      let model = nativeLabel(fields.str('model', 'slug'));
      let window = fields.count('context_window');
      let approval = nativeLabel(fields.str('approval_policy'));
      let sandbox = nativeLabel(fields.str('sandbox_policy'));

      return [
        withData(logDraft(state, 'session.start'), {
          ...ok(model, 'model'),
          ...ok(provider, 'provider'),
          ...ok(effort, 'effort'),
          ...ok(window, 'context_window'),
          ...ok(approval, 'approval_policy'),
          ...ok(sandbox, 'sandbox_policy')
        })
      ];
    }

    case 'api_request': {
      let status = fields.int('http.response.status_code');
      let duration = fields.count('duration_ms');
      let attempt = fields.count('attempt');
      let failed = status !== undefined && status >= 400;

      return [
        withData(
          {
            ...logDraft(state, 'model.request'),
            role: 'supplemental',
            durationMs: duration,
            content: contentFrom(fields, 'error_message', 'error.message')
          },
          {
            ...(status !== undefined ? { outcome: failed ? 'error' : 'ok' } : {}),
            ...(failed ? { error: errorFromStatus(status, undefined, 'unknown') } : {}),
            ...billingOf(fields),
            ...ok(attempt, 'attempt'),
            ...ok(duration, 'duration_ms')
          }
        )
      ];
    }

    case 'sse_event': {
      if (fields.str('event.kind') != 'response.completed') return [];

      let usage = usageFromSse(state.fields);
      let ttft = fields.count('ttft_ms');
      let tier = nativeLabel(fields.str('service_tier'));
      let effort = normalizeEffort(fields.str('model_reasoning_effort'));
      let model = nativeLabel(fields.str('model', 'slug'));

      return [
        withData(
          {
            ...logDraft(state, 'model.request'),
            derived: usage.derived,
            warnings: usage.warnings
          },
          {
            outcome: 'ok',
            ...modelRef(model),
            ...billingOf(fields),
            ...(usage.usage ? { usage: usage.usage } : {}),
            ...ok(ttft, 'ttft_ms'),
            ...ok(tier, 'service_tier'),
            ...ok(effort, 'effort')
          }
        )
      ];
    }

    case 'user_prompt': {
      let length = fields.count('prompt_length');

      return [
        withData(
          {
            ...logDraft(state, 'prompt.submitted'),
            content: contentFrom(fields, 'prompt', 'prompt', { clientLength: length })
          },
          ok(length, 'length_chars')
        )
      ];
    }

    case 'tool_decision': {
      let tool = toolOf(fields);
      let native = fields.str('decision');
      let base = own(decisionTable, native);
      let source = own(decisionSources, fields.str('source'));

      let decision = base
        ? {
            ...base,
            ...(source ? { source } : {}),
            automatic: source ? source != 'user' : base.automatic
          }
        : undefined;

      return [
        withData(
          { ...logDraft(state, 'tool.decision'), factKey: toolFact(fields) },
          { ...(tool ? { tool } : {}), ...(decision ? { decision } : {}) }
        )
      ];
    }

    case 'sandbox_outcome': {
      let tool = toolOf(fields);
      let outcome = nativeLabel(fields.str('outcome'));
      let initial = fields.count('initial_duration_ms');
      let escalated = fields.count('escalated_duration_ms');

      return [
        withData(
          {
            ...logDraft(state, 'safety.decision'),
            role: 'supplemental',
            factKey: toolFact(fields)
          },
          {
            kind: 'sandbox',
            ...(tool ? { tool } : {}),
            ...ok(outcome, 'outcome'),
            ...ok(initial, 'initial_duration_ms'),
            ...ok(escalated, 'escalated_duration_ms')
          }
        )
      ];
    }

    case 'tool_result': {
      let tool = toolOf(fields);
      let success = fields.bool('success');
      let duration = fields.count('duration_ms');
      let truncated = fields.bool('output_truncated');
      let hints = { tool: tool?.name };

      return [
        withData(
          {
            ...logDraft(state, 'tool.call'),
            factKey: toolFact(fields),
            durationMs: duration,
            content: [
              ...contentFrom(fields, 'tool_input', 'arguments', { hints }),
              ...contentFrom(fields, 'tool_output', 'output', { hints })
            ]
          },
          {
            ...(tool ? { tool } : {}),
            ...(success !== undefined ? { outcome: success ? 'ok' : 'error' } : {}),
            ...(success === false ? { error: { class: 'tool' } } : {}),
            ...ok(duration, 'duration_ms'),
            ...ok(truncated, 'output_truncated')
          }
        )
      ];
    }

    case 'agent_response': {
      let length = fields.count('response_length');
      let agentType = nativeLabel(fields.str('agent.type'));

      return [
        withData(
          {
            ...logDraft(state, 'message.assistant'),
            content: contentFrom(fields, 'response', 'response', { clientLength: length })
          },
          { ...ok(length, 'length_chars'), ...ok(agentType, 'agent_type'), final: true }
        )
      ];
    }

    case 'guardian_assessment': {
      let status = nativeLabel(fields.str('status'));
      let outcome = nativeLabel(fields.str('outcome'));
      let risk = nativeLabel(fields.str('risk_level'));

      return [
        withData(logDraft(state, 'safety.decision'), {
          kind: 'reviewer',
          ...ok(status, 'status'),
          ...ok(outcome, 'outcome'),
          ...ok(risk, 'risk_level')
        })
      ];
    }

    case 'skill_invocation': {
      let skill = nativeLabel(fields.str('skill.name'));
      let scope = nativeLabel(fields.str('skill.scope'));
      let trigger = nativeLabel(fields.str('skill.invocation_type'));

      return [
        withData(logDraft(state, 'extension.event'), {
          kind: 'skill',
          action: 'activated',
          ...ok(skill, 'name'),
          ...ok(scope, 'source'),
          ...ok(trigger, 'trigger')
        })
      ];
    }

    case 'turn_cost': {
      let cost = usdCost({ usd: fields.num('usage.estimated_usd') }, 'server_estimate', {
        arrives_late: true
      });

      if (!cost) return [diagnostic(state)];

      let speed = normalizeSpeed(fields.str('speed'));
      let effort = normalizeEffort(fields.str('reasoning_effort'));
      let interrupted = fields.bool('turn.interrupted');

      return [
        withData(
          { ...logDraft(state, 'usage.charge'), factKey: turnFact(fields) },
          {
            cost,
            ...billingOf(fields),
            ...ok(speed, 'speed'),
            ...ok(effort, 'effort'),
            ...ok(interrupted, 'interrupted')
          }
        )
      ];
    }

    case 'retry': {
      let attempt = fields.count('retry.attempt');
      let delay = fields.count('retry.delay_ms');

      return [
        withData(logDraft(state, 'model.retry'), {
          ...ok(attempt, 'attempt'),
          ...ok(delay, 'delay_ms')
        })
      ];
    }

    case 'network_proxy.policy_decision': {
      let decision = nativeLabel(fields.str('network.policy.decision'));

      return [
        withData(logDraft(state, 'safety.decision'), {
          kind: 'network_policy',
          ...ok(decision, 'decision')
        })
      ];
    }

    default:
      return [diagnostic(state)];
  }
};

let mapLog: OtlpDialect['mapLog'] = (context, log) => {
  let fields = readFields(log.attributes, 'log.');
  let name = logName(log, fields);

  let source = otlpSource(adapter, codexOtlpId, 'logs');

  return withCoerced(
    mapEvent({ context, log, name, fields }).map(draft => ({ source, draft })),
    fields
  );
};

type MetricEntry = {
  type: Parameters<typeof measurementDraft>[2]['type'];
  unit: string;
  covers?: string[];
  dims: (fields: FieldReader) => Record<string, string | undefined>;
  used: string[];
  warnings?: (fields: FieldReader) => string[] | undefined;
};

let outcomeOf = (fields: FieldReader) => {
  let success = fields.bool('success');

  return success === undefined ? undefined : success ? 'ok' : 'error';
};

let metricCatalog: Record<string, MetricEntry> = {
  'tool.call': {
    type: 'tool.calls',
    unit: '{call}',
    dims: fields => ({
      tool_name: nativeLabel(fields.str('tool')),
      outcome: outcomeOf(fields)
    }),
    used: ['tool', 'success']
  },

  'tool.call.duration_ms': {
    type: 'tool.duration',
    unit: 'ms',
    dims: fields => ({
      tool_name: nativeLabel(fields.str('tool')),
      outcome: outcomeOf(fields)
    }),
    used: ['tool', 'success']
  },

  api_request: {
    type: 'requests',
    unit: '{request}',
    dims: fields => ({ outcome: outcomeOf(fields) }),
    used: ['success', 'status']
  },

  'api_request.duration_ms': {
    type: 'request.duration',
    unit: 'ms',
    dims: fields => ({ outcome: outcomeOf(fields) }),
    used: ['success', 'status']
  },

  'turn.token_usage': {
    type: 'tokens',
    unit: '{token}',
    covers: ['model.request'],
    dims: fields => ({ token_type: own(tokenTypes, fields.str('token_type'))?.type }),
    used: ['token_type'],
    warnings: fields => {
      let warning = own(tokenTypes, fields.str('token_type'))?.warning;

      return warning ? [warning] : undefined;
    }
  },

  'turn.ttft.duration_ms': {
    type: 'request.ttft',
    unit: 'ms',
    dims: () => ({}),
    used: []
  },

  'thread.started': { type: 'sessions', unit: '{session}', dims: () => ({}), used: [] }
};

let costMetric = 'turn.cost_microusd';

let mapMetric: OtlpDialect['mapMetric'] = (context, point) => {
  let name = stripPrefix(point.name, eventPrefix);
  let fields = readFields(point.attributes, 'metric.');
  let source = otlpSource(adapter, codexOtlpId, 'metrics');

  if (name == costMetric) {
    let cost = usdCost({ micros: point.value ?? undefined }, 'server_estimate', {
      arrives_late: true
    });

    if (!cost) return [];

    let actor = actorOf(fields, context.resourceFields);

    return [
      {
        source,
        draft: {
          kind: 'event',
          type: 'usage.charge',
          identity: [
            'metric',
            name,
            fields.str('conversation.id') ?? '',
            fields.str('turn.id') ?? '',
            String(point.timeNs)
          ].join('|'),
          signalName: safeNativeName(point.name),
          role: 'duplicate',
          factKey: turnFact(fields),
          occurredAt: dateFromNanos(point.timeNs),
          client: clientOf(context, fields),
          ...(actor ? { actor } : {}),
          ctx: { sessionId: sessionIdOf(fields), turnId: fields.str('turn.id') },
          data: {
            cost,
            ...billingOf(fields),
            ...ok(normalizeSpeed(fields.str('speed')), 'speed'),
            ...ok(normalizeEffort(fields.str('reasoning_effort')), 'effort')
          },
          coerced: fields.coerced
        }
      }
    ];
  }

  let entry = own(metricCatalog, name);
  if (!entry) return [];

  if (name == 'turn.token_usage' && fields.str('token_type') == 'total') return [];

  let draft = measurementDraft(context, point, {
    type: entry.type,
    unit: entry.unit,
    covers: entry.covers,
    dims: entry.dims(fields),
    usedAttributes: entry.used,
    warnings: entry.warnings?.(fields),
    client: clientOf(context, fields)
  });

  if (!draft) return [];

  return withCoerced([{ source, draft }], fields);
};

let spanUsage = (fields: FieldReader, prefix: 'turn' | 'response') => {
  if (prefix == 'turn') {
    return buildUsage({
      inputIncludingCache: fields.count('codex.turn.token_usage.input_tokens'),
      cacheRead: fields.count('codex.turn.token_usage.cached_input_tokens'),
      cacheWrite: fields.count('codex.turn.token_usage.cache_write_input_tokens'),
      outputIncludingReasoning: fields.count('codex.turn.token_usage.output_tokens'),
      reasoning: fields.count('codex.turn.token_usage.reasoning_output_tokens'),
      totalReported: fields.count('codex.turn.token_usage.total_tokens'),
      provenance: 'aggregate'
    });
  }

  return buildUsage({
    inputIncludingCache: fields.count('gen_ai.usage.input_tokens'),
    cacheRead: fields.count('gen_ai.usage.cache_read.input_tokens'),
    cacheWrite: fields.count('gen_ai.usage.cache_write.input_tokens'),
    outputIncludingReasoning: fields.count('gen_ai.usage.output_tokens'),
    reasoning: fields.count('codex.usage.reasoning_output_tokens'),
    totalReported: fields.count('codex.usage.total_tokens')
  });
};

let mapSpan: OtlpDialect['mapSpan'] = (context, span) => {
  if (quietSpans.has(span.name)) return [];

  let fields = readFields(span.attributes, 'span.');
  let actor = actorOf(fields, context.resourceFields);

  let duration =
    span.startNs > 0n && span.endNs >= span.startNs
      ? Number((span.endNs - span.startNs) / 1_000_000n)
      : undefined;

  let base: RecordDraft = {
    kind: 'event',
    type: 'unmapped',
    identity: `span|${span.traceId}|${span.spanId}`,
    signalName: safeNativeName(span.name),
    role: 'supplemental',
    occurredAt: dateFromNanos(span.startNs),
    durationMs: duration,
    client: clientOf(context, fields),
    ...(actor ? { actor } : {}),
    ctx: {
      sessionId: sessionIdOf(fields),
      parentSessionId: fields.str('parent.conversation.id'),
      turnId: fields.str('turn.id'),
      toolCallId: fields.str('tool.call_id'),
      trace: traceOf({
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId
      })
    },
    data: {},
    coerced: fields.coerced
  };

  let source = otlpSource(adapter, codexOtlpId, 'traces');
  let finish = (draft: RecordDraft): Mapped[] => withCoerced([{ source, draft }], fields);
  let failed = span.statusCode == 2;

  switch (span.name) {
    case 'session_task.turn': {
      let usage = spanUsage(fields, 'turn');
      let model = nativeLabel(fields.str('model'));
      let effort = normalizeEffort(fields.str('codex.turn.reasoning_effort'));

      return finish(
        withData(
          {
            ...base,
            type: 'turn.completed',
            role: 'aggregate',
            factKey: turnFact(fields),
            derived: usage.derived,
            warnings: usage.warnings
          },
          {
            outcome: failed ? 'error' : 'ok',
            ...modelRef(model),
            ...ok(effort, 'effort'),
            ...(usage.usage ? { usage: usage.usage } : {}),
            ...ok(duration, 'duration_ms')
          }
        )
      );
    }

    case 'session_task.compact':
      return finish(
        withData(
          { ...base, type: 'context.compaction' },
          { outcome: failed ? 'error' : 'ok', ...ok(duration, 'duration_ms') }
        )
      );

    case 'handle_responses': {
      let usage = spanUsage(fields, 'response');
      if (!usage.usage) return [];

      let effort = normalizeEffort(fields.str('codex.request.reasoning_effort'));

      return finish(
        withData(
          { ...base, type: 'model.request', derived: usage.derived, warnings: usage.warnings },
          { usage: usage.usage, ...billingOf(fields), ...ok(effort, 'effort') }
        )
      );
    }

    case 'mcp.tools.call': {
      let tool = toolOf(fields);
      let errorType = nativeLabel(fields.str('error.type'));
      let errored = failed || errorType !== undefined;

      return finish(
        withData(
          { ...base, type: 'tool.call', factKey: toolFact(fields) },
          {
            ...(tool ? { tool } : {}),
            outcome: errored ? 'error' : 'ok',
            ...(errored
              ? { error: { class: 'tool', ...(errorType ? { native_type: errorType } : {}) } }
              : {}),
            ...ok(duration, 'duration_ms')
          }
        )
      );
    }

    default:
      return finish(
        withData(base, { native_name: safeNativeName(span.name), category: 'diagnostic' })
      );
  }
};

export let codexOtlp: OtlpDialect = {
  id: codexOtlpId,
  adapter,
  client: 'codex',

  matches: context => {
    if (context.serviceName && serviceNames.has(context.serviceName)) return true;

    return context.scope.name.startsWith(scopePrefix);
  },

  mapLog,
  mapMetric,
  mapSpan
};
