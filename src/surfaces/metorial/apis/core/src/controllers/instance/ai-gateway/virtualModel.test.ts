import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { declarePresenter } from '@metorial/presenter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Group,
  Handler,
  Path
} from '../../../../../../../../platform/packages/rest/src/controller';
import { introspectApi } from '../../../../../../../../platform/packages/rest/src/introspect';
import {
  v1AiGatewayVirtualModelInsightsPresenter,
  v1AiGatewayVirtualModelPresenter,
  v1AiGatewayVirtualModelReplayPresenter,
  v1AiGatewayVirtualModelTestPresenter
} from '../../../../../../../../platform/presenters/src/implementation/aiGateway/virtualModel';
import {
  aiGatewayVirtualModelInsightsType,
  aiGatewayVirtualModelReplayType,
  aiGatewayVirtualModelTestType,
  aiGatewayVirtualModelType
} from '../../../../../../../../platform/presenters/src/types';

let mocks = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  createFromTemplate: vi.fn(),
  update: vi.fn(),
  rollback: vi.fn(),
  archive: vi.fn(),
  test: vi.fn(),
  replay: vi.fn(),
  insights: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-ai-gateway', () => ({
  aiGatewayVirtualModelService: {
    get: mocks.get,
    list: mocks.list,
    create: mocks.create,
    createFromTemplate: mocks.createFromTemplate,
    update: mocks.update,
    rollback: mocks.rollback,
    archive: mocks.archive,
    test: mocks.test,
    replay: mocks.replay,
    insights: mocks.insights
  }
}));
vi.mock('@metorial/module-access', () => ({
  accessService: { checkAccess: mocks.checkAccess, checkTargetAccess: mocks.checkTargetAccess }
}));
vi.mock('@metorial/module-flags', () => ({
  flagService: { getFlags: mocks.getFlags },
  isFlagEnabled: (flag: unknown) => flag === true,
  getFlagDisabledReason: () => undefined
}));
vi.mock('../../../middleware/apiGroup', () => ({ apiGroup: Group.create() }));
vi.mock('../../../middleware/instanceGroup', () => ({
  instanceGroup: Group.create(),
  instancePath: (path: string, sdkPath: string) => [
    Path(`/${path}`, sdkPath),
    Path(`/instances/:instanceId/${path}`, `management.instance.${sdkPath}`),
    Path(`/dashboard/instances/:instanceId/${path}`, `dashboard.instance.${sdkPath}`)
  ]
}));
vi.mock('@metorial/presenters', () => ({
  aiGatewayVirtualModelPresenter: declarePresenter(aiGatewayVirtualModelType, {
    mt_2025_01_01_dashboard: v1AiGatewayVirtualModelPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayVirtualModelPresenter
  }),
  aiGatewayVirtualModelTestPresenter: declarePresenter(aiGatewayVirtualModelTestType, {
    mt_2025_01_01_dashboard: v1AiGatewayVirtualModelTestPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayVirtualModelTestPresenter
  }),
  aiGatewayVirtualModelReplayPresenter: declarePresenter(aiGatewayVirtualModelReplayType, {
    mt_2025_01_01_dashboard: v1AiGatewayVirtualModelReplayPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayVirtualModelReplayPresenter
  }),
  aiGatewayVirtualModelInsightsPresenter: declarePresenter(aiGatewayVirtualModelInsightsType, {
    mt_2025_01_01_dashboard: v1AiGatewayVirtualModelInsightsPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayVirtualModelInsightsPresenter
  })
}));

let { aiGatewayVirtualModelController } = await import('./virtualModel');

let virtualModelHandler = (method: keyof typeof aiGatewayVirtualModelController.handlers) => {
  let handler = aiGatewayVirtualModelController.handlers[method];
  if (!(handler instanceof Handler)) throw new Error('Expected a virtual model handler');

  return handler;
};

let instance = { oid: 7n, id: 'ins_1', project: { oid: 8n }, organization: { oid: 9n } };
let auditScope = { organizationOid: 9n };
let context = {
  instance,
  organization: instance.organization,
  project: instance.project,
  auditScope
};

let publicDefinition = {
  decision: {
    model: 'clef-flash',
    connection_id: 'apcn_1',
    timeout_ms: 800,
    on_error: 'fail',
    context: {
      prior_turns: 2,
      max_chars: 4000,
      include_system: false,
      include_tool_names: true
    }
  },
  signals: {
    task_kind: {
      type: 'choice',
      instructions: 'What kind of work is asked for?',
      options: { coding: 'Source code', Writing_Prose: 'Prose' }
    },
    complexity: { type: 'score', instructions: 'How hard is it?', levels: ['Easy', 'Hard'] },
    needs_search: { type: 'boolean', instructions: 'Does it need fresh facts?' }
  },
  rules: [
    {
      id: 'long-context',
      description: 'Long prompts',
      when: 'request.input_tokens > 50000',
      models: [{ model: 'google/gemini-2.5-pro', weight: 3 }],
      overrides: { reasoning_effort: 'low', max_output_tokens: 4096, temperature: 0.2 }
    },
    {
      id: 'coding',
      when: "signals.task_kind.choice == 'coding'",
      models: [{ model: 'anthropic/claude-sonnet-4' }]
    }
  ],
  default: { models: [{ model: 'openai/gpt-5-mini' }] },
  stickiness: { metadata_key: 'session_id', ttl_seconds: 600 }
};

let gatewayDefinition = {
  decision: {
    model: 'clef-flash',
    connectionId: 'apcn_1',
    timeoutMs: 800,
    onError: 'fail',
    context: { priorTurns: 2, maxChars: 4000, includeSystem: false, includeToolNames: true }
  },
  signals: {
    task_kind: {
      type: 'choice',
      instructions: 'What kind of work is asked for?',
      options: { coding: 'Source code', Writing_Prose: 'Prose' }
    },
    complexity: { type: 'score', instructions: 'How hard is it?', levels: ['Easy', 'Hard'] },
    needs_search: { type: 'boolean', instructions: 'Does it need fresh facts?' }
  },
  rules: [
    {
      id: 'long-context',
      description: 'Long prompts',
      when: 'request.input_tokens > 50000',
      models: [{ model: 'google/gemini-2.5-pro', weight: 3 }],
      overrides: { reasoningEffort: 'low', maxOutputTokens: 4096, temperature: 0.2 }
    },
    {
      id: 'coding',
      when: "signals.task_kind.choice == 'coding'",
      models: [{ model: 'anthropic/claude-sonnet-4' }]
    }
  ],
  default: { models: [{ model: 'openai/gpt-5-mini' }] },
  stickiness: { metadataKey: 'session_id', ttlSeconds: 600 }
};

let virtualModel = {
  object: 'ai_gateway#virtual_model',
  id: 'avm_1',
  slug: 'smart-router',
  name: 'Smart router',
  description: null,
  instanceId: 'gwins_1',
  currentVersion: {
    object: 'ai_gateway#virtual_model_version',
    id: 'avmv_2',
    number: 2,
    definition: gatewayDefinition,
    targetModelSlugs: [
      'google/gemini-2.5-pro',
      'anthropic/claude-sonnet-4',
      'openai/gpt-5-mini'
    ],
    createdAt: new Date('2026-11-20T10:00:00Z')
  },
  warnings: [],
  archivedAt: null,
  createdAt: new Date('2026-11-19T10:00:00Z'),
  updatedAt: new Date('2026-11-20T10:00:00Z')
};

let testResult = {
  object: 'ai_gateway#virtual_model_test',
  request: {
    dialect: 'openai_chat',
    estimatedInputTokens: 1200,
    messageCount: 3,
    userTurns: 2,
    isContinuation: false,
    hasImages: false,
    hasFiles: false,
    hasAudio: false,
    toolCount: 1
  },
  virtualModel: {
    id: 'draft',
    slug: 'draft',
    versionId: 'draft_abc',
    versionNumber: 0,
    ruleId: 'coding',
    reason: 'rule',
    trace: [
      { ruleId: 'long-context', outcome: 'not_matched' },
      { ruleId: 'coding', outcome: 'matched' }
    ],
    targets: ['anthropic/claude-sonnet-4'],
    skippedTargets: [{ model: 'openai/gpt-5-mini', reason: 'image_input' }],
    decision: {
      model: 'clef-flash',
      source: 'platform',
      cached: false,
      latencyMs: 210,
      inputTokens: 900,
      costUsd: 0.0001,
      signals: {
        task_kind: {
          type: 'choice',
          choice: 'coding',
          probability: 0.9,
          confidence: 0.8,
          probabilities: { coding: 0.9, Writing_Prose: 0.1 }
        }
      },
      error: null
    }
  },
  overrides: null,
  candidates: [
    {
      provider: 'anthropic',
      connectionOwner: 'platform',
      pricing: null,
      model: { slug: 'anthropic/claude-sonnet-4', labSlug: 'anthropic' },
      requestedModel: 'anthropic/claude-sonnet-4'
    },
    {
      provider: 'bedrock',
      connectionOwner: 'customer',
      connectionId: 'apcn_2',
      vendorModelId: 'anthropic.claude-sonnet-4',
      pricing: null,
      pricingSource: 'connection',
      model: { slug: 'anthropic/claude-sonnet-4', labSlug: 'anthropic' },
      requestedModel: 'anthropic/claude-sonnet-4'
    }
  ]
};

let request = (input: {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}) =>
  ({
    body: input.body ?? {},
    query: input.query ?? {},
    apiVersion: 'mt_2026_01_01_magnetar',
    auth: { type: 'machine' },
    params: input.params ?? { virtualModelId: 'avm_1' },
    sharedMiddlewareMemo: new Map()
  }) as any;

let presented = async (result: { response: any }) =>
  await result.response({ apiVersion: 'mt_2026_01_01_magnetar' }).run();

let testBody = {
  token_id: 'agtk_1',
  dialect: 'openai_chat',
  request: { model: 'smart-router', messages: [{ role: 'user', content: 'Hi' }] },
  metadata: { session_id: 's_1' }
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getFlags.mockResolvedValue({ 'ai-gateway-enabled': true, 'paid-ai-gateway': true });
  mocks.get.mockResolvedValue(virtualModel);
  mocks.list.mockReturnValue({
    run: vi.fn().mockResolvedValue({
      items: [virtualModel],
      pagination: { hasNextPage: false, hasPreviousPage: false }
    })
  });
  mocks.create.mockResolvedValue(virtualModel);
  mocks.createFromTemplate.mockResolvedValue(virtualModel);
  mocks.update.mockResolvedValue(virtualModel);
  mocks.rollback.mockResolvedValue(virtualModel);
  mocks.archive.mockResolvedValue({ ...virtualModel, archivedAt: new Date() });
  mocks.test.mockResolvedValue(testResult);
});

describe('ai gateway virtual models', () => {
  it('converts the definition to the gateway shape on create', async () => {
    let result = await virtualModelHandler('create').run(
      request({
        body: { slug: 'smart-router', name: 'Smart router', definition: publicDefinition }
      }),
      context
    );

    expect(mocks.create).toHaveBeenCalledWith({
      instance,
      auditScope,
      input: {
        slug: 'smart-router',
        name: 'Smart router',
        description: undefined,
        definition: gatewayDefinition
      }
    });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:write'] })
    );
    expect(await presented(result)).toMatchObject({ object: 'ai_gateway.virtual_model' });
  });

  it('presents the definition in snake case, leaving signal names and options untouched', async () => {
    let result = await virtualModelHandler('get').run(request({}), context);

    expect(mocks.get).toHaveBeenCalledWith({ instance, virtualModelId: 'avm_1' });
    expect(await presented(result)).toEqual({
      object: 'ai_gateway.virtual_model',
      id: 'avm_1',
      slug: 'smart-router',
      name: 'Smart router',
      description: null,
      current_version: {
        object: 'ai_gateway.virtual_model.version',
        id: 'avmv_2',
        number: 2,
        definition: {
          ...publicDefinition,
          rules: [
            publicDefinition.rules[0],
            { ...publicDefinition.rules[1], description: null, overrides: null }
          ].map(rule => ({
            ...rule,
            models: rule.models.map(target => ({ weight: null, ...target }))
          })),
          default: { models: [{ model: 'openai/gpt-5-mini', weight: null }], overrides: null }
        },
        target_models: [
          'google/gemini-2.5-pro',
          'anthropic/claude-sonnet-4',
          'openai/gpt-5-mini'
        ],
        created_at: new Date('2026-11-20T10:00:00Z')
      },
      warnings: [],
      created_at: new Date('2026-11-19T10:00:00Z'),
      updated_at: new Date('2026-11-20T10:00:00Z'),
      deleted_at: null
    });
  });

  it('presents a minimal definition with nulls for what is not set', async () => {
    mocks.get.mockResolvedValue({
      ...virtualModel,
      currentVersion: {
        ...virtualModel.currentVersion,
        definition: { rules: [], default: { models: [{ model: 'openai/gpt-5-mini' }] } }
      }
    });

    let result = await virtualModelHandler('get').run(request({}), context);

    expect((await presented(result)).current_version.definition).toEqual({
      decision: null,
      signals: null,
      rules: [],
      default: { models: [{ model: 'openai/gpt-5-mini', weight: null }], overrides: null },
      stickiness: null
    });
  });

  it.each([
    ['an uppercase slug', { slug: 'Smart' }],
    [
      'a signal name the gateway rejects',
      { signals: { 'Bad-Name': { type: 'boolean', instructions: 'x' } } }
    ],
    [
      'a choice with one option',
      { signals: { kind: { type: 'choice', instructions: 'x', options: { a: 'A' } } } }
    ],
    ['an out of range decision timeout', { decision: { model: 'clef', timeout_ms: 10 } }],
    ['an unknown decision model', { decision: { model: 'gpt-5' } }],
    [
      'a rule id that is not kebab-case',
      { rules: [{ id: 'Long_Context', when: 'true', models: [{ model: 'a' }] }] }
    ],
    ['a rule without models', { rules: [{ id: 'empty', when: 'true', models: [] }] }],
    [
      'an out of range stickiness ttl',
      { stickiness: { metadata_key: 'session_id', ttl_seconds: 5 } }
    ]
  ])('rejects %s with a 400', async (_, change) => {
    let { slug, ...definitionChange } = change as Record<string, unknown>;

    await expect(
      virtualModelHandler('create').run(
        request({
          body: {
            slug: slug ?? 'smart-router',
            name: 'Smart router',
            definition: { ...publicDefinition, ...definitionChange }
          }
        }),
        context
      )
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('creates from a template with the parameters as models', async () => {
    await virtualModelHandler('createFromTemplate').run(
      request({
        body: {
          template: 'complexity-tiers',
          slug: 'tiers',
          name: 'Tiers',
          parameters: { cheap: 'openai/gpt-5-mini', premium: 'anthropic/claude-opus-4' },
          decision_connection_id: 'apcn_1'
        }
      }),
      context
    );

    expect(mocks.createFromTemplate).toHaveBeenCalledWith({
      instance,
      auditScope,
      input: {
        templateSlug: 'complexity-tiers',
        slug: 'tiers',
        name: 'Tiers',
        description: undefined,
        models: { cheap: 'openai/gpt-5-mini', premium: 'anthropic/claude-opus-4' },
        decisionConnectionId: 'apcn_1'
      }
    });
  });

  it('only sends a new definition on update when one is given', async () => {
    await virtualModelHandler('update').run(request({ body: { description: null } }), context);

    expect(mocks.update).toHaveBeenCalledWith({
      instance,
      virtualModel,
      auditScope,
      input: { name: undefined, description: null, definition: undefined }
    });
  });

  it('rolls back to the given version', async () => {
    await virtualModelHandler('rollback').run(
      request({ body: { version_id: 'avmv_1' } }),
      context
    );

    expect(mocks.rollback).toHaveBeenCalledWith({
      instance,
      virtualModel,
      auditScope,
      versionId: 'avmv_1'
    });
  });

  it('presents a deleted virtual model with deleted_at', async () => {
    let result = await virtualModelHandler('delete').run(request({}), context);

    expect(mocks.archive).toHaveBeenCalledWith({ instance, virtualModel, auditScope });
    expect((await presented(result)).deleted_at).toBeInstanceOf(Date);
  });

  it('tests a draft definition without a saved virtual model', async () => {
    let result = await virtualModelHandler('testDraft').run(
      request({ body: { definition: publicDefinition, ...testBody }, params: {} }),
      context
    );

    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.test).toHaveBeenCalledWith({
      instance,
      input: {
        gatewayTokenId: 'agtk_1',
        dialect: 'openai_chat',
        body: testBody.request,
        metadata: { session_id: 's_1' },
        definition: gatewayDefinition
      }
    });
    expect(await presented(result)).toEqual({
      object: 'ai_gateway.virtual_model.test',
      request: {
        dialect: 'openai_chat',
        input_tokens: 1200,
        message_count: 3,
        user_turns: 2,
        is_continuation: false,
        has_images: false,
        has_files: false,
        has_audio: false,
        tool_count: 1
      },
      route: {
        version_id: null,
        version_number: null,
        rule_id: 'coding',
        reason: 'rule',
        trace: [
          { rule_id: 'long-context', outcome: 'not_matched', error: null },
          { rule_id: 'coding', outcome: 'matched', error: null }
        ],
        models: ['anthropic/claude-sonnet-4'],
        skipped_models: [{ model: 'openai/gpt-5-mini', reason: 'image_input' }],
        decision: {
          model: 'clef-flash',
          source: 'platform',
          cached: false,
          latency_ms: 210,
          input_tokens: 900,
          cost_usd: 0.0001,
          signals: {
            task_kind: {
              type: 'choice',
              choice: 'coding',
              probability: 0.9,
              confidence: 0.8,
              probabilities: { coding: 0.9, Writing_Prose: 0.1 }
            }
          },
          error: null
        }
      },
      overrides: null,
      candidates: [
        {
          model: 'anthropic/claude-sonnet-4',
          requested_model: 'anthropic/claude-sonnet-4',
          provider: 'anthropic',
          connection_owner: 'platform',
          pricing: null
        },
        {
          model: 'anthropic/claude-sonnet-4',
          requested_model: 'anthropic/claude-sonnet-4',
          provider: 'bedrock',
          connection_owner: 'customer',
          connection_id: 'apcn_2',
          vendor_model_id: 'anthropic.claude-sonnet-4',
          pricing: null,
          pricing_source: 'connection'
        }
      ]
    });
  });

  it('requires a definition for a draft test', async () => {
    await expect(
      virtualModelHandler('testDraft').run(request({ body: testBody, params: {} }), context)
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.test).not.toHaveBeenCalled();
  });

  it('tests the saved virtual model without a definition override', async () => {
    mocks.test.mockResolvedValue({
      ...testResult,
      virtualModel: { ...testResult.virtualModel, versionId: 'avmv_2', versionNumber: 2 }
    });

    let result = await virtualModelHandler('test').run(request({ body: testBody }), context);

    expect(mocks.test).toHaveBeenCalledWith({
      instance,
      virtualModel,
      input: {
        gatewayTokenId: 'agtk_1',
        dialect: 'openai_chat',
        body: testBody.request,
        metadata: { session_id: 's_1' },
        definition: undefined
      }
    });
    expect((await presented(result)).route).toMatchObject({
      version_id: 'avmv_2',
      version_number: 2
    });
  });

  it('rejects metadata with too many entries', async () => {
    let metadata = Object.fromEntries(
      Array.from({ length: 21 }, (_, index) => [`key_${index}`, 'value'])
    );

    await expect(
      virtualModelHandler('test').run(request({ body: { ...testBody, metadata } }), context)
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.test).not.toHaveBeenCalled();
  });

  it('replays recent requests and presents the changes', async () => {
    mocks.replay.mockResolvedValue({
      object: 'ai_gateway#virtual_model_replay',
      results: [
        {
          logId: 'ailog_1',
          receivedAt: new Date('2026-11-20T09:00:00Z'),
          original: { ruleId: null, model: 'openai/gpt-5-mini' },
          replayed: {
            ruleId: 'coding',
            model: 'anthropic/claude-sonnet-4',
            trace: [{ ruleId: 'coding', outcome: 'matched' }],
            decision: null
          },
          changed: true,
          error: null
        },
        {
          logId: 'ailog_2',
          receivedAt: new Date('2026-11-20T08:00:00Z'),
          original: { ruleId: 'coding', model: null },
          replayed: null,
          changed: true,
          error: 'No compatible model'
        }
      ],
      summary: { replayed: 2, changed: 2, decisionCostUsd: 0 }
    });

    let result = await virtualModelHandler('replay').run(
      request({ body: { limit: 2 } }),
      context
    );

    expect(mocks.replay).toHaveBeenCalledWith({
      instance,
      virtualModel,
      input: { definition: undefined, limit: 2 }
    });
    expect(await presented(result)).toEqual({
      object: 'ai_gateway.virtual_model.replay',
      results: [
        {
          inference_log_id: 'ailog_1',
          received_at: new Date('2026-11-20T09:00:00Z'),
          original: { rule_id: null, model: 'openai/gpt-5-mini' },
          replayed: {
            rule_id: 'coding',
            model: 'anthropic/claude-sonnet-4',
            trace: [{ rule_id: 'coding', outcome: 'matched', error: null }],
            decision: null
          },
          changed: true,
          error: null
        },
        {
          inference_log_id: 'ailog_2',
          received_at: new Date('2026-11-20T08:00:00Z'),
          original: { rule_id: 'coding', model: null },
          replayed: null,
          changed: true,
          error: 'No compatible model'
        }
      ],
      summary: { replayed: 2, changed: 2, decision_cost_usd: 0 }
    });
  });

  it('reads insights with the query numbers parsed from strings', async () => {
    mocks.insights.mockResolvedValue({
      object: 'ai_gateway#virtual_model_insights',
      since: new Date('2026-11-06T00:00:00Z'),
      days: 14,
      routes: [
        {
          ruleId: 'coding',
          model: 'anthropic/claude-sonnet-4',
          requests: 10,
          failed: 1,
          billedUsd: 0.5,
          inputTokens: 1000,
          outputTokens: 200,
          avgTotalMs: null
        }
      ],
      decision: { calls: 10, cached: 4, failed: 0, costUsd: 0.001, avgLatencyMs: 180 },
      billedUsd: 0.5,
      savings: {
        baselineModel: 'anthropic/claude-opus-4',
        baselineUsd: 2,
        spentUsd: 0.501,
        savedUsd: 1.499,
        priced: true
      }
    });

    let result = await virtualModelHandler('insights').run(
      request({ query: { days: '14', baseline_model: 'anthropic/claude-opus-4' } }),
      context
    );

    expect(mocks.insights).toHaveBeenCalledWith({
      instance,
      virtualModel,
      input: { days: 14, baselineModel: 'anthropic/claude-opus-4' }
    });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:read'] })
    );
    expect(await presented(result)).toMatchObject({
      object: 'ai_gateway.virtual_model.insights',
      days: 14,
      routes: [{ rule_id: 'coding', billed_usd: 0.5, avg_total_ms: null }],
      decision: { calls: 10, cost_usd: 0.001, avg_latency_ms: 180 },
      savings: { baseline_model: 'anthropic/claude-opus-4', saved_usd: 1.499 }
    });
  });

  it('lists virtual models', async () => {
    let result = await virtualModelHandler('list').run(request({ params: {} }), context);

    expect(mocks.list).toHaveBeenCalledWith({ instance });
    expect(await presented(result)).toMatchObject({
      items: [{ id: 'avm_1' }],
      pagination: { has_more_after: false, has_more_before: false }
    });
  });

  it.each([
    [{ 'ai-gateway-enabled': false, 'paid-ai-gateway': true }, 403],
    [{ 'ai-gateway-enabled': true, 'paid-ai-gateway': false }, 402]
  ])('enforces the AI gateway flags: %o', async (flags, status) => {
    mocks.getFlags.mockResolvedValue(flags);

    await expect(virtualModelHandler('get').run(request({}), context)).rejects.toMatchObject({
      data: { status }
    });
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('rejects callers without write access before calling the decision model', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(
      virtualModelHandler('test').run(request({ body: testBody }), context)
    ).rejects.toMatchObject({ data: { status: 403 } });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:write'] })
    );
    expect(mocks.test).not.toHaveBeenCalled();
  });
});

describe('ai gateway virtual model introspection', () => {
  let introspection = introspectApi({
    rootController: Controller.create(
      { name: 'Test', description: 'Test' },
      { virtualModels: aiGatewayVirtualModelController }
    ),
    displayVersion: 'mt_2026_01_01_magnetar',
    version: 'mt_2026_01_01_magnetar',
    isCurrent: true
  });

  let endpoint = (sdkPath: string) =>
    introspection.endpoints.find(endpoint => endpoint.path.sdkPath == sdkPath)!;

  it('keeps the draft test and the saved test on separate routes', () => {
    expect(endpoint('aiGateway.virtualModels.testDraft').method).toBe('post');
    expect(endpoint('aiGateway.virtualModels.testDraft').path.path).toBe(
      '/ai-gateway/virtual-models/test'
    );
    expect(endpoint('aiGateway.virtualModels.test').path.path).toBe(
      '/ai-gateway/virtual-models/:virtualModelId/test'
    );
    expect(endpoint('aiGateway.virtualModels.createFromTemplate').path.path).toBe(
      '/ai-gateway/virtual-models/from-template'
    );
  });

  it('exposes every route under the instance aliases', () => {
    expect(
      endpoint('aiGateway.virtualModels.delete').allPaths.map(
        (path: { path: string }) => path.path
      )
    ).toEqual([
      '/ai-gateway/virtual-models/:virtualModelId',
      '/instances/:instanceId/ai-gateway/virtual-models/:virtualModelId',
      '/dashboard/instances/:instanceId/ai-gateway/virtual-models/:virtualModelId'
    ]);
    expect(endpoint('aiGateway.virtualModels.delete').method).toBe('delete');
  });
});
