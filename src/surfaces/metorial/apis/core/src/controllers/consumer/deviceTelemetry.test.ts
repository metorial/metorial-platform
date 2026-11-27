import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ canIssueAgentTrackingKeys: vi.fn() }));

vi.mock('@metorial/module-agent-tracking-sync', () => ({
  canIssueAgentTrackingKeys: mocks.canIssueAgentTrackingKeys
}));

import { requireDeviceTelemetry } from './deviceTelemetry';

let ctx = { organization: { id: 'org_1' }, project: { id: 'proj_1' } } as any;

describe('requireDeviceTelemetry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('answers 404 while device tokens cannot be issued for the organization', async () => {
    mocks.canIssueAgentTrackingKeys.mockResolvedValue(false);

    await expect(requireDeviceTelemetry(ctx)).rejects.toMatchObject({
      data: { status: 404, code: 'not_found' }
    });
  });

  it('lets the request through when device tokens can be issued', async () => {
    mocks.canIssueAgentTrackingKeys.mockResolvedValue(true);

    await expect(requireDeviceTelemetry(ctx)).resolves.toBeUndefined();
    expect(mocks.canIssueAgentTrackingKeys).toHaveBeenCalledWith({
      organization: ctx.organization,
      project: ctx.project
    });
  });
});
