import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  hasAccess: vi.fn(async (_ctx: any, _input: any) => true),
  isAiToolDetectionActive: vi.fn(async (_d: any) => true),
  getAgentActivity: vi.fn(async (_d: any) => ({ lastUsed: new Map(), complete: true })),
  getConsumerAgentActivity: vi.fn(async (_d: any) => ({ lastUsed: new Map(), complete: true }))
}));

vi.mock('../middleware/checkAccess', () => ({ hasAccess: mocks.hasAccess }));

vi.mock('@metorial/module-consumer-core', () => ({
  consumerDeviceSettingsService: { isAiToolDetectionActive: mocks.isAiToolDetectionActive }
}));

vi.mock('@metorial/module-agent-tracking-query', () => ({
  agentTrackingAgentActivityService: {
    getAgentActivity: mocks.getAgentActivity,
    getConsumerAgentActivity: mocks.getConsumerAgentActivity
  }
}));

import { getAiToolActivity } from './aiToolActivity';

let byAgent = { toolKeys: ['cursor'] };

let byConsumer = { toolKeys: ['cursor'], byConsumer: true };

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
  mocks.isAiToolDetectionActive.mockImplementation(async () => true);
});

describe('AI tool activity gate', () => {
  it('loads usage for a dashboard user who can read agent usage', async () => {
    expect(await getAiToolActivity(ctx(), byAgent)).toEqual({
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

  it('loads usage per consumer when asked', async () => {
    await getAiToolActivity(ctx(), byConsumer);

    expect(mocks.getConsumerAgentActivity).toHaveBeenCalledWith(
      expect.objectContaining({ agentKeys: ['cursor'] })
    );
    expect(mocks.getAgentActivity).not.toHaveBeenCalled();
  });

  it('hides usage from callers without agent usage access', async () => {
    mocks.hasAccess.mockImplementation(async () => false);

    expect(await getAiToolActivity(ctx(), byAgent)).toBeNull();
    expect(await getAiToolActivity(ctx(), byConsumer)).toBeNull();
    expect(mocks.getAgentActivity).not.toHaveBeenCalled();
    expect(mocks.getConsumerAgentActivity).not.toHaveBeenCalled();
  });

  it('hides usage from machine access, like the agent usage endpoints', async () => {
    expect(await getAiToolActivity(ctx({ type: 'machine' }), byAgent)).toBeNull();
    expect(
      await getAiToolActivity(ctx({ type: 'user', machineAccess: {} }), byConsumer)
    ).toBeNull();
    expect(mocks.hasAccess).not.toHaveBeenCalled();
  });

  it('hides usage while AI tool detection is off', async () => {
    mocks.isAiToolDetectionActive.mockImplementation(async () => false);

    expect(await getAiToolActivity(ctx(), byAgent)).toBeNull();
    expect(await getAiToolActivity(ctx(), byConsumer)).toBeNull();
    expect(mocks.getAgentActivity).not.toHaveBeenCalled();
    expect(mocks.getConsumerAgentActivity).not.toHaveBeenCalled();
  });
});
