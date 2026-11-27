import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  granted: new Set<string>(),
  flags: {} as Record<string, unknown>,
  hasAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('./checkAccess', () => ({ hasAccess: mocks.hasAccess }));

vi.mock('@metorial/module-flags', () => ({
  flagService: { getFlags: mocks.getFlags },
  isFlagEnabled: (value: unknown) => value === true
}));

import {
  createIntegrationsAccess,
  requireToolCallReadAccess,
  withIntegrationsAccess
} from './integrationsAccess';

let ctx = {
  auth: { type: 'user' },
  organization: { id: 'org_1' },
  project: { id: 'proj_1' },
  instance: { oid: 3n, id: 'inst_1' }
} as any;

let checkedScopes = () =>
  mocks.hasAccess.mock.calls.map(([, input]) => input.possibleScopes[0]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.granted = new Set([
    'instance.provider.session:read',
    'instance.provider:read',
    'instance.skill:read'
  ]);
  mocks.flags = { 'paid-integrations': true, 'skills-enabled': true };
  mocks.hasAccess.mockImplementation(async (_ctx: any, input: { possibleScopes: string[] }) =>
    input.possibleScopes.some(scope => mocks.granted.has(scope))
  );
  mocks.getFlags.mockImplementation(async () => mocks.flags);
});

describe('createIntegrationsAccess', () => {
  it('grants each read with its flag and scope, sharing one flag lookup', async () => {
    let access = createIntegrationsAccess(ctx);

    expect([
      await access.toolCalls(),
      await access.providers(),
      await access.skills()
    ]).toEqual([true, true, true]);
    expect(mocks.getFlags).toHaveBeenCalledTimes(1);
    expect(mocks.getFlags).toHaveBeenCalledWith({
      organization: ctx.organization,
      project: ctx.project
    });
  });

  it('checks only the scope of the read a handler asks for, once per request', async () => {
    let access = createIntegrationsAccess(ctx);
    expect(mocks.getFlags).not.toHaveBeenCalled();

    expect(await Promise.all([access.providers(), access.providers()])).toEqual([true, true]);

    expect(checkedScopes()).toEqual(['instance.provider:read']);
  });

  it('refuses tool calls and providers while integrations are off, without checking scopes', async () => {
    mocks.flags = { 'paid-integrations': false, 'skills-enabled': true };
    let access = createIntegrationsAccess(ctx);

    expect(await access.toolCalls()).toBe(false);
    expect(await access.providers()).toBe(false);
    expect(await access.skills()).toBe(true);
    expect(checkedScopes()).toEqual(['instance.skill:read']);
  });

  it('refuses skills while skills are off', async () => {
    mocks.flags = { 'paid-integrations': true };

    expect(await createIntegrationsAccess(ctx).skills()).toBe(false);
  });

  it('refuses each read whose scope the caller lacks', async () => {
    mocks.granted = new Set(['instance.provider:read']);
    let access = createIntegrationsAccess(ctx);

    expect(await access.toolCalls()).toBe(false);
    expect(await access.providers()).toBe(true);
    expect(await access.skills()).toBe(false);
  });
});

describe('requireToolCallReadAccess', () => {
  let run = async () =>
    requireToolCallReadAccess()({ ...ctx, ...(await withIntegrationsAccess()(ctx)) });

  it('lets a caller who can read tool calls through', async () => {
    await expect(run()).resolves.toBeUndefined();
    expect(checkedScopes()).toEqual(['instance.provider.session:read']);
  });

  it('refuses with 403 while integrations are off or without the scope', async () => {
    mocks.flags = { 'paid-integrations': false };
    await expect(run()).rejects.toMatchObject({ data: { status: 403 } });

    mocks.flags = { 'paid-integrations': true };
    mocks.granted = new Set(['instance.provider:read']);
    await expect(run()).rejects.toMatchObject({ data: { status: 403 } });
  });
});
