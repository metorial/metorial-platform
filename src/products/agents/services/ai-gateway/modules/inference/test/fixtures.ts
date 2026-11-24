import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4StreamPart
} from '@ai-sdk/provider';
import type { Dialect, SseEvent } from '@mtsrc/ai-gateway-dialects';
import type {
  GatewayRoute,
  GatewayRouteCandidate
} from '@mtsrc/ai-gateway-module-virtual-models';
import type {
  GatewayPrincipal,
  Pricing,
  ResolvedInstanceSettings
} from '@mtsrc/ai-gateway-spec';
import { vi } from 'vitest';
import { unlimitedLimiter, type InferenceLimiter } from '../src/lib/limiter';
import {
  createInferenceRunner,
  type InferenceLogRecord,
  type InferenceRequest,
  type InferenceRunnerDependencies
} from '../src/lib/runner';

export let pricing: Pricing = {
  currency: 'USD',
  text: {
    input: 2,
    output: 10,
    cacheRead: 0.5,
    cacheWrite: [
      { ttl: '5m', price: 2.5 },
      { ttl: '1h', price: 4 }
    ],
    reasoning: null
  },
  image: null,
  audio: null,
  video: null,
  contextTiers: [],
  units: [],
  webSearchPer1k: null
};

export let providerPricing: Pricing = {
  ...pricing,
  text: { ...pricing.text!, input: 1, output: 5 }
};

export let principalWith = (
  settings: Partial<ResolvedInstanceSettings> = {}
): GatewayPrincipal => ({
  token: {
    id: 'agtk_1',
    consumerRef: 'consumer_1',
    allowedModels: [],
    limits: [],
    metadata: {}
  },
  organization: { id: 'agor_1', ref: 'org' },
  project: {
    id: 'agpr_1',
    ref: 'project',
    platformLimits: [],
    disabled: null,
    billingRestriction: null
  },
  instance: {
    id: 'agin_1',
    ref: 'instance',
    logRetentionDays: 30,
    limits: [],
    settings: {
      contentLogging: { enabled: false, retentionDays: 7 },
      metorialProviderEnabled: true,
      fallbacksEnabled: true,
      zdrRequired: false,
      ...settings
    }
  }
});

export let customerCandidate = (
  n: number,
  overrides: { providerSlug?: string } = {}
): GatewayRouteCandidate => ({
  billedProviderSlug: overrides.providerSlug ?? 'openai',
  providerSlug: overrides.providerSlug ?? 'openai',
  offeringId: `off_${n}`,
  vendorModelId: `vendor-model-${n}`,
  billedPricing: pricing,
  billedPricingSource: 'offering',
  providerPricing,
  connectionOwner: 'customer',
  connectionId: `conn_${n}`,
  model: { slug: 'openai/gpt-test', labSlug: 'openai' },
  requestedModel: 'openai/gpt-test'
});

export let platformCandidate = (n: number): GatewayRouteCandidate => ({
  billedProviderSlug: 'metorial',
  providerSlug: 'anthropic',
  offeringId: `off_${n}`,
  vendorModelId: `vendor-model-${n}`,
  billedPricing: pricing,
  billedPricingSource: 'routing_rule',
  providerPricing,
  connectionOwner: 'platform',
  platformConnectionSlug: 'anthropic-main',
  routingRuleSlug: 'anthropic-direct',
  model: { slug: 'anthropic/claude-test', labSlug: 'anthropic' },
  requestedModel: 'anthropic/claude-test'
});

export let routeOf = (
  candidates: GatewayRouteCandidate[],
  extra: Partial<GatewayRoute> = {}
): GatewayRoute => ({
  requestedModel: candidates[0]?.requestedModel ?? 'openai/gpt-test',
  candidates,
  overrides: null,
  virtualModel: null,
  ...extra
});

export let bodies: Record<
  Dialect,
  (extra?: Record<string, unknown>) => Record<string, unknown>
> = {
  openai_chat: (extra = {}) => ({
    model: 'openai/gpt-test',
    messages: [{ role: 'user', content: 'Hello there' }],
    ...extra
  }),
  anthropic_messages: (extra = {}) => ({
    model: 'openai/gpt-test',
    max_tokens: 256,
    messages: [{ role: 'user', content: 'Hello there' }],
    ...extra
  }),
  open_responses: (extra = {}) => ({
    model: 'openai/gpt-test',
    input: 'Hello there',
    ...extra
  })
};

export let dialects: Dialect[] = ['openai_chat', 'anthropic_messages', 'open_responses'];

export let readEvents = async (stream: ReadableStream<SseEvent>) => {
  let events: SseEvent[] = [];
  let reader = stream.getReader();

  while (true) {
    let next = await reader.read();
    if (next.done) return events;
    events.push(next.value);
  }
};

export let eventData = (events: SseEvent[]) =>
  events.map(event => (event.data == '[DONE]' ? event.data : JSON.parse(event.data)));

// A model whose stream the test drives part by part, to exercise timing-dependent paths
// (cancellation, errors after commit, streams that end early).
export let createControlledModel = (initial: LanguageModelV4StreamPart[] = []) => {
  let controller: ReadableStreamDefaultController<LanguageModelV4StreamPart> | undefined;
  let calls: LanguageModelV4CallOptions[] = [];
  let state = { cancelled: false };

  let model: LanguageModelV4 = {
    specificationVersion: 'v4',
    provider: 'controlled',
    modelId: 'controlled-model',
    supportedUrls: {},
    doGenerate: async () => {
      throw new Error('The gateway only calls doStream.');
    },
    doStream: async options => {
      calls.push(options);

      let stream = new ReadableStream<LanguageModelV4StreamPart>({
        start: c => {
          controller = c;
          initial.forEach(part => c.enqueue(part));
          options.abortSignal?.addEventListener('abort', () => {
            try {
              c.error(new DOMException('The operation was aborted.', 'AbortError'));
            } catch {}
          });
        },
        cancel: () => {
          state.cancelled = true;
        }
      });

      return { stream };
    }
  };

  return {
    model,
    calls,
    state,
    push: (...parts: LanguageModelV4StreamPart[]) =>
      parts.forEach(part => controller!.enqueue(part)),
    close: () => controller!.close(),
    error: (error: unknown) => controller!.error(error)
  };
};

// A model that never answers until the call is aborted, like a provider that is still thinking.
export let createHangingModel = () => {
  let calls: LanguageModelV4CallOptions[] = [];

  let model: LanguageModelV4 = {
    specificationVersion: 'v4',
    provider: 'hanging',
    modelId: 'hanging-model',
    supportedUrls: {},
    doGenerate: async () => {
      throw new Error('The gateway only calls doStream.');
    },
    doStream: options =>
      new Promise((_, reject) => {
        calls.push(options);
        options.abortSignal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        );
      })
  };

  return { model, calls };
};

export let textParts = (text = 'Hi', id = '0'): LanguageModelV4StreamPart[] => [
  { type: 'stream-start', warnings: [] },
  { type: 'text-start', id },
  { type: 'text-delta', id, delta: text }
];

export let finishPart = (): LanguageModelV4StreamPart => ({
  type: 'finish',
  finishReason: { unified: 'stop', raw: 'stop' },
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 5, text: 5, reasoning: 0 }
  }
});

export let setupRunner = (d: {
  route?: GatewayRoute | (() => Promise<GatewayRoute>);
  models: Record<string, LanguageModelV4 | (() => LanguageModelV4)>;
  limiter?: InferenceLimiter;
  countTokens?: InferenceRunnerDependencies['countTokens'];
  resolveConnection?: InferenceRunnerDependencies['resolveConnection'];
  prepareOptions?: InferenceRunnerDependencies['prepareOptions'];
  maxAttempts?: number;
  recordLog?: InferenceRunnerDependencies['recordLog'];
}) => {
  let logs: InferenceLogRecord[] = [];
  let time = 1_700_000_000_000;
  let logCount = 0;

  let deps = {
    route: vi.fn(async () =>
      typeof d.route == 'function'
        ? await d.route()
        : (d.route ?? routeOf([customerCandidate(1)]))
    ),
    resolveConnection: vi.fn(
      d.resolveConnection ?? (async () => ({ credentials: { apiKey: 'sk-test' }, config: {} }))
    ),
    createModel: vi.fn(({ candidate }: { candidate: GatewayRouteCandidate }) => {
      let model = d.models[candidate.offeringId];
      if (!model) throw new Error(`No model for ${candidate.offeringId}`);
      return typeof model == 'function' ? model() : model;
    }),
    prepareOptions: vi.fn(d.prepareOptions ?? (({ options }) => options)),
    countTokens: vi.fn(d.countTokens ?? (async () => null)),
    reportAuthFailure: vi.fn(),
    recordLog: vi.fn(d.recordLog ?? ((record: InferenceLogRecord) => void logs.push(record))),
    newLogId: vi.fn(() => `aglg_${++logCount}`),
    limiter: d.limiter ?? unlimitedLimiter,
    chargeBilledUsage: vi.fn(),
    now: () => new Date((time += 5)),
    maxAttempts: d.maxAttempts
  } satisfies InferenceRunnerDependencies;

  let runner = createInferenceRunner(deps);

  let run = (
    request: Partial<InferenceRequest> & Pick<InferenceRequest, 'dialect' | 'body'>,
    principal = principalWith()
  ) => runner.run({ principal, metadata: {}, ...request });

  return { runner, run, deps, logs };
};
