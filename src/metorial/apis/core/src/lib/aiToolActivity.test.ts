import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  hasAccess: vi.fn(async (_ctx: any, _input: any) => true),
  getAgentActivity: vi.fn(async (_d: any) => ({ lastUsed: new Map(), complete: true })),
  getConsumerAgentActivity: vi.fn(async (_d: any) => ({ lastUsed: new Map(), complete: true }))
}));

vi.mock('../middleware/checkAccess', () => ({ hasAccess: mocks.hasAccess }));

vi.mock('@metorial/module-agent-tracking-query', () => ({
  agentTrackingAgentActivityService: {
    getAgentActivity: mocks.getAgentActivity,
    getConsumerAgentActivity: mocks.getConsumerAgentActivity
  }
}));

import { getAiToolActivity } from './aiToolActivity';

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
});

describe('getAiToolActivity', () => {
  it('asks for usage per agent as the reader the request comes from', async () => {
    await getAiToolActivity(ctx(), { toolKeys: ['cursor'] });

    expect(mocks.hasAccess).toHaveBeenCalledWith(expect.anything(), {
      possibleScopes: ['instance.agent_tracking:read']
    });
    expect(mocks.getAgentActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKeys: ['cursor'],
        reader: { isHuman: true, canReadAgentUsage: true }
      })
    );
    expect(mocks.getConsumerAgentActivity).not.toHaveBeenCalled();
  });

  it('asks for usage per consumer when asked, and passes machine access on as no person', async () => {
    mocks.hasAccess.mockImplementation(async () => false);

    await getAiToolActivity(ctx({ type: 'user', machineAccess: {} }), {
      toolKeys: ['cursor'],
      byConsumer: true
    });

    expect(mocks.getConsumerAgentActivity).toHaveBeenCalledWith(
      expect.objectContaining({ reader: { isHuman: false, canReadAgentUsage: false } })
    );
    expect(mocks.getAgentActivity).not.toHaveBeenCalled();
  });
});
