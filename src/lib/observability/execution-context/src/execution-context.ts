import { context as otelContext, propagation } from '@opentelemetry/api';
import { generateId } from '@lowerdeck/id';

export type ExecutionTraceCarrier = {
  traceparent?: string;
  tracestate?: string;
  baggage?: string;
};

export type ExecutionContext = {
  contextId: string;
  parent?: ExecutionContext;
  trace?: ExecutionTraceCarrier;
} & (
  | {
      type: 'request';
      userId?: string;
      memberId?: string;
      apiKeyId?: string;
      machineAccessId?: string;
      ip: string;
      userAgent: string;
    }
  | { type: 'scheduled'; cron: string; name: string }
  | { type: 'job'; queue: string }
  | { type: 'unknown' }
);

export let createExecutionContext = (
  input: ExecutionContext & { contextId?: string | undefined }
) => {
  if (!input.contextId) input.contextId = generateId('ctx_');

  if (!input.trace) {
    let carrier: Record<string, string> = {};

    try {
      propagation.inject(otelContext.active(), carrier);
    } catch {
      carrier = {};
    }

    if (carrier.traceparent || carrier.tracestate || carrier.baggage) {
      input.trace = {
        traceparent: carrier.traceparent,
        tracestate: carrier.tracestate,
        baggage: carrier.baggage
      };
    } else if (input.parent?.trace) {
      input.trace = {
        traceparent: input.parent.trace.traceparent,
        tracestate: input.parent.trace.tracestate,
        baggage: input.parent.trace.baggage
      };
    }
  }

  return input as ExecutionContext;
};
