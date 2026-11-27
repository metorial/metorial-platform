import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { declarePresenter } from '@metorial/presenter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Group,
  Handler,
  Path
} from '../../../../../../../../platform/packages/rest/src/controller';
import { createGatewayLogPaginator } from '../../../../../../../../products/agents/modules/ai-gateway/src/lib/paginator';
import { v1AiGatewayInferenceLogPresenter } from '../../../../../../../../platform/presenters/src/implementation/aiGateway/inferenceLog';
import { aiGatewayInferenceLogType } from '../../../../../../../../platform/presenters/src/types';

let mocks = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  fetchPage: vi.fn(),
  resolveRef: vi.fn(),
  findForRefs: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-ai-gateway', () => ({
  aiGatewayConsumerService: { resolveRef: mocks.resolveRef, findForRefs: mocks.findForRefs },
  aiGatewayInferenceLogService: { get: mocks.get, list: mocks.list }
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
  aiGatewayInferenceLogPresenter: declarePresenter(aiGatewayInferenceLogType, {
    mt_2025_01_01_dashboard: v1AiGatewayInferenceLogPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayInferenceLogPresenter
  })
}));

let { aiGatewayInferenceLogController } = await import('./inferenceLog');

let logHandler = (method: keyof typeof aiGatewayInferenceLogController.handlers) => {
  let handler = aiGatewayInferenceLogController.handlers[method];
  if (!(handler instanceof Handler)) throw new Error('Expected an inference log handler');

  return handler;
};

let instance = { oid: 7n, id: 'ins_1', project: { oid: 8n }, organization: { oid: 9n } };
let context = {
  instance,
  organization: instance.organization,
  project: instance.project,
  auditScope: { organizationOid: 9n }
};

let receivedAt = new Date('2026-11-20T10:00:00.000Z');
let completedAt = new Date('2026-11-20T10:00:01.200Z');

let consumerPreview = { id: 'icon_1', name: 'Ada Lovelace', email: 'ada@example.com' };
let consumerLookup = (refs: Record<string, unknown> = { icon_1: consumerPreview }) => ({
  get: (ref: string | null) => (ref ? (refs[ref] ?? null) : null)
});

let log = {
  object: 'ai_gateway#inference_log',
  id: 'ilog_2',
  organizationId: 'gwo_1',
  projectId: 'gwp_1',
  instanceId: 'gwi_1',
  tokenId: 'agtk_1',
  consumerRef: 'icon_1',

  dialect: 'openai_chat',
  operation: 'stream',
  requestId: null,

  requestedModel: 'support-router',
  model: { id: 'mdl_1', slug: 'anthropic/claude-sonnet-4', labSlug: 'anthropic' },
  virtualModel: {
    id: 'vm_1',
    slug: 'support-router',
    versionId: 'vmv_1',
    versionNumber: 3,
    ruleId: 'rule_hard',
    reason: 'rule',
    trace: [{ ruleId: 'rule_hard', outcome: 'matched' }],
    targets: ['anthropic/claude-sonnet-4'],
    skippedTargets: [],
    decision: null
  },
  metadata: { 'Customer-Tier': 'gold' },
  route: {
    provider: 'anthropic',
    connectionOwner: 'customer',
    connectionId: 'pcon_1',
    vendorModelId: 'claude-sonnet-4-20250514'
  },
  attempts: [
    {
      provider: 'metorial',
      connectionOwner: 'platform',
      startedAt: receivedAt,
      durationMs: 300,
      outcome: 'failed',
      error: {
        code: 'upstream_error',
        message: 'Overloaded',
        stage: 'upstream',
        httpStatus: 529
      }
    },
    {
      provider: 'anthropic',
      connectionOwner: 'customer',
      connectionId: 'pcon_1',
      vendorModelId: 'claude-sonnet-4-20250514',
      startedAt: receivedAt,
      durationMs: 900,
      outcome: 'succeeded',
      error: null
    }
  ],

  status: 'succeeded',
  finishReason: 'stop',
  error: null,

  usage: {
    input: { total: 120, noCache: 100, cacheRead: 20, cacheWrite: 0 },
    output: { total: 40, text: 30, reasoning: 10 }
  },
  cost: {
    currency: 'USD',
    priced: true,
    components: {
      input: 0.0003,
      cacheRead: 0.000006,
      cacheWrite: 0,
      output: 0.00045,
      reasoning: 0.00015
    },
    totalUsd: 0.000906,
    pricingSource: 'offering'
  },

  timing: { receivedAt, completedAt, totalMs: 1200, upstreamMs: 900 },
  request: { messageCount: 3, toolCount: 0 },

  hasContent: true,
  expiresAt: new Date('2026-12-20T10:00:00.000Z')
};

let request = (input: { query?: Record<string, unknown> }) =>
  ({
    body: {},
    query: input.query ?? {},
    apiVersion: 'mt_2026_01_01_magnetar',
    auth: { type: 'machine' },
    params: { inferenceLogId: 'ilog_2' },
    sharedMiddlewareMemo: new Map()
  }) as any;

let presented = async (result: { response: any }) =>
  await result.response({ apiVersion: 'mt_2026_01_01_magnetar' }).run();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getFlags.mockResolvedValue({ 'ai-gateway-enabled': true, 'paid-ai-gateway': true });
  mocks.resolveRef.mockResolvedValue('icon_1');
  mocks.findForRefs.mockResolvedValue(consumerLookup());
  mocks.get.mockResolvedValue(log);
  mocks.fetchPage.mockResolvedValue({ items: [log], hasMore: true, nextCursor: 'ilog_2' });
  mocks.list.mockImplementation(() => createGatewayLogPaginator(mocks.fetchPage));
});

describe('ai gateway inference logs', () => {
  it('presents a log in snake_case, keeping metadata keys and dropping internal ids', async () => {
    let result = await logHandler('get').run(request({}), context);
    let body = await presented(result);

    expect(body).toMatchObject({
      object: 'ai_gateway.inference_log',
      id: 'ilog_2',
      token_id: 'agtk_1',
      consumer: { object: 'consumer#preview', ...consumerPreview },
      requested_model: 'support-router',
      model: { id: 'mdl_1', slug: 'anthropic/claude-sonnet-4', lab_slug: 'anthropic' },
      virtual_model: {
        version_number: 3,
        rule_id: 'rule_hard',
        trace: [{ rule_id: 'rule_hard', outcome: 'matched', error: null }],
        skipped_targets: []
      },
      metadata: { 'Customer-Tier': 'gold' },
      route: {
        provider: 'anthropic',
        connection_owner: 'customer',
        connection_id: 'pcon_1',
        vendor_model_id: 'claude-sonnet-4-20250514'
      },
      attempts: [
        {
          provider: 'metorial',
          connection_owner: 'platform',
          connection_id: null,
          vendor_model_id: null,
          duration_ms: 300,
          error: { code: 'upstream_error', stage: 'upstream', http_status: 529, param: null }
        },
        { connection_id: 'pcon_1', outcome: 'succeeded', error: null }
      ],
      usage: {
        input: { total: 120, no_cache: 100, cache_read: 20, cache_write: 0 },
        output: { total: 40, text: 30, reasoning: 10 }
      },
      cost: {
        total_usd: 0.000906,
        components: { cache_read: 0.000006 },
        pricing_source: 'offering'
      },
      timing: {
        received_at: receivedAt,
        total_ms: 1200,
        upstream_ms: 900,
        first_token_at: null,
        time_to_first_token_ms: null
      },
      request: { message_count: 3, tool_count: 0, max_output_tokens: null, user_agent: null },
      has_content: true,
      content: null,
      created_at: receivedAt
    });
    expect(body).not.toHaveProperty('organization_id');
    expect(body).not.toHaveProperty('instance_id');
    expect(body).not.toHaveProperty('project_id');
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway.inference_log:read'] })
    );
  });

  it('only loads content when include_content is set', async () => {
    await logHandler('get').run(request({}), context);

    expect(mocks.get).toHaveBeenLastCalledWith({
      instance,
      inferenceLogId: 'ilog_2',
      includeContent: false
    });

    mocks.get.mockResolvedValue({
      ...log,
      content: { request: { messages: [{ role: 'user', content: 'Hi' }] }, response: null }
    });
    let result = await logHandler('get').run(
      request({ query: { include_content: 'true' } }),
      context
    );

    expect(mocks.get).toHaveBeenLastCalledWith({
      instance,
      inferenceLogId: 'ilog_2',
      includeContent: true
    });
    expect((await presented(result)).content).toEqual({
      request: { messages: [{ role: 'user', content: 'Hi' }] },
      response: null
    });
  });

  it('maps the list filters', async () => {
    await logHandler('list').run(
      request({
        query: {
          token_id: 'agtk_1',
          consumer_id: 'con_1',
          model: 'anthropic/claude-sonnet-4',
          virtual_model_id: 'vm_1',
          status: 'failed'
        }
      }),
      context
    );

    expect(mocks.list).toHaveBeenCalledWith({
      instance,
      gatewayTokenId: 'agtk_1',
      consumerRef: 'icon_1',
      modelSlug: 'anthropic/claude-sonnet-4',
      virtualModelId: 'vm_1',
      status: 'failed'
    });
  });

  it('rejects an unknown status', async () => {
    await expect(
      logHandler('list').run(request({ query: { status: 'pending' } }), context)
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('pages forward only', async () => {
    let first = await presented(await logHandler('list').run(request({}), context));

    expect(first.items[0].content).toBeNull();
    expect(first.pagination).toMatchObject({ has_more_after: true, has_more_before: false });
    expect(mocks.fetchPage).toHaveBeenLastCalledWith({ limit: 20, before: undefined });

    await logHandler('list').run(
      request({ query: { after: first.pagination.after } }),
      context
    );

    expect(mocks.fetchPage).toHaveBeenLastCalledWith({ limit: 20, before: 'ilog_2' });

    await expect(
      logHandler('list').run(request({ query: { before: 'ilog_2' } }), context)
    ).rejects.toMatchObject({ data: { status: 400 } });
  });

  it('requires the AI gateway flag', async () => {
    mocks.getFlags.mockResolvedValue({ 'ai-gateway-enabled': false, 'paid-ai-gateway': true });

    await expect(logHandler('get').run(request({}), context)).rejects.toMatchObject({
      data: { status: 403 }
    });
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('rejects callers without inference log access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(logHandler('list').run(request({}), context)).rejects.toMatchObject({
      data: { status: 403 }
    });
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
