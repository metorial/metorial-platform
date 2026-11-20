import { summarizeRequest } from '@mtsrc/ai-gateway-request-features';
import type { GatewayPrincipal, VirtualModelDefinition } from '@mtsrc/ai-gateway-spec';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveVirtualModel } from '../src/lib/lookup';

let mocks = vi.hoisted(() => ({
  route: vi.fn(),
  runDecision: vi.fn(),
  memoStore: new Map<string, unknown>()
}));

vi.mock('@mtsrc/ai-gateway-module-routing', async importOriginal => ({
  ...(await importOriginal<typeof import('@mtsrc/ai-gateway-module-routing')>()),
  routeService: { route: mocks.route, resolveModel: vi.fn() }
}));

vi.mock('@mtsrc/ai-gateway-decisions', async importOriginal => ({
  ...(await importOriginal<typeof import('@mtsrc/ai-gateway-decisions')>()),
  runDecision: mocks.runDecision
}));

vi.mock('../src/lib/decisionBackend', () => ({
  resolveDecisionBackend: async () => ({
    source: 'platform',
    platformConnectionSlug: 'cloudflare-decisions',
    credentials: { apiToken: 't' },
    config: { accountId: 'a' }
  })
}));

vi.mock('../src/lib/lookup', () => ({
  findActiveVirtualModel: vi.fn(),
  getTargetProfiles: async (d: { targets: string[] }) =>
    Object.fromEntries(
      d.targets.map(target => [
        target,
        {
          modelSlug: target,
          contextTokens: 100_000,
          inputModalities: target == 'lab/text-only' ? ['text'] : ['text', 'image'],
          supportsTools: true
        }
      ])
    ),
  loadTargetProfiles: vi.fn()
}));

vi.mock('../src/lib/memo', () => ({
  createMemo:
    () =>
    async (key: string, compute: (setTTL: (seconds: number) => void) => Promise<unknown>) => {
      if (mocks.memoStore.has(key)) return { value: mocks.memoStore.get(key), cached: true };

      let ttl = Infinity;
      let value = await compute(seconds => (ttl = seconds));
      if (ttl > 1) mocks.memoStore.set(key, value);

      return { value, cached: false };
    }
}));

let { virtualModelRoutingService } = await import('../src/services/virtualModelRouting');

let principal = (allowedModels: string[] = []): GatewayPrincipal => ({
  token: { id: 'gwtk_1', consumerRef: null, allowedModels, limits: [], metadata: {} },
  organization: { id: 'org', ref: 'org' },
  project: { id: 'prj', ref: 'prj', platformLimits: [] },
  instance: {
    id: 'ins',
    ref: 'ins',
    logRetentionDays: 30,
    limits: [],
    settings: {
      contentLogging: { enabled: false, retentionDays: 30 },
      metorialProviderEnabled: true,
      fallbacksEnabled: true,
      zdrRequired: false
    }
  }
});

let definition: VirtualModelDefinition = {
  decision: { model: 'clef-flash' },
  signals: {
    complexity: {
      type: 'score',
      instructions: 'How hard?',
      levels: ['Easy', 'Medium', 'Hard']
    }
  },
  rules: [
    { id: 'vision', when: 'request.has_images', models: [{ model: 'lab/vision' }] },
    {
      id: 'hard',
      when: 'signals.complexity.level == 2',
      models: [{ model: 'lab/premium' }, { model: 'lab/standard' }],
      overrides: { reasoningEffort: 'high' }
    }
  ],
  default: { models: [{ model: 'lab/standard' }] },
  stickiness: { metadataKey: 'session' }
};

let virtualModel = (overrides: Partial<VirtualModelDefinition> = {}): ActiveVirtualModel => ({
  id: 'gwvm_1',
  slug: 'smart',
  name: 'Smart',
  description: null,
  versionId: `gwvv_${JSON.stringify(overrides).length}_${Math.random()}`,
  versionNumber: 1,
  definition: { ...definition, ...overrides },
  createdAt: new Date()
});

let decisionResult = (level: number) => ({
  signals: {
    complexity: {
      type: 'score',
      score: level,
      level,
      probability: 0.9,
      confidence: 0.9,
      probabilities: [0.05, 0.05, 0.9]
    }
  },
  model: 'clef-flash',
  inputTokens: 200,
  costUsd: 0.000018,
  latencyMs: 40
});

let candidateFor = (model: string) => ({
  billedProviderSlug: 'metorial',
  providerSlug: model.split('/')[1],
  connectionOwner: 'platform',
  platformConnectionSlug: model,
  routingRuleSlug: 'r',
  offeringId: `off_${model}`,
  vendorModelId: model,
  billedPricing: null,
  billedPricingSource: 'offering',
  providerPricing: null
});

let textRequest = summarizeRequest('openai_chat', {
  messages: [{ role: 'user', content: 'Prove the theorem' }]
});

let imageRequest = summarizeRequest('openai_chat', {
  messages: [
    {
      role: 'user',
      content: [{ type: 'image_url', image_url: { url: 'https://x/y.png' } }]
    }
  ]
});

beforeEach(() => {
  mocks.memoStore.clear();
  mocks.runDecision.mockReset();
  mocks.route.mockReset();
  mocks.route.mockImplementation(async (d: { model: string }) => ({
    model: { slug: d.model, labSlug: 'lab' },
    candidates: [candidateFor(d.model)]
  }));
});

describe('routeVirtual', () => {
  it('skips the decision model when a deterministic rule matches', async () => {
    let route = await virtualModelRoutingService.routeVirtual({
      principal: principal(),
      virtualModel: virtualModel(),
      summary: imageRequest,
      metadata: {},
      useCaches: true
    });

    expect(mocks.runDecision).not.toHaveBeenCalled();
    expect(route.virtualModel).toMatchObject({
      ruleId: 'vision',
      reason: 'rule',
      decision: null
    });
    expect(route.candidates.map(candidate => candidate.model.slug)).toEqual(['lab/vision']);
  });

  it('routes on the decision and chains every target as fallbacks', async () => {
    mocks.runDecision.mockResolvedValue(decisionResult(2));

    let route = await virtualModelRoutingService.routeVirtual({
      principal: principal(),
      virtualModel: virtualModel(),
      summary: textRequest,
      metadata: {},
      useCaches: true,
      random: () => 0.5
    });

    expect(route.virtualModel).toMatchObject({
      ruleId: 'hard',
      decision: { cached: false, source: 'platform', inputTokens: 200 }
    });
    expect(route.overrides).toEqual({ reasoningEffort: 'high' });
    expect(route.candidates.map(candidate => candidate.requestedModel)).toEqual([
      'lab/premium',
      'lab/standard'
    ]);
    expect(mocks.route).toHaveBeenCalledWith(
      expect.objectContaining({ allowedModelsChecked: true })
    );
  });

  it('serves repeated requests from the decision cache', async () => {
    mocks.runDecision.mockResolvedValue(decisionResult(2));
    let model = virtualModel({ stickiness: undefined });

    let run = () =>
      virtualModelRoutingService.routeVirtual({
        principal: principal(),
        virtualModel: model,
        summary: textRequest,
        metadata: {},
        useCaches: true
      });

    await run();
    let second = await run();

    expect(mocks.runDecision).toHaveBeenCalledTimes(1);
    expect(second.virtualModel!.decision).toMatchObject({ cached: true, costUsd: 0 });
  });

  it('falls back to the default when the decision model fails', async () => {
    mocks.runDecision.mockRejectedValue(new Error('boom'));

    let route = await virtualModelRoutingService.routeVirtual({
      principal: principal(),
      virtualModel: virtualModel(),
      summary: textRequest,
      metadata: {},
      useCaches: true
    });

    expect(route.virtualModel).toMatchObject({
      ruleId: null,
      reason: 'default',
      decision: { error: { code: 'unavailable', message: 'boom' } }
    });
  });

  it('fails the request when onError is fail', async () => {
    mocks.runDecision.mockRejectedValue(new Error('boom'));

    await expect(
      virtualModelRoutingService.routeVirtual({
        principal: principal(),
        virtualModel: virtualModel({ decision: { model: 'clef-flash', onError: 'fail' } }),
        summary: textRequest,
        metadata: {},
        useCaches: true
      })
    ).rejects.toThrow(/decision model could not classify/);
  });

  it('pins a conversation to its first route', async () => {
    mocks.runDecision
      .mockResolvedValueOnce(decisionResult(2))
      .mockResolvedValue(decisionResult(0));
    let model = virtualModel();

    let run = (summary = textRequest) =>
      virtualModelRoutingService.routeVirtual({
        principal: principal(),
        virtualModel: model,
        summary,
        metadata: { session: 's1' },
        useCaches: true
      });

    let first = await run();
    let second = await run(
      summarizeRequest('openai_chat', { messages: [{ role: 'user', content: 'thanks!' }] })
    );

    expect(first.virtualModel).toMatchObject({ ruleId: 'hard', reason: 'rule' });
    expect(second.virtualModel).toMatchObject({ ruleId: 'hard', reason: 'sticky' });
    expect(second.candidates[0]!.requestedModel).toBe(first.candidates[0]!.requestedModel);
    expect(mocks.runDecision).toHaveBeenCalledTimes(1);
  });

  it('drops models that cannot handle the request and reports unavailable ones', async () => {
    mocks.route.mockImplementation(async (d: { model: string }) => {
      if (d.model == 'lab/gone') {
        let { ServiceError } = await import('@lowerdeck/error');
        let { modelUnavailableError } = await import('@mtsrc/ai-gateway-module-routing');
        throw new ServiceError(modelUnavailableError());
      }

      return { model: { slug: d.model, labSlug: 'lab' }, candidates: [candidateFor(d.model)] };
    });

    let route = await virtualModelRoutingService.routeVirtual({
      principal: principal(),
      virtualModel: virtualModel({
        rules: [],
        default: {
          models: [{ model: 'lab/text-only' }, { model: 'lab/gone' }, { model: 'lab/vision' }]
        }
      }),
      summary: imageRequest,
      metadata: {},
      useCaches: true,
      random: () => 0.5
    });

    expect(route.candidates.map(candidate => candidate.model.slug)).toEqual(['lab/vision']);
    expect(route.virtualModel!.skippedTargets).toEqual([
      { model: 'lab/text-only', reason: 'image_input' },
      { model: 'lab/gone', reason: 'unavailable' }
    ]);
  });

  it('checks the token against the virtual model name', async () => {
    await expect(
      virtualModelRoutingService.routeVirtual({
        principal: principal(['anthropic/*']),
        virtualModel: virtualModel(),
        summary: imageRequest,
        metadata: {},
        useCaches: true
      })
    ).rejects.toThrow(/not allowed/);

    await expect(
      virtualModelRoutingService.routeVirtual({
        principal: principal(['smart']),
        virtualModel: virtualModel(),
        summary: imageRequest,
        metadata: {},
        useCaches: true
      })
    ).resolves.toBeTruthy();
  });
});
