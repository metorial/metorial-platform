import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getFlags: vi.fn()
}));

vi.mock('./apiGroup', () => ({
  apiGroup: {
    createMiddleware: (handler: any) => (input: any) => (ctx: any) => handler(ctx, input)
  }
}));

vi.mock('@metorial/module-flags', () => ({
  flagService: { getFlags: mocks.getFlags },
  isFlagEnabled: (flag: any) => flag === true,
  getFlagDisabledReason: (flag: any) => (typeof flag == 'object' ? flag.reason : undefined)
}));

import { hasFlags } from './hasFlags';

describe('hasFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards project context and uses an explicit disabled reason', async () => {
    let organization = { id: 'org_1' };
    let project = { id: 'prj_1' };
    mocks.getFlags.mockResolvedValue({
      'callbacks-enabled': {
        enabled: false,
        reason: 'Callbacks are disabled for this project.'
      }
    });

    await expect(
      hasFlags(['callbacks-enabled'])({ organization, project } as any)
    ).rejects.toMatchObject({
      data: {
        status: 403,
        message: 'Callbacks are disabled for this project.'
      }
    });
    expect(mocks.getFlags).toHaveBeenCalledWith({ organization, project });
  });

  it('uses the generic forbidden message for a non-paid false flag', async () => {
    mocks.getFlags.mockResolvedValue({ 'callbacks-enabled': false });

    await expect(
      hasFlags(['callbacks-enabled'])({ organization: { id: 'org_1' } } as any)
    ).rejects.toMatchObject({
      data: {
        status: 403,
        message: 'You are not entitled to access this endpoint'
      }
    });
  });

  it('uses the upgrade message for a paid false flag', async () => {
    mocks.getFlags.mockResolvedValue({ 'paid-callbacks': false });

    await expect(
      hasFlags(['paid-callbacks'])({ organization: { id: 'org_1' } } as any)
    ).rejects.toMatchObject({
      data: {
        status: 402,
        message: 'Please upgrade to a different plan to access this feature'
      }
    });
  });
});
