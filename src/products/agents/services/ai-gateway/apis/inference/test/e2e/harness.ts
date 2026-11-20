import Anthropic from '@anthropic-ai/sdk';
import {
  createBillingAccumulator,
  toNanoUsd,
  type BillingCharge
} from '@mtsrc/ai-gateway-module-billing';
import {
  createInferenceRunner,
  unlimitedLimiter,
  type InferenceLimiter,
  type InferenceLogRecord
} from '@mtsrc/ai-gateway-module-inference';
import type { GatewayRouteCandidate } from '@mtsrc/ai-gateway-module-virtual-models';
import {
  countProviderTokens,
  createProviderLanguageModel,
  prepareProviderCallOptions,
  providerCountsTokens
} from '@mtsrc/ai-gateway-providers';
import type { GatewayPrincipal, Pricing } from '@mtsrc/ai-gateway-spec';
import {
  createFakeUpstream,
  type Script,
  type UpstreamResponder
} from '@mtsrc/ai-gateway-testing';
import OpenAI from 'openai';
import { vi } from 'vitest';
import { createInferenceApp } from '../../src/app';

export type ProviderCase = {
  slug: string;
  modelId: string;
  config?: Record<string, string>;
};

// One provider per upstream wire family the gateway speaks, plus OpenAI-compatible variants
// whose streams differ in where they put reasoning and usage.
export let providerCases: ProviderCase[] = [
  { slug: 'openai', modelId: 'gpt-5-mini' },
  { slug: 'anthropic', modelId: 'claude-sonnet-4-5' },
  { slug: 'google-ai-studio', modelId: 'gemini-2.5-pro' },
  { slug: 'azure', modelId: 'gpt-5-mini', config: { resourceName: 'acme-ai' } },
  { slug: 'xai', modelId: 'grok-4' },
  { slug: 'groq', modelId: 'openai/gpt-oss-120b' },
  { slug: 'mistral', modelId: 'mistral-large-latest' },
  { slug: 'deepseek', modelId: 'deepseek-reasoner' },
  { slug: 'cohere', modelId: 'command-a-reasoning' }
];

export let providerCase = (slug: string) => providerCases.find(entry => entry.slug == slug)!;

let pricing: Pricing = {
  currency: 'USD',
  text: {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: [{ ttl: '5m', price: 3.75 }],
    reasoning: null
  },
  image: null,
  audio: null,
  video: null,
  contextTiers: [],
  units: [],
  webSearchPer1k: null
};

export let principal: GatewayPrincipal = {
  token: { id: 'gwtk_e2e', consumerRef: null, allowedModels: [], limits: [], metadata: {} },
  organization: { id: 'gwor_e2e', ref: 'org' },
  project: {
    id: 'gwpr_e2e',
    ref: 'project',
    platformLimits: [],
    disabled: null,
    billingRestriction: null
  },
  instance: {
    id: 'gwin_e2e',
    ref: 'instance',
    logRetentionDays: 30,
    limits: [],
    settings: {
      contentLogging: { enabled: false, retentionDays: 7 },
      metorialProviderEnabled: true,
      fallbacksEnabled: true,
      zdrRequired: false
    }
  }
};

type ConnectionOwner = 'customer' | 'platform';

let candidateFor = (provider: ProviderCase, index: number, owner: ConnectionOwner) => {
  let base = {
    billedProviderSlug: owner == 'platform' ? 'metorial' : provider.slug,
    providerSlug: provider.slug,
    offeringId: `off_${provider.slug}_${index}`,
    vendorModelId: provider.modelId,
    billedPricing: pricing,
    billedPricingSource: 'offering' as const,
    providerPricing: pricing,
    model: { slug: 'lab/test-model', labSlug: 'lab' },
    requestedModel: 'lab/test-model'
  };

  return (
    owner == 'customer'
      ? {
          ...base,
          connectionOwner: 'customer',
          connectionId: `conn_${provider.slug}_${index}`
        }
      : {
          ...base,
          connectionOwner: 'platform',
          platformConnectionSlug: `${provider.slug}-main`,
          routingRuleSlug: `${provider.slug}-direct`
        }
  ) satisfies GatewayRouteCandidate;
};

export let apiKey = 'sk-upstream-secret';

// The full gateway in-process: the real HTTP app, the real runner and the real AI SDK providers.
// Only the vendor APIs are fakes, answering in each vendor's actual streaming wire format.
export let createGateway = (d: {
  providers: (ProviderCase | string)[];
  upstream: UpstreamResponder | Script;
  owner?: ConnectionOwner | ConnectionOwner[];
  principal?: GatewayPrincipal;
  limiter?: InferenceLimiter;
  countTokens?: number;
}) => {
  let upstream = createFakeUpstream(d.upstream, {
    countTokens: d.countTokens,
    fragmentBytes: 7
  });
  let logs: InferenceLogRecord[] = [];
  let reportAuthFailure = vi.fn();
  let logCount = 0;

  let billedWrites: BillingCharge[] = [];
  let billing = createBillingAccumulator({
    flushIntervalMs: 60_000,
    write: async charge => void billedWrites.push(charge)
  });

  let providers = d.providers.map(entry =>
    typeof entry == 'string' ? providerCase(entry) : entry
  );
  let candidates = providers.map((provider, index) =>
    candidateFor(
      provider,
      index,
      Array.isArray(d.owner) ? d.owner[index]! : (d.owner ?? 'customer')
    )
  );
  let configOf = (candidate: GatewayRouteCandidate) =>
    providers[candidates.indexOf(candidate as (typeof candidates)[number])]?.config ?? {};

  let runner = createInferenceRunner({
    route: async () => ({
      requestedModel: 'lab/test-model',
      candidates,
      overrides: null,
      virtualModel: null
    }),
    resolveConnection: async candidate => ({
      credentials: { apiKey },
      config: configOf(candidate)
    }),
    createModel: ({ candidate, connection }) =>
      createProviderLanguageModel({
        providerSlug: candidate.providerSlug,
        credentials: connection.credentials,
        config: connection.config,
        modelId: candidate.vendorModelId,
        fetch: upstream.fetch
      }),
    prepareOptions: ({ providerSlug, options }) =>
      prepareProviderCallOptions({ providerSlug, options }),
    countTokens: async ({ candidate, connection, body, signal }) =>
      providerCountsTokens(candidate.providerSlug)
        ? await countProviderTokens({
            providerSlug: candidate.providerSlug,
            credentials: connection.credentials,
            config: connection.config,
            modelId: candidate.vendorModelId,
            body,
            signal,
            fetch: upstream.fetch
          })
        : null,
    reportAuthFailure,
    recordLog: record => void logs.push(record),
    newLogId: () => `gwlg_${++logCount}`,
    limiter: d.limiter ?? unlimitedLimiter,
    chargeBilledUsage: usage =>
      billing.add({
        projectId: usage.projectId,
        costNanoUsd: toNanoUsd(usage.costUsd),
        requestCount: usage.requests
      })
  });

  let app = createInferenceApp({
    authenticate: async () => d.principal ?? principal,
    extractToken: () => 'gateway-token',
    run: request => runner.run(request),
    listModels: async () => []
  });

  let gatewayFetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    await app.fetch(new Request(input, init))) as typeof fetch;

  return {
    upstream,
    logs,
    reportAuthFailure,
    billed: async () => {
      await billing.close();
      return billedWrites;
    },
    openai: new OpenAI({
      apiKey: 'gateway-token',
      baseURL: 'http://gateway.test/v1',
      fetch: gatewayFetch,
      maxRetries: 0
    }),
    anthropic: new Anthropic({
      apiKey: 'gateway-token',
      baseURL: 'http://gateway.test',
      fetch: gatewayFetch,
      maxRetries: 0
    }),
    fetch: gatewayFetch
  };
};

export type Gateway = ReturnType<typeof createGateway>;

export let lastUpstreamBody = (gateway: Gateway) => {
  let requests = gateway.upstream.requests.filter(
    request => request.wire != 'anthropic-count-tokens'
  );
  return requests.at(-1)!.body;
};
