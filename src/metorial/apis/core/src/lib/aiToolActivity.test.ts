import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  hasAccess: vi.fn(async (_ctx: any, _input: any) => true),
  isAiToolDetectionEnabled: vi.fn(async (_d: any) => true),
  getAgentActivity: vi.fn(async (_d: any) => ({ lastUsed: new Map(), complete: true })),
  getConsumerAgentActivity: vi.fn(async (_d: any) => ({ lastUsed: new Map(), complete: true }))
}));

vi.mock('../middleware/checkAccess', () => ({ hasAccess: mocks.hasAccess }));

vi.mock('@metorial/module-consumer-core', () => ({
  consumerDeviceSettingsService: { isAiToolDetectionEnabled: mocks.isAiToolDetectionEnabled }
}));

vi.mock('@metorial/module-agent-tracking-query', () => ({
  agentTrackingAgentActivityService: {
    getAgentActivity: mocks.getAgentActivity,
    getConsumerAgentActivity: mocks.getConsumerAgentActivity
  }
}));

import { getAiToolActivity, getAiToolConsumerActivity } from './aiToolActivity';

let ctx = (auth: Record<string, unknown> = { type: 'user' }) =>
  ({
    auth,
    organization: { id: 'org_1' },
    project: { id: 'proj_1' },
    instance: { oid: 3n, id: 'inst_1' }
  }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasAccess.mockImplementation(async () => true);
  mocks.isAiToolDetectionEnabled.mockImplementation(async () => true);
});

describe('AI tool activity gate', () => {
  it('loads usage for a dashboard user who can read agent usage', async () => {
    expect(await getAiToolActivity(ctx(), ['cursor'])).toEqual({
      lastUsed: new Map(),
      complete: true
    });
    expect(mocks.hasAccess).toHaveBeenCalledWith(expect.anything(), {
      possibleScopes: ['instance.agent_tracking:read']
    });
    expect(mocks.getAgentActivity).toHaveBeenCalledWith(
      expect.objectContaining({ agentKeys: ['cursor'] })
    );
  });

  it('hides usage from callers without agent usage access', async () => {
    mocks.hasAccess.mockImplementation(async () => false);

    expect(await getAiToolActivity(ctx(), ['cursor'])).toBeNull();
    expect(await getAiToolConsumerActivity(ctx(), ['cursor'])).toBeNull();
    expect(mocks.getAgentActivity).not.toHaveBeenCalled();
    expect(mocks.getConsumerAgentActivity).not.toHaveBeenCalled();
  });

  it('hides usage from machine access, like the agent usage endpoints', async () => {
    expect(await getAiToolActivity(ctx({ type: 'machine' }), ['cursor'])).toBeNull();
    expect(
      await getAiToolConsumerActivity(ctx({ type: 'user', machineAccess: {} }), ['cursor'])
    ).toBeNull();
    expect(mocks.hasAccess).not.toHaveBeenCalled();
  });

  it('hides usage while AI tool detection is off', async () => {
    mocks.isAiToolDetectionEnabled.mockImplementation(async () => false);

    expect(await getAiToolActivity(ctx(), ['cursor'])).toBeNull();
    expect(await getAiToolConsumerActivity(ctx(), ['cursor'])).toBeNull();
    expect(mocks.getAgentActivity).not.toHaveBeenCalled();
    expect(mocks.getConsumerAgentActivity).not.toHaveBeenCalled();
  });
});
