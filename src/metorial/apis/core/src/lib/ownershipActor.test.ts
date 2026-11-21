import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getOwnershipAccess: vi.fn(),
  invalidateOwnershipAccessor: vi.fn(),
  ensureInternalConsumerSurface: vi.fn(),
  ensureConsumerProfile: vi.fn(),
  ensureDefaultConsumerActor: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  ownershipAccessService: {
    getOwnershipAccess: mocks.getOwnershipAccess,
    invalidateOwnershipAccessor: mocks.invalidateOwnershipAccessor
  }
}));

vi.mock('@metorial/module-consumer-core', () => ({
  consumerSurfaceService: {
    ensureInternalConsumerSurface: mocks.ensureInternalConsumerSurface
  },
  consumerProfileService: { ensureConsumerProfile: mocks.ensureConsumerProfile }
}));

vi.mock('@metorial/module-consumer-entities', () => ({
  consumerActorService: { ensureDefaultConsumerActor: mocks.ensureDefaultConsumerActor }
}));

import { getOwnershipActor, resolveExplorerOwner } from './ownershipActor';

let ctx = {
  instance: { id: 'ins_1' },
  actor: { id: 'oac_1' },
  member: { id: 'mem_1' },
  auth: { type: 'user', user: { name: 'Alex', email: 'alex@example.com' } },
  auditScope: {}
} as any;

describe('explorer caller ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getOwnershipAccess.mockResolvedValue({ kind: 'member', isEnforced: true });
    mocks.ensureInternalConsumerSurface.mockResolvedValue({ id: 'csf_1' });
    mocks.ensureConsumerProfile.mockResolvedValue({ id: 'cpf_1' });
    mocks.ensureDefaultConsumerActor.mockResolvedValue({ id: 'act_1' });
  });

  it('resolves the member owner from the authenticated user on instance endpoints', async () => {
    expect(await resolveExplorerOwner(ctx, 'explorer')).toBe('act_1');
    expect(mocks.ensureConsumerProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        member: ctx.member,
        name: ctx.auth.user.name,
        email: ctx.auth.user.email
      })
    );
    expect(mocks.invalidateOwnershipAccessor).toHaveBeenCalledWith({
      instance: ctx.instance,
      organizationActor: ctx.actor
    });
  });

  it('does not assign an owner without an explorer source', async () => {
    expect(await resolveExplorerOwner(ctx, undefined)).toBeUndefined();
    expect(mocks.getOwnershipAccess).not.toHaveBeenCalled();
    expect(mocks.ensureDefaultConsumerActor).not.toHaveBeenCalled();
  });

  it('preserves projects without ownership enforcement', async () => {
    mocks.getOwnershipAccess.mockResolvedValue({ kind: 'member', isEnforced: false });

    expect(await resolveExplorerOwner(ctx, 'explorer')).toBeUndefined();
    expect(mocks.ensureDefaultConsumerActor).not.toHaveBeenCalled();
  });

  it('requires a member when explorer ownership is enforced', async () => {
    mocks.getOwnershipAccess.mockResolvedValue({ kind: 'machine', isEnforced: true });

    await expect(resolveExplorerOwner(ctx, 'explorer')).rejects.toMatchObject({
      data: { status: 400 }
    });
    expect(mocks.ensureDefaultConsumerActor).not.toHaveBeenCalled();
  });

  it('rejects explorer ownership without an authenticated user', async () => {
    await expect(
      resolveExplorerOwner({ ...ctx, auth: { type: 'machine' } }, 'explorer')
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.ensureDefaultConsumerActor).not.toHaveBeenCalled();
  });

  it('rejects consumer authentication even when a user is linked to the account', async () => {
    mocks.getOwnershipAccess.mockResolvedValue({ kind: 'consumer', isEnforced: true });

    await expect(
      resolveExplorerOwner({ ...ctx, member: undefined }, 'explorer')
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.ensureDefaultConsumerActor).not.toHaveBeenCalled();
  });
});

describe('ownership actor', () => {
  let memberActor = { id: 'oac_member', oid: 4n, type: 'member' } as any;
  let consumerActor = { id: 'oac_consumer', oid: 9n, type: 'consumer_profile' } as any;
  let consumerProfile = { id: 'cpf_1', organizationActor: consumerActor };

  it('uses the calling actor when no consumer profile is involved', () => {
    expect(getOwnershipActor({ actor: memberActor })).toBe(memberActor);
    expect(getOwnershipActor({})).toBeUndefined();
  });

  it('uses the consumer actor for a consumer that authenticated itself', () => {
    expect(getOwnershipActor({ consumerProfile })).toBe(consumerActor);
    expect(
      getOwnershipActor({
        actor: memberActor,
        consumerProfile,
        consumerProfileFromHeader: false
      })
    ).toBe(consumerActor);
  });

  it('keeps the calling actor when the consumer profile was selected by header', () => {
    expect(
      getOwnershipActor({
        actor: memberActor,
        consumerProfile,
        consumerProfileFromHeader: true
      })
    ).toBe(memberActor);
  });
});
