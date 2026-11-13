import type { RecordDraft } from '../../records/draft';
import { genAiBilling } from '../billing';
import { readFields, withCoerced, type FieldReader } from '../fields';
import { measurementDraft } from '../measure';
import { classifyTool } from '../tools';
import { dateFromNanos } from '../time';
import type { Mapped, OtlpDialect, OtlpGroupContext } from '../types';
import {
  buildUsage,
  errorFromStatus,
  modelRef,
  nativeLabel,
  normalizeProvider,
  own,
  type ErrorClass
} from '../values';
import { actorOf, clientVersionOf, otlpSource, safeNativeName, traceOf } from './common';

export let genAiOtlpId = 'genai.otlp.v1';

let adapter = 'generic';

let spanPattern =
  /^(chat|text_completion|generate_content|embeddings|execute_tool|invoke_agent|create_agent|invoke_workflow|retrieval)( |$)/;

let modelOperations = new Set(['chat', 'text_completion', 'generate_content']);

let tokenTypes: Record<string, { type: string; warning?: string }> = {
  input: { type: 'input', warning: 'token_type_includes_cache' },
  output: { type: 'output', warning: 'token_type_includes_reasoning' }
};

let ok = <T>(value: T | undefined, key: string) =>
  value === undefined ? {} : { [key]: value };

let withData = (draft: RecordDraft, data: Record<string, unknown>): RecordDraft => ({
  ...draft,
  data: { ...draft.data, ...data }
});

let clientOf = (context: OtlpGroupContext, fields: FieldReader): RecordDraft['client'] => {
  let version = clientVersionOf(context.resourceFields, fields);

  return { family: 'generic', ...(version ? { version } : {}) };
};

let providerOf = (fields: FieldReader) =>
  normalizeProvider(fields.str('gen_ai.provider.name', 'gen_ai.system'));

let modelOf = (fields: FieldReader) =>
  nativeLabel(fields.str('gen_ai.response.model', 'gen_ai.request.model'));

let errorClassOf = (errorType: string | undefined): ErrorClass => {
  if (!errorType) return 'unknown';

  let lowered = errorType.toLowerCase();

  if (lowered.includes('timeout')) return 'timeout';
  if (lowered.includes('rate')) return 'rate_limit';
  if (lowered.includes('auth')) return 'auth';
  if (lowered.includes('connection') || lowered.includes('network')) return 'network';

  return 'unknown';
};

let mapSpan: OtlpDialect['mapSpan'] = (context, span) => {
  let fields = readFields(span.attributes, 'span.');

  let operation =
    nativeLabel(fields.str('gen_ai.operation.name')) ?? spanPattern.exec(span.name)?.[1];

  let actor = actorOf(fields, context.resourceFields);

  let duration =
    span.startNs > 0n && span.endNs >= span.startNs
      ? Number((span.endNs - span.startNs) / 1_000_000n)
      : undefined;

  let errorType = nativeLabel(fields.str('error.type'));
  let failed = span.statusCode == 2 || errorType !== undefined;

  let base: RecordDraft = {
    kind: 'event',
    type: 'unmapped',
    identity: `span|${span.traceId}|${span.spanId}`,
    signalName: safeNativeName(operation ?? span.name),
    occurredAt: dateFromNanos(span.startNs),
    durationMs: duration,
    client: clientOf(context, fields),
    ...(actor ? { actor } : {}),
    ctx: {
      sessionId: fields.str('gen_ai.conversation.id', 'session.id'),
      requestId: fields.str('gen_ai.response.id'),
      toolCallId: fields.str('gen_ai.tool.call.id'),
      trace: traceOf({
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId
      })
    },
    data: {},
    coerced: fields.coerced
  };

  let source = otlpSource(adapter, genAiOtlpId, 'traces');
  let finish = (draft: RecordDraft): Mapped[] => withCoerced([{ source, draft }], fields);

  let errorInfo = failed
    ? {
        ...errorFromStatus(undefined, errorType, errorClassOf(errorType)),
        class: errorClassOf(errorType)
      }
    : undefined;

  if (operation && modelOperations.has(operation)) {
    let usage = buildUsage({
      inputIncludingCache: fields.count('gen_ai.usage.input_tokens'),
      cacheRead: fields.count('gen_ai.usage.cache_read.input_tokens'),
      cacheWrite: fields.count('gen_ai.usage.cache_creation.input_tokens'),
      outputIncludingReasoning: fields.count('gen_ai.usage.output_tokens'),
      reasoning: fields.count('gen_ai.usage.reasoning.output_tokens')
    });

    let model = modelOf(fields);
    let provider = providerOf(fields);

    return finish(
      withData(
        { ...base, type: 'model.request', derived: usage.derived, warnings: usage.warnings },
        {
          outcome: failed ? 'error' : 'ok',
          ...(errorInfo ? { error: errorInfo } : {}),
          ...modelRef(model, provider),
          ...ok(genAiBilling(provider), 'billing'),
          ...(usage.usage ? { usage: usage.usage } : {}),
          ...ok(duration, 'duration_ms')
        }
      )
    );
  }

  if (operation == 'execute_tool') {
    let name = fields.str('gen_ai.tool.name');
    let tool = name ? classifyTool(name) : undefined;
    let callId = fields.str('gen_ai.tool.call.id');

    return finish(
      withData(
        {
          ...base,
          type: 'tool.call',
          factKey: callId ? `tool:{session_key}:${callId}` : null
        },
        {
          ...(tool ? { tool } : {}),
          outcome: failed ? 'error' : 'ok',
          ...(errorInfo ? { error: errorInfo } : {}),
          ...ok(duration, 'duration_ms')
        }
      )
    );
  }

  if (operation == 'invoke_agent') {
    let agent = nativeLabel(fields.str('gen_ai.agent.name'));

    return finish(
      withData(
        { ...base, type: 'agent.end' },
        {
          status: failed ? 'failed' : 'completed',
          ...(agent ? { name: agent } : {}),
          ...ok(duration, 'duration_ms')
        }
      )
    );
  }

  return finish(
    withData(base, {
      native_name: safeNativeName(operation ?? span.name),
      category: 'diagnostic'
    })
  );
};

let mapMetric: OtlpDialect['mapMetric'] = (context, point) => {
  let fields = readFields(point.attributes, 'metric.');

  let model = nativeLabel(fields.str('gen_ai.request.model', 'gen_ai.response.model'));
  let provider = providerOf(fields);
  let outcome = fields.str('error.type') ? 'error' : 'ok';

  let source = otlpSource(adapter, genAiOtlpId, 'metrics');
  let client = clientOf(context, fields);

  let build = (
    type: Parameters<typeof measurementDraft>[2]['type'],
    unit: string,
    options: {
      scale?: number;
      dims: Record<string, string | undefined>;
      used: string[];
      warnings?: string[];
      covers?: string[];
    }
  ): Mapped[] => {
    let draft = measurementDraft(context, point, {
      type,
      unit,
      scale: options.scale,
      dims: options.dims,
      usedAttributes: options.used,
      warnings: options.warnings,
      covers: options.covers,
      client
    });

    return draft ? withCoerced([{ source, draft }], fields) : [];
  };

  let used = [
    'gen_ai.request.model',
    'gen_ai.response.model',
    'gen_ai.provider.name',
    'gen_ai.system',
    'error.type',
    'gen_ai.operation.name'
  ];

  switch (point.name) {
    case 'gen_ai.client.token.usage': {
      let entry = own(tokenTypes, fields.str('gen_ai.token.type'));
      if (!entry) return [];

      return build('tokens', '{token}', {
        dims: { model, provider, token_type: entry.type },
        used: [...used, 'gen_ai.token.type'],
        warnings: entry.warning ? [entry.warning] : undefined,
        covers: ['model.request']
      });
    }

    case 'gen_ai.client.operation.duration':
      return build('request.duration', 'ms', {
        scale: 1000,
        dims: { model, provider, outcome },
        used
      });

    case 'gen_ai.client.operation.time_to_first_chunk':
      return build('request.ttft', 'ms', { scale: 1000, dims: { model, provider }, used });

    default:
      return [];
  }
};

let mapLog: OtlpDialect['mapLog'] = (context, log) => {
  let fields = readFields(log.attributes, 'log.');
  let name = safeNativeName(fields.str('event.name') ?? (log.eventName || undefined));
  let trace = traceOf({ traceId: log.traceId, spanId: log.spanId });

  return [
    {
      source: otlpSource(adapter, genAiOtlpId, 'logs'),
      draft: {
        kind: 'event',
        type: 'unmapped',
        identity: ['log', name, String(log.timeNs), log.traceId, log.spanId].join('|'),
        signalName: name,
        occurredAt: dateFromNanos(log.timeNs),
        client: clientOf(context, fields),
        ctx: {
          sessionId: fields.str('gen_ai.conversation.id', 'session.id'),
          ...(trace ? { trace } : {})
        },
        data: { native_name: name, category: 'diagnostic' },
        coerced: fields.coerced
      }
    }
  ];
};

export let genAiOtlp: OtlpDialect = {
  id: genAiOtlpId,
  adapter,
  client: 'generic',

  matches: context => {
    let sample = context.sampleName;
    if (sample === undefined) return false;

    if (context.signal == 'traces') return spanPattern.test(sample);

    return sample.startsWith('gen_ai.');
  },

  mapLog,
  mapMetric,
  mapSpan
};
