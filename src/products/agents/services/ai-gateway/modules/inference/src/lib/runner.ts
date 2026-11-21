import type { LanguageModelV4, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { computeCost } from '@mtsrc/ai-gateway-cost';
import {
  createCollector,
  dialectAdapters,
  effectiveFinish,
  isDialectRequestError,
  type CallOptions,
  type CollectedResponse,
  type Dialect,
  type GatewayError,
  type ParsedRequest,
  type ResponseContext,
  type SseEvent
} from '@mtsrc/ai-gateway-dialects';
import type {
  GatewayRoute,
  GatewayRouteCandidate
} from '@mtsrc/ai-gateway-module-virtual-models';
import { summarizeRequest } from '@mtsrc/ai-gateway-request-features';
import {
  metorialProviderSlug,
  type GatewayPrincipal,
  type GatewayUsage,
  type ProviderConnectionConfig,
  type ProviderCredentials,
  type RequestMetadata
} from '@mtsrc/ai-gateway-spec';
import type {
  ConnectionRef,
  InferenceAttempt,
  InferenceError,
  InferenceErrorStage,
  InferenceLogDocument,
  InferenceOperation,
  InferenceStatus,
  InferenceVirtualModelLog
} from '@mtsrc/ai-gateway-store';
import {
  billingRestrictedError,
  classifyUpstreamError,
  connectionUnavailableError,
  incompleteStreamError,
  isAbortError,
  projectDisabledError,
  toGatewayError,
  type UpstreamFailure
} from './errors';
import type { InferenceLimiter, LimitDecision } from './limiter';
import { applyOverrides, cacheWriteTtlOf, promptStats } from './options';

let defaultMaxAttempts = 4;

export type ResolvedConnection = {
  credentials: ProviderCredentials;
  config: ProviderConnectionConfig;
};

export type InferenceLogRecord = {
  log: Omit<InferenceLogDocument, 'expiresAt' | 'hasContent'>;
  retentionDays: number;
  content?: { request: unknown; response?: unknown; retentionDays: number };
};

export type InferenceRunnerDependencies = {
  route: (d: {
    principal: GatewayPrincipal;
    model: string;
    dialect: Dialect;
    body: unknown;
    metadata: RequestMetadata;
  }) => Promise<GatewayRoute>;
  resolveConnection: (candidate: GatewayRouteCandidate) => Promise<ResolvedConnection>;
  createModel: (d: {
    candidate: GatewayRouteCandidate;
    connection: ResolvedConnection;
  }) => LanguageModelV4;
  prepareOptions: (d: { providerSlug: string; options: CallOptions }) => CallOptions;
  countTokens: (d: {
    candidate: GatewayRouteCandidate;
    connection: ResolvedConnection;
    body: Record<string, unknown>;
    signal?: AbortSignal;
  }) => Promise<number | null>;
  reportAuthFailure: (candidate: GatewayRouteCandidate) => void;
  recordLog: (record: InferenceLogRecord) => void;
  newLogId: () => string;
  limiter: InferenceLimiter;
  chargeBilledUsage: (d: { projectId: string; costUsd: number; requests: number }) => void;
  now?: () => Date;
  maxAttempts?: number;
};

export type InferenceRequest = {
  principal: GatewayPrincipal;
  dialect: Dialect;
  body: unknown;
  metadata: RequestMetadata;
  countTokens?: boolean;
  requestId?: string;
  userAgent?: string;
  signal?: AbortSignal;
  receivedAt?: Date;
};

export type InferenceResult =
  | { type: 'json'; body: unknown; headers: Record<string, string> }
  | { type: 'stream'; events: ReadableStream<SseEvent>; headers: Record<string, string> }
  | { type: 'error'; error: GatewayError; headers: Record<string, string> };

export let clientClosedError: GatewayError = {
  status: 499,
  code: 'client_closed_request',
  message: 'The client closed the request.'
};

type AttemptSuccess = {
  ok: true;
  reader: ReadableStreamDefaultReader<LanguageModelV4StreamPart>;
  buffered: LanguageModelV4StreamPart[];
  abort: AbortController;
  startedAt: Date;
  firstTokenAt?: Date;
};

type AttemptFailure = {
  ok: false;
  failure: UpstreamFailure;
  startedAt: Date;
  cancelled: boolean;
};

let contentParts = new Set<LanguageModelV4StreamPart['type']>([
  'text-start',
  'text-delta',
  'reasoning-start',
  'reasoning-delta',
  'tool-input-start',
  'tool-input-delta',
  'tool-call',
  'tool-result',
  'source',
  'file',
  'finish'
]);

let isContent = (part: LanguageModelV4StreamPart) => contentParts.has(part.type);

let isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value == 'object' && value !== null && !Array.isArray(value);

let connectionRefOf = (candidate: GatewayRouteCandidate): ConnectionRef =>
  candidate.connectionOwner == 'customer'
    ? { connectionOwner: 'customer', connectionId: candidate.connectionId }
    : {
        connectionOwner: 'platform',
        platformConnectionSlug: candidate.platformConnectionSlug
      };

let routeOf = (
  candidate: GatewayRouteCandidate
): NonNullable<InferenceLogDocument['route']> => ({
  ...connectionRefOf(candidate),
  providerSlug: candidate.providerSlug,
  offeringId: candidate.offeringId,
  vendorModelId: candidate.vendorModelId,
  ...(candidate.connectionOwner == 'platform'
    ? { routingRuleSlug: candidate.routingRuleSlug }
    : {})
});

let logError = (
  error: GatewayError,
  stage: InferenceErrorStage,
  failure?: UpstreamFailure
): InferenceError => ({
  code: error.code,
  message: error.message,
  stage,
  ...(error.param ? { param: error.param } : {}),
  httpStatus: failure?.httpStatus ?? error.status,
  ...(failure?.providerCode ? { providerCode: failure.providerCode } : {})
});

let linkAbort = (signal: AbortSignal | undefined, controller: AbortController) => {
  if (!signal) return;
  if (signal.aborted) controller.abort(signal.reason);
  else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
};

export let createInferenceRunner = (deps: InferenceRunnerDependencies) => {
  let now = deps.now ?? (() => new Date());
  let maxAttempts = deps.maxAttempts ?? defaultMaxAttempts;

  let attempt = async (d: {
    candidate: GatewayRouteCandidate;
    options: CallOptions;
    stream: boolean;
    signal?: AbortSignal;
  }): Promise<AttemptSuccess | AttemptFailure> => {
    let startedAt = now();
    let fail = (failure: UpstreamFailure, cancelled = false): AttemptFailure => ({
      ok: false,
      failure,
      startedAt,
      cancelled
    });

    let model: LanguageModelV4;
    try {
      let connection = await deps.resolveConnection(d.candidate);
      model = deps.createModel({ candidate: d.candidate, connection });
    } catch (error) {
      console.error('[ai-gateway] Could not prepare a provider connection', error);
      return fail(connectionUnavailableError(d.candidate));
    }

    let abort = new AbortController();
    linkAbort(d.signal, abort);

    let options = deps.prepareOptions({
      providerSlug: d.candidate.providerSlug,
      options: d.options
    });
    let reader: ReadableStreamDefaultReader<LanguageModelV4StreamPart> | undefined;

    try {
      let { stream } = await model.doStream({ ...options, abortSignal: abort.signal });
      reader = stream.getReader();

      let buffered: LanguageModelV4StreamPart[] = [];
      let firstTokenAt: Date | undefined;

      while (true) {
        let next = await reader.read();
        if (next.done)
          return fail({ error: incompleteStreamError, retryable: true, authFailure: false });

        let part = next.value;
        if (part.type == 'error') {
          void reader.cancel().catch(() => {});
          return fail(classifyUpstreamError(part.error, d.candidate));
        }

        buffered.push(part);
        if (isContent(part)) firstTokenAt ??= now();

        // A streaming client sees output as soon as it exists, so the attempt commits on the
        // first content; a buffered response can still fall back until the stream finished.
        if (part.type == 'finish' || (d.stream && isContent(part))) {
          return { ok: true, reader, buffered, abort, startedAt, firstTokenAt };
        }
      }
    } catch (error) {
      void reader?.cancel().catch(() => {});

      if (d.signal?.aborted && (isAbortError(error) || abort.signal.aborted)) {
        return fail({ error: clientClosedError, retryable: false, authFailure: false }, true);
      }

      return fail(classifyUpstreamError(error, d.candidate));
    }
  };

  let run = async (request: InferenceRequest): Promise<InferenceResult> => {
    let receivedAt = request.receivedAt ?? now();
    let logId = deps.newLogId();
    let principal = request.principal;
    let settings = principal.instance.settings;
    let adapter = dialectAdapters[request.dialect];
    let body = isObject(request.body) ? request.body : {};
    let headers: Record<string, string> = { 'x-metorial-request-id': logId };

    let operation: InferenceOperation = request.countTokens
      ? 'count_tokens'
      : body.stream === true
        ? 'stream'
        : 'generate';

    let base = {
      _id: logId,
      organizationId: principal.organization.id,
      projectId: principal.project.id,
      instanceId: principal.instance.id,
      tokenId: principal.token.id,
      ...(principal.token.consumerRef ? { consumerRef: principal.token.consumerRef } : {}),
      dialect: request.dialect,
      operation,
      ...(request.requestId ? { requestId: request.requestId } : {}),
      requestedModel: typeof body.model == 'string' ? body.model : '',
      ...(Object.keys(request.metadata).length ? { metadata: request.metadata } : {})
    };

    let requestStats = (parsed?: ParsedRequest) => ({
      ...(parsed ? promptStats(parsed.options) : {}),
      ...(request.userAgent ? { userAgent: request.userAgent } : {})
    });

    let record = (d: {
      status: InferenceStatus;
      parsed?: ParsedRequest;
      route?: GatewayRoute;
      candidate?: GatewayRouteCandidate;
      attempts?: InferenceAttempt[];
      error?: InferenceError;
      finishReason?: string;
      usage?: GatewayUsage;
      costs?: Pick<InferenceLogDocument, 'billedCost' | 'providerCost'>;
      upstreamStartedAt?: Date;
      firstTokenAt?: Date;
      response?: unknown;
    }) => {
      let completedAt = now();

      try {
        deps.recordLog({
          log: {
            ...base,
            ...(d.candidate ? { model: d.candidate.model, route: routeOf(d.candidate) } : {}),
            ...(d.route?.virtualModel
              ? { virtualModel: d.route.virtualModel as InferenceVirtualModelLog }
              : {}),
            attempts: d.attempts ?? [],
            status: d.status,
            ...(d.finishReason ? { finishReason: d.finishReason } : {}),
            ...(d.error ? { error: d.error } : {}),
            ...(d.usage ? { usage: d.usage } : {}),
            ...d.costs,
            timing: {
              receivedAt,
              completedAt,
              totalMs: completedAt.getTime() - receivedAt.getTime(),
              ...(d.upstreamStartedAt
                ? {
                    upstreamStartedAt: d.upstreamStartedAt,
                    upstreamMs: completedAt.getTime() - d.upstreamStartedAt.getTime()
                  }
                : {}),
              ...(d.firstTokenAt && d.upstreamStartedAt
                ? {
                    firstTokenAt: d.firstTokenAt,
                    timeToFirstTokenMs:
                      d.firstTokenAt.getTime() - d.upstreamStartedAt.getTime()
                  }
                : {})
            },
            request: requestStats(d.parsed)
          },
          retentionDays: principal.instance.logRetentionDays,
          ...(settings.contentLogging.enabled
            ? {
                content: {
                  request: request.body,
                  response: d.response,
                  retentionDays: settings.contentLogging.retentionDays
                }
              }
            : {})
        });
      } catch (error) {
        console.error('[ai-gateway] Could not record an inference log', error);
      }
    };

    let reject = (
      error: GatewayError,
      stage: InferenceErrorStage,
      extra: { parsed?: ParsedRequest; route?: GatewayRoute } = {}
    ): InferenceResult => {
      record({ status: 'rejected', error: logError(error, stage), ...extra });
      return { type: 'error', error, headers };
    };

    let attemptLog = (
      candidate: GatewayRouteCandidate,
      startedAt: Date,
      outcome: InferenceAttempt['outcome'],
      error?: InferenceError
    ): InferenceAttempt => ({
      ...connectionRefOf(candidate),
      providerSlug: candidate.providerSlug,
      offeringId: candidate.offeringId,
      vendorModelId: candidate.vendorModelId,
      startedAt,
      durationMs: now().getTime() - startedAt.getTime(),
      outcome,
      ...(error ? { error } : {})
    });

    let costsOf = (
      candidate: GatewayRouteCandidate,
      usage: GatewayUsage,
      options: CallOptions
    ) => {
      let cacheWriteTtl = cacheWriteTtlOf(options);

      return {
        billedCost: {
          ...computeCost({ pricing: candidate.billedPricing, usage, cacheWriteTtl }),
          pricingSource: candidate.billedPricingSource
        },
        providerCost: computeCost({ pricing: candidate.providerPricing, usage, cacheWriteTtl })
      };
    };

    let settle = (
      candidate: GatewayRouteCandidate,
      usage: GatewayUsage,
      billedCostUsd: number
    ) =>
      void deps.limiter
        .settle({
          principal,
          usage,
          billedCostUsd,
          metorialBilled: candidate.connectionOwner == 'platform'
        })
        .catch(error => console.error('[ai-gateway] Could not charge inference usage', error));

    let parsed: ParsedRequest;
    try {
      parsed = adapter.parseRequest(request.body, { countTokens: request.countTokens });
    } catch (error) {
      if (isDialectRequestError(error)) return reject(error.toGatewayError(), 'request');
      throw error;
    }

    let { disabled, billingRestriction } = principal.project;
    if (disabled) return reject(projectDisabledError(disabled.reason), 'limits', { parsed });

    let decision: LimitDecision = { allowed: true, headers: {} };

    if (!request.countTokens) {
      // Limits protect spend but must not take inference down with them.
      try {
        decision = await deps.limiter.acquire({
          principal,
          dialect: request.dialect,
          estimateInputTokens: () =>
            summarizeRequest(request.dialect, request.body).estimatedInputTokens
        });
      } catch (error) {
        console.error('[ai-gateway] Could not check limits, allowing the request', error);
      }

      Object.assign(headers, decision.headers);
      if (!decision.allowed) return reject(decision.error, 'limits', { parsed });
    }

    let route: GatewayRoute;
    try {
      route = await deps.route({
        principal,
        model: parsed.model,
        dialect: request.dialect,
        body: request.body,
        metadata: request.metadata
      });
    } catch (error) {
      let gatewayError = toGatewayError(error);
      if (gatewayError.status < 500) return reject(gatewayError, 'routing', { parsed });

      console.error('[ai-gateway] Routing failed unexpectedly', error);
      record({ status: 'failed', parsed, error: logError(gatewayError, 'routing') });
      return { type: 'error', error: gatewayError, headers };
    }

    let routable = route.candidates;

    if (billingRestriction) {
      routable = routable.filter(candidate => candidate.connectionOwner != 'platform');
      if (!routable.length) {
        return reject(billingRestrictedError(billingRestriction.reason), 'limits', {
          parsed,
          route
        });
      }
    }

    let metorialBillingLimit = decision.allowed ? decision.metorialBillingLimit : undefined;
    if (metorialBillingLimit) {
      let customerBilled = routable.filter(
        candidate => candidate.connectionOwner != 'platform'
      );

      if (customerBilled.length < routable.length) metorialBillingLimit.onEnforced();
      if (!customerBilled.length)
        return reject(metorialBillingLimit.error, 'limits', { parsed, route });

      routable = customerBilled;
    }

    let options = applyOverrides(parsed.options, route.overrides);
    let candidates = routable.slice(0, settings.fallbacksEnabled ? maxAttempts : 1);

    if (request.countTokens) {
      let candidate = candidates[0]!;
      let tokens: number | null = null;
      let upstreamStartedAt = now();

      try {
        let connection = await deps.resolveConnection(candidate);
        tokens = await deps.countTokens({
          candidate,
          connection,
          body,
          signal: request.signal
        });
      } catch (error) {
        console.warn('[ai-gateway] Exact token counting failed, estimating instead', error);
      }

      let inputTokens =
        tokens ?? summarizeRequest(request.dialect, request.body).estimatedInputTokens;
      let response = { input_tokens: inputTokens };

      record({
        status: 'succeeded',
        parsed,
        route,
        candidate,
        usage: {
          input: { total: inputTokens, noCache: inputTokens, cacheRead: 0, cacheWrite: 0 },
          output: { total: 0, text: 0, reasoning: 0 }
        },
        upstreamStartedAt,
        response
      });

      return { type: 'json', body: response, headers };
    }

    let attempts: InferenceAttempt[] = [];
    let lastFailure: UpstreamFailure | null = null;
    let upstreamStartedAt: Date | undefined;
    let committed: { candidate: GatewayRouteCandidate; success: AttemptSuccess } | null = null;

    for (let candidate of candidates) {
      let result = await attempt({
        candidate,
        options,
        stream: parsed.stream,
        signal: request.signal
      });
      upstreamStartedAt ??= result.startedAt;

      if (result.ok) {
        committed = { candidate, success: result };
        break;
      }

      let error = logError(result.failure.error, 'upstream', result.failure);

      if (result.cancelled) {
        attempts.push(attemptLog(candidate, result.startedAt, 'cancelled', error));
        record({
          status: 'cancelled',
          parsed,
          route,
          candidate,
          attempts,
          error,
          upstreamStartedAt
        });
        return { type: 'error', error: clientClosedError, headers };
      }

      attempts.push(attemptLog(candidate, result.startedAt, 'failed', error));
      if (result.failure.authFailure) deps.reportAuthFailure(candidate);

      lastFailure = result.failure;
      if (!result.failure.retryable) break;
    }

    if (!committed) {
      let failure = lastFailure!;
      record({
        status: 'failed',
        parsed,
        route,
        candidate: candidates[attempts.length - 1],
        attempts,
        error: logError(failure.error, 'upstream', failure),
        upstreamStartedAt
      });
      if (failure.retryAfter) headers['retry-after'] = failure.retryAfter;

      return { type: 'error', error: failure.error, headers };
    }

    let { candidate, success } = committed;
    let context: ResponseContext = {
      id: logId,
      model: candidate.model.slug,
      createdAt: receivedAt
    };

    headers['x-metorial-model'] = candidate.model.slug;
    headers['x-metorial-provider'] =
      candidate.connectionOwner == 'platform' ? metorialProviderSlug : candidate.providerSlug;

    let succeed = (collected: CollectedResponse, response: unknown) => {
      let costs = costsOf(candidate, collected.usage, options);
      settle(candidate, collected.usage, costs.billedCost.totalUsd);

      if (candidate.connectionOwner == 'platform') {
        try {
          deps.chargeBilledUsage({
            projectId: principal.project.id,
            costUsd: costs.billedCost.totalUsd,
            requests: 1
          });
        } catch (error) {
          console.error('[ai-gateway] Could not charge billed usage', error);
        }
      }

      record({
        status: 'succeeded',
        parsed,
        route,
        candidate,
        attempts: [...attempts, attemptLog(candidate, success.startedAt, 'succeeded')],
        finishReason: effectiveFinish(collected),
        usage: collected.usage,
        costs,
        upstreamStartedAt,
        firstTokenAt: success.firstTokenAt,
        response
      });
    };

    if (!parsed.stream) {
      let collector = createCollector();
      success.buffered.forEach(part => collector.push(part));

      let collected = collector.result();
      let response = adapter.toResponse({ collected, context, request: parsed });
      succeed(collected, response);

      return { type: 'json', body: response, headers };
    }

    let encoder = adapter.createStreamEncoder({ context, request: parsed });
    let collector = createCollector();
    let settled = false;

    let fail = (
      status: 'failed' | 'cancelled',
      error: GatewayError,
      failure?: UpstreamFailure
    ) => {
      if (settled) return;
      settled = true;

      let logged = logError(error, 'upstream', failure);
      record({
        status,
        parsed,
        route,
        candidate,
        attempts: [...attempts, attemptLog(candidate, success.startedAt, status, logged)],
        error: logged,
        upstreamStartedAt,
        firstTokenAt: success.firstTokenAt,
        response: adapter.toResponse({
          collected: collector.result(),
          context,
          request: parsed
        })
      });
    };

    // Returns whether the response is over.
    let handle = (part: LanguageModelV4StreamPart, emit: (event: SseEvent) => void) => {
      if (part.type == 'error') {
        let failure = classifyUpstreamError(part.error, candidate);
        encoder.fail(failure.error).forEach(emit);
        fail('failed', failure.error, failure);
        return true;
      }

      collector.push(part);
      encoder.push(part).forEach(emit);

      if (part.type == 'finish') {
        settled = true;
        let collected = collector.result();
        succeed(collected, adapter.toResponse({ collected, context, request: parsed }));
        return true;
      }

      return false;
    };

    let events = new ReadableStream<SseEvent>({
      start: controller => {
        let emit = (event: SseEvent) => controller.enqueue(event);
        for (let part of success.buffered) {
          if (handle(part, emit)) {
            controller.close();
            return;
          }
        }
      },

      // Pull until something was emitted: a pull that enqueues nothing is not called again.
      pull: async controller => {
        let emitted = false;
        let emit = (event: SseEvent) => {
          emitted = true;
          controller.enqueue(event);
        };

        while (!emitted) {
          let next: Awaited<ReturnType<typeof success.reader.read>>;
          try {
            next = await success.reader.read();
          } catch (error) {
            if (settled) return;
            if (request.signal?.aborted) {
              fail('cancelled', clientClosedError);
              controller.close();
              return;
            }

            let failure = classifyUpstreamError(error, candidate);
            encoder.fail(failure.error).forEach(emit);
            fail('failed', failure.error, failure);
            controller.close();
            return;
          }

          // The client cancelled while the read was pending; the stream is already closed.
          if (settled) return;

          if (next.done) {
            encoder.fail(incompleteStreamError).forEach(emit);
            fail('failed', incompleteStreamError);
            controller.close();
            return;
          }

          if (handle(next.value, emit)) {
            controller.close();
            return;
          }
        }
      },

      cancel: () => {
        success.abort.abort();
        void success.reader.cancel().catch(() => {});
        fail('cancelled', clientClosedError);
      }
    });

    return { type: 'stream', events, headers };
  };

  return {
    run: async (request: InferenceRequest): Promise<InferenceResult> => {
      try {
        return await run(request);
      } catch (error) {
        console.error('[ai-gateway] Inference failed unexpectedly', error);
        return { type: 'error', error: toGatewayError(error), headers: {} };
      }
    }
  };
};

export type InferenceRunner = ReturnType<typeof createInferenceRunner>;
