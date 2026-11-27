import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  assertAccess: vi.fn(async (_ctx: any, _input: any) => {}),
  getFlags: vi.fn(async (_d: any): Promise<Record<string, unknown>> => ({
    'paid-integrations': true
  }))
}));

vi.mock('../middleware/checkAccess', () => ({ assertAccess: mocks.assertAccess }));

vi.mock('@metorial/module-flags', () => ({
  flagService: { getFlags: mocks.getFlags },
  isFlagEnabled: (value: unknown) => value === true
}));

import { canReadProviders, canReadToolCalls } from './toolCallAccess';

let ctx = {
  auth: { type: 'user' },
  organization: { id: 'org_1' },
  project: { id: 'proj_1' },
  instance: { oid: 3n, id: 'inst_1' }
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertAccess.mockImplementation(async () => {});
  mocks.getFlags.mockImplementation(async () => ({ 'paid-integrations': true }));
});

describe('canReadToolCalls', () => {
  it('allows a caller with the tool call read scope while integrations are on', async () => {
    expect(await canReadToolCalls(ctx)).toBe(true);
    expect(mocks.getFlags).toHaveBeenCalledWith({
      organization: ctx.organization,
      project: ctx.project
    });
    expect(mocks.assertAccess).toHaveBeenCalledWith(ctx, {
      possibleScopes: ['instance.provider.session:read']
    });
  });

  it('refuses without checking the scope while integrations are off', async () => {
    mocks.getFlags.mockImplementation(async () => ({ 'paid-integrations': false }));

    expect(await canReadToolCalls(ctx)).toBe(false);
    expect(mocks.assertAccess).not.toHaveBeenCalled();
  });

  it('refuses a caller without the scope', async () => {
    mocks.assertAccess.mockImplementation(async () => {
      throw new ServiceError(forbiddenError({ message: 'No' }));
    });

    expect(await canReadToolCalls(ctx)).toBe(false);
  });

  it('lets any other failure surface', async () => {
    mocks.assertAccess.mockImplementation(async () => {
      throw new ServiceError(notFoundError('instance', 'inst_1'));
    });
    await expect(canReadToolCalls(ctx)).rejects.toMatchObject({ data: { status: 404 } });

    mocks.assertAccess.mockImplementation(async () => {
      throw new Error('Database unavailable');
    });
    await expect(canReadToolCalls(ctx)).rejects.toThrow('Database unavailable');

    mocks.getFlags.mockImplementation(async () => {
      throw new Error('Flags unavailable');
    });
    await expect(canReadToolCalls(ctx)).rejects.toThrow('Flags unavailable');
  });
});

describe('canReadProviders', () => {
  it('allows a caller with the provider read scope while integrations are on', async () => {
    expect(await canReadProviders(ctx)).toBe(true);
    expect(mocks.assertAccess).toHaveBeenCalledWith(ctx, {
      possibleScopes: ['instance.provider:read']
    });
  });

  it('refuses while integrations are off or without the scope', async () => {
    mocks.getFlags.mockImplementation(async () => ({ 'paid-integrations': false }));
    expect(await canReadProviders(ctx)).toBe(false);
    expect(mocks.assertAccess).not.toHaveBeenCalled();

    mocks.getFlags.mockImplementation(async () => ({ 'paid-integrations': true }));
    mocks.assertAccess.mockImplementation(async () => {
      throw new ServiceError(forbiddenError({ message: 'No' }));
    });
    expect(await canReadProviders(ctx)).toBe(false);
  });
});
