import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { declarePresenter } from '@metorial/presenter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Group,
  Handler,
  Path
} from '../../../../../../../platform/packages/rest/src/controller';
import { v1AiGatewayUsageTimelinePresenter } from '../../../../../../presenters/src/implementation/aiGateway/usage';
import { aiGatewayUsageTimelineType } from '../../../../../../presenters/src/types';

let mocks = vi.hoisted(() => ({
  timeline: vi.fn(),
  resolveRef: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-ai-gateway', () => ({
  aiGatewayConsumerService: { resolveRef: mocks.resolveRef },
  aiGatewayUsageService: { timeline: mocks.timeline }
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
  aiGatewayUsageTimelinePresenter: declarePresenter(aiGatewayUsageTimelineType, {
    mt_2025_01_01_dashboard: v1AiGatewayUsageTimelinePresenter,
    mt_2026_01_01_magnetar: v1AiGatewayUsageTimelinePresenter
  })
}));

let { aiGatewayUsageController } = await import('./usage');

let timelineHandler = () => {
  let handler = aiGatewayUsageController.handlers.timeline;
  if (!(handler instanceof Handler)) throw new Error('Expected a usage handler');

  return handler;
};

let instance = { oid: 7n, id: 'ins_1', project: { oid: 8n }, organization: { oid: 9n } };
let context = {
  instance,
  organization: instance.organization,
  project: instance.project,
  auditScope: { organizationOid: 9n }
};

let from = new Date('2026-11-20T00:00:00.000Z');
let to = new Date('2026-11-20T02:00:00.000Z');

let usage = {
  object: 'ai_gateway#usage_timeline',
  interval: '1h',
  from,
  to,
  buckets: [
    {
      start: from,
      requests: 4,
      succeeded: 2,
      failed: 1,
      cancelled: 0,
      rejected: 1,
      inputTokens: 1200,
      cachedInputTokens: 200,
      outputTokens: 300,
      costUsd: 0.012,
      platformCostUsd: 0.004,
      averageLatencyMs: 850
    },
    {
      start: new Date('2026-11-20T01:00:00.000Z'),
      requests: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
      rejected: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      platformCostUsd: 0,
      averageLatencyMs: null
    }
  ]
};

let request = (query: Record<string, unknown>) =>
  ({
    body: {},
    query,
    apiVersion: 'mt_2026_01_01_magnetar',
    auth: { type: 'machine' },
    params: {},
    sharedMiddlewareMemo: new Map()
  }) as any;

let presented = async (result: { response: any }) =>
  await result.response({ apiVersion: 'mt_2026_01_01_magnetar' }).run();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getFlags.mockResolvedValue({ 'ai-gateway-enabled': true, 'paid-ai-gateway': true });
  mocks.resolveRef.mockResolvedValue('icon_1');
  mocks.timeline.mockResolvedValue(usage);
});

describe('ai gateway usage timeline', () => {
  it('maps the query and presents the buckets in snake_case', async () => {
    let result = await timelineHandler().run(
      request({
        from: from.toISOString(),
        to: to.toISOString(),
        interval: '1h',
        token_id: 'agtk_1',
        consumer_id: 'con_1',
        model: 'anthropic/claude-sonnet-4',
        virtual_model_id: 'vm_1'
      }),
      context
    );

    expect(mocks.timeline).toHaveBeenCalledWith({
      instance,
      input: {
        from,
        to,
        interval: '1h',
        gatewayTokenId: 'agtk_1',
        consumerRef: 'icon_1',
        modelSlug: 'anthropic/claude-sonnet-4',
        virtualModelId: 'vm_1'
      }
    });
    expect(await presented(result)).toEqual({
      object: 'ai_gateway.usage_timeline',
      interval: '1h',
      from,
      to,
      buckets: [
        {
          start: from,
          requests: 4,
          succeeded: 2,
          failed: 1,
          cancelled: 0,
          rejected: 1,
          input_tokens: 1200,
          cached_input_tokens: 200,
          output_tokens: 300,
          cost_usd: 0.012,
          metorial_cost_usd: 0.004,
          average_latency_ms: 850
        },
        expect.objectContaining({ requests: 0, average_latency_ms: null })
      ]
    });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:read'] })
    );
  });

  it.each([
    [{ from: from.toISOString(), to: to.toISOString(), interval: '1m' }],
    [{ to: to.toISOString() }]
  ])('rejects an invalid query: %o', async query => {
    await expect(timelineHandler().run(request(query), context)).rejects.toMatchObject({
      data: { status: 400 }
    });
    expect(mocks.timeline).not.toHaveBeenCalled();
  });

  it('requires the paid AI gateway flag', async () => {
    mocks.getFlags.mockResolvedValue({ 'ai-gateway-enabled': true, 'paid-ai-gateway': false });

    await expect(
      timelineHandler().run(
        request({ from: from.toISOString(), to: to.toISOString() }),
        context
      )
    ).rejects.toMatchObject({ data: { status: 402 } });
    expect(mocks.timeline).not.toHaveBeenCalled();
  });

  it('rejects callers without read access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(
      timelineHandler().run(
        request({ from: from.toISOString(), to: to.toISOString() }),
        context
      )
    ).rejects.toMatchObject({ data: { status: 403 } });
    expect(mocks.timeline).not.toHaveBeenCalled();
  });
});
