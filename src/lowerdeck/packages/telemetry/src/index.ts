import {
  context as otelContext,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  trace
} from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  CompositePropagator,
  suppressTracing,
  W3CBaggagePropagator,
  W3CTraceContextPropagator
} from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  AlwaysOffSampler,
  BatchSpanProcessor,
  ParentBasedSampler
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import {
  withExecutionContextOptional,
  withExecutionTraceContext
} from '@lowerdeck/execution-context';

let initialized = false;
const DEPLOYMENT_ENVIRONMENT_RESOURCE_ATTRIBUTE = 'deployment.environment.name' as const;

let parseKeyValuePairs = (value: string | undefined): Record<string, string> => {
  if (!value?.trim()) return {};
  let parsed: Record<string, string> = {};

  for (let pair of value.split(',')) {
    let separator = pair.indexOf('=');
    if (separator <= 0) continue;

    let key = pair.slice(0, separator).trim();
    let value = pair.slice(separator + 1).trim();

    if (!key) continue;
    parsed[key] = value;
  }

  return parsed;
};

let parseHeaders = (headers: string | undefined): Record<string, string> | undefined => {
  let parsed = parseKeyValuePairs(headers);
  return Object.keys(parsed).length ? parsed : undefined;
};

let parseResourceAttributes = (attrs: string | undefined): Record<string, string> =>
  parseKeyValuePairs(attrs);

export {
  context as otelContext,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace
} from '@opentelemetry/api';

export let isTelemetryEnabled = () =>
  typeof process !== 'undefined' && process.env?.['OTEL_ENABLED'] === 'true';

export let hasActiveSpan = () => !!trace.getSpan(otelContext.active());

export let hasActiveTraceContext = () => !!trace.getSpanContext(otelContext.active());

export let withTracingSuppressed = async <T>(cb: () => Promise<T>): Promise<T> => {
  let suppressedContext = suppressTracing(otelContext.active());
  return await otelContext.with(suppressedContext, cb);
};

export let withExecutionContextTraceFallback = async <T>(cb: () => Promise<T>): Promise<T> => {
  if (!isTelemetryEnabled()) {
    return await cb();
  }

  if (hasActiveTraceContext()) {
    return await cb();
  }

  return await withExecutionContextOptional(async executionContext => {
    if (!executionContext) {
      return await withTracingSuppressed(cb);
    }

    return await withExecutionTraceContext(executionContext, async () => {
      if (hasActiveTraceContext()) {
        return await cb();
      }

      return await withTracingSuppressed(cb);
    });
  });
};

export let initTelemetry = (opts: { serviceName: string; allowRootSpans?: boolean }) => {
  if (initialized) return;

  let endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim();
  if (process.env.OTEL_ENABLED !== 'true' || !endpoint) return;

  if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  let serviceName = process.env.OTEL_SERVICE_NAME?.trim() || opts.serviceName;
  let extraResourceAttributes = parseResourceAttributes(process.env.OTEL_RESOURCE_ATTRIBUTES);
  let allowRootSpans =
    opts.allowRootSpans === true || process.env.OTEL_ALLOW_ROOT_SPANS === 'true';

  let provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [DEPLOYMENT_ENVIRONMENT_RESOURCE_ATTRIBUTE]:
        process.env.METORIAL_ENV ?? process.env.NODE_ENV ?? 'development',
      ...extraResourceAttributes
    }),
    sampler: allowRootSpans
      ? undefined
      : new ParentBasedSampler({
          root: new AlwaysOffSampler()
        }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: endpoint,
          headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        })
      )
    ]
  });

  provider.register({
    contextManager: new AsyncLocalStorageContextManager(),
    propagator: new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()]
    })
  });

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new PrismaInstrumentation({
        ignoreSpanTypes: [/^prisma:engine:/]
      })
    ]
  });

  initialized = true;

  console.log(
    `[otel] initialized for ${serviceName} -> ${endpoint} (allowRootSpans=${allowRootSpans})`
  );
};
