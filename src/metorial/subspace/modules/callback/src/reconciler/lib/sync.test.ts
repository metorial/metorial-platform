import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  callbackDestinationUpdateMany: vi.fn(),
  callbackInstanceFindUniqueOrThrow: vi.fn(),
  callbackInstanceUpdate: vi.fn(),
  callbackInstanceUpdateMany: vi.fn(),
  loadFreshCallback: vi.fn(),
  loadFreshCallbackInstance: vi.fn(),
  isCallbackSupported: vi.fn(),
  isPairUsable: vi.fn(),
  signalCallbackUpsert: vi.fn(),
  signalCallbackArchive: vi.fn(),
  registrationDelete: vi.fn(),
  registrationRevokePathSecrets: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    callbackDestination: { updateMany: mocks.callbackDestinationUpdateMany },
    callbackInstance: {
      findUniqueOrThrow: mocks.callbackInstanceFindUniqueOrThrow,
      update: mocks.callbackInstanceUpdate,
      updateMany: mocks.callbackInstanceUpdateMany
    }
  },
  withTransaction: vi.fn(
    async callback =>
      await callback({
        callbackInstance: { update: mocks.callbackInstanceUpdate }
      })
  )
}));

vi.mock('@metorial-subspace/module-auth', () => ({
  tombstoneProvisionedTenantAppsForCallbackInTransaction: vi.fn()
}));

vi.mock('@metorial-subspace/provider-slates/src/client', () => ({
  slates: {
    callbackRegistration: {
      get: vi.fn(),
      upsert: vi.fn(),
      delete: mocks.registrationDelete,
      revokePathSecrets: mocks.registrationRevokePathSecrets
    }
  }
}));

vi.mock('../../signal', () => ({
  getTenantForSignal: async () => ({ id: 'stn_1' }),
  signal: {
    callback: {
      upsert: mocks.signalCallbackUpsert,
      archive: mocks.signalCallbackArchive
    }
  }
}));

vi.mock('./state', () => ({
  TRIGGER_PAGE_SIZE: 100,
  getTenantForSlatesCached: vi.fn(),
  isCallbackSupported: mocks.isCallbackSupported,
  isPairUsable: mocks.isPairUsable,
  loadCallback: vi.fn(),
  loadFreshCallback: mocks.loadFreshCallback,
  loadCallbackInstance: vi.fn(),
  loadFreshCallbackInstance: mocks.loadFreshCallbackInstance
}));

import {
  applyCallbackRegistrationMirror,
  buildCallbackRegistrationMirror,
  detachRegistration,
  syncCallbackInstance,
  syncSignalCallback
} from './sync';

let receiver = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'receiver_1',
    callbackOwnerVersion: 3,
    receiverPathSecret: {
      id: 'secret_1',
      generation: 2,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
      updatedAt: new Date('2026-08-21T00:00:00.000Z')
    },
    triggers: [
      {
        id: 'trigger_1',
        active: true,
        authoritativeStateVersion: 4,
        triggerId: 'provider_trigger_1',
        triggerKey: 'order.updated',
        triggerName: 'Order updated',
        source: 'webhook',
        eventTypes: ['order.updated'],
        pollIntervalSeconds: null,
        nextPollAt: null,
        lastPolledAt: null,
        webhookUrl: 'https://hub.test/trigger_1',
        registrationStatus: 'registered',
        registrationGeneration: 2,
        registrationTransitionVersion: 5,
        registrationError: null,
        verificationMechanism: 'hub',
        verificationSpecHash: 'a'.repeat(64),
        isWebhookRegistered: true
      }
    ],
    ...overrides
  }) as any;

let callback = (overrides: Record<string, unknown> = {}) => ({
  oid: 900n,
  id: 'callback_1',
  tenantOid: 10n,
  status: 'active',
  name: 'Order updates',
  description: null,
  tenant: { oid: 10n },
  environment: { id: 'env_1' },
  callbackDestinationLinks: [
    {
      callbackDestination: {
        id: 'destination_1',
        name: 'Ops',
        description: null,
        url: 'https://example.com/hooks',
        method: 'POST',
        status: 'active'
      }
    }
  ],
  callbackProviderTriggers: [{ eventTypes: ['order.updated'] }],
  ...overrides
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callbackInstanceFindUniqueOrThrow.mockResolvedValue({
    registrationMirrorVersion: 7,
    registrationReceiverAuthorityVersion: 2,
    slateTriggerReceiverId: 'receiver_1'
  });
  mocks.callbackInstanceUpdateMany.mockResolvedValue({ count: 1 });
  mocks.isCallbackSupported.mockReturnValue(true);
  mocks.isPairUsable.mockReturnValue(true);
  mocks.signalCallbackUpsert.mockResolvedValue({
    destinations: [{ destination: { externalId: 'destination_1', id: 'signal_1' } }]
  });
});

describe('callback registration mirror', () => {
  it('aggregates I3 trigger lifecycle and path-secret metadata', () => {
    let mirror = buildCallbackRegistrationMirror(receiver());

    expect(mirror).toMatchObject({
      registrationStatus: 'registered',
      registrationGeneration: 2,
      registrationTransitionVersion: 5,
      verificationMechanism: 'hub',
      verificationSpecHash: 'a'.repeat(64),
      registrationPublicSnapshot: {
        receiverId: 'receiver_1',
        callbackOwnerVersion: 3,
        receiverPathSecret: { id: 'secret_1', generation: 2 }
      }
    });
  });

  it('does not let a polling trigger downgrade registered webhooks', () => {
    let pollingTrigger = {
      ...receiver().triggers[0],
      id: 'poll_1',
      source: 'polling',
      registrationStatus: 'unregistered',
      isWebhookRegistered: null
    };
    let mirror = buildCallbackRegistrationMirror(
      receiver({ triggers: [...receiver().triggers, pollingTrigger] })
    );

    expect(mirror.registrationStatus).toBe('registered');
  });

  it('ignores volatile polling timestamps at an equal authority version', async () => {
    let polling = {
      ...receiver().triggers[0],
      source: 'polling',
      registrationStatus: 'unregistered',
      isWebhookRegistered: null,
      nextPollAt: new Date('2026-08-22T12:00:00.000Z'),
      lastPolledAt: new Date('2026-08-22T11:50:00.000Z')
    };
    let stored = buildCallbackRegistrationMirror(receiver({ triggers: [polling] }));
    mocks.callbackInstanceFindUniqueOrThrow.mockResolvedValue({
      registrationPublicSnapshot: stored.registrationPublicSnapshot,
      registrationMirrorVersion: 7,
      registrationReceiverAuthorityVersion: 3,
      slateTriggerReceiverId: 'receiver_1'
    });

    await expect(
      applyCallbackRegistrationMirror({
        callbackInstanceOid: 100n,
        receiver: receiver({
          triggers: [
            {
              ...polling,
              nextPollAt: new Date('2026-08-22T12:10:00.000Z'),
              lastPolledAt: new Date('2026-08-22T12:00:00.000Z')
            }
          ]
        }),
        expectedReceiverId: 'receiver_1',
        expectedReceiverAuthorityVersion: 3
      })
    ).resolves.toBe('unchanged');
    expect(mocks.callbackInstanceUpdateMany).not.toHaveBeenCalled();
  });

  it('clears a stale sync error when the authoritative mirror is unchanged', async () => {
    let stored = buildCallbackRegistrationMirror(receiver());
    mocks.callbackInstanceFindUniqueOrThrow.mockResolvedValue({
      registrationPublicSnapshot: stored.registrationPublicSnapshot,
      registrationMirrorVersion: 7,
      registrationReceiverAuthorityVersion: 3,
      slateTriggerReceiverId: 'receiver_1',
      lastRegistrationSyncErrorCode: 'registration_sync_failed',
      lastSyncErrorCode: 'registration_sync_failed'
    });

    await expect(
      applyCallbackRegistrationMirror({
        callbackInstanceOid: 100n,
        receiver: receiver(),
        expectedReceiverId: 'receiver_1',
        expectedReceiverAuthorityVersion: 3
      })
    ).resolves.toBe('unchanged');
    expect(mocks.callbackInstanceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastRegistrationSyncErrorCode: null,
          lastSyncErrorCode: null
        })
      })
    );
  });

  it('advances the local owner mirror with a CAS update', async () => {
    await expect(
      applyCallbackRegistrationMirror({
        callbackInstanceOid: 100n,
        receiver: receiver(),
        expectedReceiverId: 'receiver_1',
        expectedReceiverAuthorityVersion: 2
      })
    ).resolves.toBe('applied');

    expect(mocks.callbackInstanceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          registrationMirrorVersion: 7,
          registrationReceiverAuthorityVersion: 2
        }),
        data: expect.objectContaining({
          registrationReceiverAuthorityVersion: 3,
          slateTriggerReceiverId: 'receiver_1'
        })
      })
    );
  });
});

describe('callback teardown', () => {
  it('revokes path secrets before deleting and committing the Hub owner version', async () => {
    let order: string[] = [];
    mocks.registrationRevokePathSecrets.mockImplementation(async () => {
      order.push('revoke');
      return { revoked: true };
    });
    mocks.registrationDelete.mockImplementation(async () => {
      order.push('delete');
      return receiver();
    });

    await detachRegistration({
      callbackInstanceOid: 100n,
      callbackInstanceId: 'instance_1',
      callbackId: 'callback_1',
      slateTriggerReceiverId: 'receiver_1',
      expectedReceiverAuthorityVersion: 2,
      slatesTenantId: 'tenant_1'
    });

    expect(order).toEqual(['revoke', 'delete']);
    expect(mocks.callbackInstanceUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('does not advance local ownership when Hub revocation fails', async () => {
    mocks.registrationRevokePathSecrets.mockRejectedValue(new Error('hub unavailable'));

    await expect(
      detachRegistration({
        callbackInstanceOid: 100n,
        callbackInstanceId: 'instance_1',
        callbackId: 'callback_1',
        slateTriggerReceiverId: 'receiver_1',
        expectedReceiverAuthorityVersion: 2,
        slatesTenantId: 'tenant_1'
      })
    ).rejects.toThrow('hub unavailable');

    expect(mocks.registrationDelete).not.toHaveBeenCalled();
    expect(mocks.callbackInstanceUpdateMany).not.toHaveBeenCalled();
    expect(mocks.callbackInstanceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastRegistrationSyncErrorCode: 'registration_sync_failed'
        })
      })
    );
  });

  it('detaches a projection whose integration provider lifecycle is no longer usable', async () => {
    mocks.loadFreshCallbackInstance.mockResolvedValue({
      oid: 100n,
      id: 'instance_1',
      status: 'attached',
      slateTriggerReceiverId: null,
      callback: callback({
        callbackProviderTriggers: [
          { providerTrigger: { specId: 'trigger_1' }, eventTypes: [] }
        ]
      }),
      integrationInstance: {
        status: 'active',
        isParentDeleted: false
      },
      integrationInstanceProvider: {
        status: 'archived',
        isParentDeleted: false
      },
      providerDeploymentConfigPair: {}
    });

    await syncCallbackInstance({
      callbackInstanceId: 'instance_1',
      fresh: true,
      skipSignalSync: true,
      throwOnError: true
    });

    expect(mocks.callbackInstanceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 100n },
        data: expect.objectContaining({ status: 'detached' })
      })
    );
  });
});

describe('single callback path', () => {
  it('always synchronizes Signal without a V2 gate', async () => {
    mocks.loadFreshCallback.mockResolvedValue(callback());

    await syncSignalCallback({ callbackId: 'callback_1', fresh: true });

    expect(mocks.signalCallbackUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackId: 'callback_1',
        eventTypes: ['order.updated']
      })
    );
    expect(mocks.callbackDestinationUpdateMany).toHaveBeenCalledTimes(1);
  });
});
