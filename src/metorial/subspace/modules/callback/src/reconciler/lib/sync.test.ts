import { beforeEach, describe, expect, it, vi } from 'vitest';

let state = vi.hoisted(() => ({
  findUniqueOrThrow: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  reconcileAdd: vi.fn(),
  reconcileAddMany: vi.fn(),
  repairAdd: vi.fn(),
  slatesUpsert: vi.fn(),
  slatesDelete: vi.fn(),
  signalUpsert: vi.fn(),
  signalArchive: vi.fn(),
  getTenantForSignal: vi.fn(),
  getTenantForSlatesCached: vi.fn(),
  isCallbackSupported: vi.fn(),
  loadCallback: vi.fn(),
  loadFreshCallback: vi.fn(),
  loadFreshCallbackInstance: vi.fn(),
  loadCallbackInstance: vi.fn(),
  isPairUsable: vi.fn(() => true),
  tombstoneApps: vi.fn(),
  lockUsing: vi.fn(async (_key: string, handler: () => Promise<unknown>) => await handler()),
  repairHandler: undefined as undefined | ((data: { cursor?: string }) => Promise<void>)
}));

vi.mock('@metorial-subspace/db', () => {
  let db = {
    callbackInstance: {
      findUniqueOrThrow: state.findUniqueOrThrow,
      findMany: state.findMany,
      updateMany: state.updateMany,
      update: state.update
    }
  };

  return {
    db,
    withTransaction: async (handler: (tx: typeof db) => Promise<unknown>) => handler(db)
  };
});
vi.mock('@metorial-subspace/module-auth', () => ({
  tombstoneProvisionedTenantAppsForCallbackInTransaction: state.tombstoneApps
}));
vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: state.lockUsing })
}));
vi.mock('@lowerdeck/cron', () => ({ createCron: vi.fn(() => ({ name: 'repair-cron' })) }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('../queues/definitions', () => ({
  reconcileCallbackRegistrationQueue: {
    add: state.reconcileAdd,
    addManyWithOps: state.reconcileAddMany
  },
  repairCallbackRegistrationsQueue: {
    add: state.repairAdd,
    process: (handler: (data: { cursor?: string }) => Promise<void>) => {
      state.repairHandler = handler;
      return { name: 'repair' };
    }
  }
}));
vi.mock('@metorial-subspace/provider-slates/src/client', () => ({
  slates: {
    callbackRegistration: {
      upsert: state.slatesUpsert,
      delete: state.slatesDelete
    }
  }
}));
vi.mock('../../signal', () => ({
  getTenantForSignal: state.getTenantForSignal,
  signal: {
    callback: {
      upsert: state.signalUpsert,
      archive: state.signalArchive
    }
  }
}));
vi.mock('./state', () => ({
  getTenantForSlatesCached: state.getTenantForSlatesCached,
  isCallbackSupported: state.isCallbackSupported,
  isPairUsable: state.isPairUsable,
  loadCallback: state.loadCallback,
  loadFreshCallback: state.loadFreshCallback,
  loadFreshCallbackInstance: state.loadFreshCallbackInstance,
  loadCallbackInstance: state.loadCallbackInstance,
  TRIGGER_PAGE_SIZE: 100
}));

import {
  applyCallbackRegistrationMirror,
  buildCallbackRegistrationMirror,
  callbackOwnerMutationId,
  detachRegistration,
  enqueueImmediateRegistrationReconciliation,
  markRegistrationFailure,
  syncCallback,
  syncCallbackInstance,
  type HubCallbackRegistrationReceiver
} from './sync';
import '../queues/repairCallbackRegistrations';

let receiver = (
  overrides: Partial<HubCallbackRegistrationReceiver['triggers'][number]> = {}
): HubCallbackRegistrationReceiver => ({
  id: 'receiver-1',
  callbackOwnerVersion: 2,
  triggers: [
    {
      id: 'trigger-1',
      active: true,
      authoritativeStateVersion: 10,
      registrationStatus: 'failed',
      registrationGeneration: 4,
      registrationTransitionVersion: 2,
      registrationError: {
        code: 'provider_timeout',
        message: 'The provider registration request timed out.',
        metadata: { version: 1 },
        at: '2026-08-14T12:00:00.000Z'
      },
      verificationMechanism: 'hub',
      verificationSpecHash: 'a'.repeat(64),
      ...overrides
    }
  ]
});

describe('callback registration mirror', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.findUniqueOrThrow.mockResolvedValue({
      registrationGeneration: 3,
      registrationTransitionVersion: 9,
      registrationPublicSnapshot: buildCallbackRegistrationMirror(
        receiver({
          registrationGeneration: 3,
          registrationTransitionVersion: 9,
          authoritativeStateVersion: 9
        })
      ).registrationPublicSnapshot,
      registrationMirrorVersion: 12,
      registrationReceiverAuthorityVersion: 2,
      slateTriggerReceiverId: 'receiver-1'
    });
    state.updateMany.mockResolvedValue({ count: 1 });
    state.update.mockResolvedValue({});
    state.findMany.mockResolvedValue([]);
    state.reconcileAdd.mockResolvedValue({});
    state.reconcileAddMany.mockResolvedValue({});
    state.repairAdd.mockResolvedValue({});
    state.slatesUpsert.mockReset();
    state.slatesDelete.mockReset();
    state.signalUpsert.mockReset();
    state.signalArchive.mockReset();
    state.getTenantForSignal.mockReset();
    state.getTenantForSlatesCached.mockReset();
    state.isCallbackSupported.mockReset();
    state.loadCallback.mockReset();
    state.loadFreshCallback.mockReset();
    state.loadFreshCallbackInstance.mockReset();
    state.loadCallbackInstance.mockReset();
  });

  it('faithfully mirrors failed lifecycle and verification mechanism', () => {
    let mirror = buildCallbackRegistrationMirror({
      ...receiver(),
      receiverPathSecrets: [
        {
          id: 'receiver-path-secret-1',
          status: 'active',
          secretVersion: 3,
          validFrom: '2026-08-14T12:00:00.000Z',
          validUntil: null,
          rotatedAt: '2026-08-14T12:00:00.000Z'
        }
      ]
    });
    expect(mirror).toEqual(
      expect.objectContaining({
        registrationStatus: 'failed',
        registrationGeneration: 4,
        registrationTransitionVersion: 2,
        registrationErrorCode: 'provider_timeout',
        verificationMechanism: 'hub',
        verificationSpecHash: 'a'.repeat(64)
      })
    );
    expect(mirror.registrationPublicSnapshot.receiverPathSecrets).toEqual([
      {
        id: 'receiver-path-secret-1',
        status: 'active',
        secretVersion: 3,
        validFrom: '2026-08-14T12:00:00.000Z',
        validUntil: null,
        rotatedAt: '2026-08-14T12:00:00.000Z'
      }
    ]);
    expect(JSON.stringify(mirror)).not.toMatch(
      /registrationDetails|encrypted|plaintext|secretValue|secretMaterial|receipt/i
    );
  });

  it('applies only a newer authoritative Hub version by CAS', async () => {
    await expect(
      applyCallbackRegistrationMirror({ callbackInstanceOid: 1n, receiver: receiver() })
    ).resolves.toBe('applied');
    expect(state.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          oid: 1n,
          registrationMirrorVersion: 12
        }),
        data: expect.objectContaining({
          registrationStatus: 'failed',
          lastRegistrationSyncErrorCode: null
        })
      })
    );
  });

  it('ignores older snapshots and accepts identical equal tuples', async () => {
    state.findUniqueOrThrow.mockResolvedValueOnce({
      registrationGeneration: 5,
      registrationTransitionVersion: 0,
      registrationPublicSnapshot: buildCallbackRegistrationMirror(
        receiver({
          registrationGeneration: 5,
          registrationTransitionVersion: 0,
          authoritativeStateVersion: 11
        })
      ).registrationPublicSnapshot,
      registrationMirrorVersion: 13,
      registrationReceiverAuthorityVersion: 2,
      slateTriggerReceiverId: 'receiver-1'
    });
    await expect(
      applyCallbackRegistrationMirror({ callbackInstanceOid: 1n, receiver: receiver() })
    ).resolves.toBe('stale');
    expect(state.updateMany).not.toHaveBeenCalled();

    let current = buildCallbackRegistrationMirror(receiver());
    state.findUniqueOrThrow.mockResolvedValueOnce({
      registrationGeneration: 4,
      registrationTransitionVersion: 2,
      registrationPublicSnapshot: current.registrationPublicSnapshot,
      registrationMirrorVersion: 14,
      registrationReceiverAuthorityVersion: 2,
      slateTriggerReceiverId: 'receiver-1'
    });
    await expect(
      applyCallbackRegistrationMirror({ callbackInstanceOid: 1n, receiver: receiver() })
    ).resolves.toBe('unchanged');
  });

  it('rejects equal authoritative-version divergence as an invariant conflict', async () => {
    let conflicting = buildCallbackRegistrationMirror(
      receiver({ registrationStatus: 'registered' })
    ).registrationPublicSnapshot;
    state.findUniqueOrThrow.mockResolvedValueOnce({
      registrationGeneration: 4,
      registrationTransitionVersion: 2,
      registrationPublicSnapshot: conflicting,
      registrationMirrorVersion: 15,
      registrationReceiverAuthorityVersion: 2,
      slateTriggerReceiverId: 'receiver-1'
    });
    await expect(
      applyCallbackRegistrationMirror({ callbackInstanceOid: 1n, receiver: receiver() })
    ).rejects.toThrow('equal_version_conflict');
    await enqueueImmediateRegistrationReconciliation(
      'instance-1',
      receiver({ registrationStatus: 'registered' })
    );
    await enqueueImmediateRegistrationReconciliation('instance-1', receiver());
    expect(state.reconcileAdd.mock.calls.at(-1)![1].id).not.toBe(
      state.reconcileAdd.mock.calls.at(-2)![1].id
    );
  });

  it('stores reconciliation failure separately without changing lifecycle truth', async () => {
    await markRegistrationFailure({ callbackInstanceOid: 1n, message: 'raw secret value' });
    expect(state.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: expect.objectContaining({
        lastRegistrationSyncErrorCode: 'registration_sync_failed',
        lastRegistrationSyncErrorMessage: 'Callback registration reconciliation failed.'
      })
    });
    expect(state.update.mock.calls[0]![0].data.registrationStatus).toBeUndefined();
    expect(JSON.stringify(state.update.mock.calls[0]![0].data)).not.toContain(
      'raw secret value'
    );
  });

  it('enqueues immediate and periodic registration reconciliation without private data', async () => {
    let value = receiver();
    await enqueueImmediateRegistrationReconciliation('instance-1', value);
    expect(state.reconcileAdd).toHaveBeenCalledWith(
      { callbackInstanceId: 'instance-1' },
      { id: expect.stringMatching(/^immediate:instance-1:[a-f0-9]{64}$/) }
    );

    state.findMany.mockResolvedValueOnce([{ id: 'instance-1' }, { id: 'instance-2' }]);
    await state.repairHandler?.({});
    expect(state.reconcileAddMany).toHaveBeenCalledWith([
      {
        data: { callbackInstanceId: 'instance-1' },
        opts: { id: 'registration:instance-1' }
      },
      {
        data: { callbackInstanceId: 'instance-2' },
        opts: { id: 'registration:instance-2' }
      }
    ]);
    expect(JSON.stringify(state.reconcileAddMany.mock.calls[0])).not.toMatch(
      /registrationDetails|encrypted|secret/i
    );
  });

  it('advances a second trigger independently without collapsing the first tuple', async () => {
    let first = receiver().triggers[0]!;
    let storedReceiver: HubCallbackRegistrationReceiver = {
      id: 'receiver-1',
      callbackOwnerVersion: 2,
      triggers: [
        first,
        {
          ...first,
          id: 'trigger-2',
          authoritativeStateVersion: 20,
          registrationGeneration: 8,
          registrationTransitionVersion: 4
        }
      ]
    };
    let incoming: HubCallbackRegistrationReceiver = {
      id: 'receiver-1',
      callbackOwnerVersion: 2,
      triggers: [
        {
          ...first,
          authoritativeStateVersion: 9,
          registrationGeneration: 3,
          registrationTransitionVersion: 99
        },
        {
          ...first,
          id: 'trigger-2',
          authoritativeStateVersion: 21,
          registrationGeneration: 8,
          registrationTransitionVersion: 5
        }
      ]
    };
    state.findUniqueOrThrow.mockResolvedValueOnce({
      registrationPublicSnapshot:
        buildCallbackRegistrationMirror(storedReceiver).registrationPublicSnapshot,
      registrationMirrorVersion: 20,
      registrationReceiverAuthorityVersion: 2,
      slateTriggerReceiverId: 'receiver-1'
    });
    await expect(
      applyCallbackRegistrationMirror({ callbackInstanceOid: 1n, receiver: incoming })
    ).resolves.toBe('applied');
    let triggers =
      state.updateMany.mock.calls.at(-1)![0].data.registrationPublicSnapshot.triggers;
    expect(state.updateMany.mock.calls.at(-1)![0].data).toEqual(
      expect.objectContaining({
        registrationGeneration: 0,
        registrationTransitionVersion: 0
      })
    );
    expect(
      triggers.map((trigger: any) => [
        trigger.id,
        trigger.registrationGeneration,
        trigger.registrationTransitionVersion
      ])
    ).toEqual([
      ['trigger-1', 4, 2],
      ['trigger-2', 8, 5]
    ]);
  });

  it('changes the immediate deduplication job for a second-trigger-only advancement', async () => {
    let first = receiver().triggers[0]!;
    let initial: HubCallbackRegistrationReceiver = {
      id: 'receiver-1',
      callbackOwnerVersion: 2,
      triggers: [first, { ...first, id: 'trigger-2' }]
    };
    let advanced: HubCallbackRegistrationReceiver = {
      ...initial,
      triggers: [
        first,
        {
          ...first,
          id: 'trigger-2',
          authoritativeStateVersion: first.authoritativeStateVersion + 1,
          registrationTransitionVersion: 3
        }
      ]
    };

    await enqueueImmediateRegistrationReconciliation('instance-1', initial);
    await enqueueImmediateRegistrationReconciliation('instance-1', advanced);

    let initialJobId = state.reconcileAdd.mock.calls[0]![1].id;
    let advancedJobId = state.reconcileAdd.mock.calls[1]![1].id;
    expect(initialJobId).toMatch(/^immediate:instance-1:[a-f0-9]{64}$/);
    expect(advancedJobId).toMatch(/^immediate:instance-1:[a-f0-9]{64}$/);
    expect(advancedJobId).not.toBe(initialJobId);
  });

  it('retains an active registered trigger while excluding a removed unregistered tombstone', async () => {
    let first = {
      ...receiver({ registrationStatus: 'registered' }).triggers[0]!,
      authoritativeStateVersion: 10
    };
    let stored: HubCallbackRegistrationReceiver = {
      id: 'receiver-1',
      callbackOwnerVersion: 4,
      triggers: [first, { ...first, id: 'trigger-removed', authoritativeStateVersion: 20 }]
    };
    let incoming: HubCallbackRegistrationReceiver = {
      id: 'receiver-1',
      callbackOwnerVersion: 4,
      triggers: [
        { ...first, authoritativeStateVersion: 11 },
        {
          ...first,
          id: 'trigger-removed',
          active: false,
          authoritativeStateVersion: 21,
          registrationStatus: 'unregistered'
        }
      ]
    };
    state.findUniqueOrThrow.mockResolvedValueOnce({
      registrationPublicSnapshot:
        buildCallbackRegistrationMirror(stored).registrationPublicSnapshot,
      registrationMirrorVersion: 31,
      registrationReceiverAuthorityVersion: 4,
      slateTriggerReceiverId: 'receiver-1'
    });

    await expect(
      applyCallbackRegistrationMirror({ callbackInstanceOid: 1n, receiver: incoming })
    ).resolves.toBe('applied');
    let data = state.updateMany.mock.calls.at(-1)![0].data;
    expect(data.registrationStatus).toBe('registered');
    expect(data.registrationPublicSnapshot.triggers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'trigger-removed', active: false })
      ])
    );
  });

  it('replaces a different receiver snapshot under the local owner-authority CAS', async () => {
    let stored = receiver();
    let replacement: HubCallbackRegistrationReceiver = {
      id: 'receiver-2',
      callbackOwnerVersion: 8,
      triggers: [
        {
          ...stored.triggers[0]!,
          id: 'trigger-new',
          authoritativeStateVersion: 1
        }
      ]
    };
    state.findUniqueOrThrow.mockResolvedValueOnce({
      registrationPublicSnapshot:
        buildCallbackRegistrationMirror(stored).registrationPublicSnapshot,
      registrationMirrorVersion: 32,
      registrationReceiverAuthorityVersion: 7,
      slateTriggerReceiverId: 'receiver-1'
    });

    await expect(
      applyCallbackRegistrationMirror({
        callbackInstanceOid: 1n,
        receiver: replacement,
        expectedReceiverId: 'receiver-1',
        expectedReceiverAuthorityVersion: 7
      })
    ).resolves.toBe('applied');
    let update = state.updateMany.mock.calls.at(-1)![0];
    expect(update.where).toEqual(
      expect.objectContaining({
        slateTriggerReceiverId: 'receiver-1',
        registrationReceiverAuthorityVersion: 7
      })
    );
    expect(update.data).toEqual(
      expect.objectContaining({
        slateTriggerReceiverId: 'receiver-2',
        registrationReceiverAuthorityVersion: 8
      })
    );
    expect(update.data.registrationPublicSnapshot).toEqual({
      receiverId: 'receiver-2',
      callbackOwnerVersion: 8,
      receiverPathSecrets: [],
      triggers: [expect.objectContaining({ id: 'trigger-new' })]
    });
  });

  it('changes the immediate job identity when only callback owner authority advances', async () => {
    let initial = { ...receiver(), callbackOwnerVersion: 2 };
    let advanced = { ...receiver(), callbackOwnerVersion: 3 };
    await enqueueImmediateRegistrationReconciliation('instance-1', initial);
    await enqueueImmediateRegistrationReconciliation('instance-1', advanced);
    expect(state.reconcileAdd.mock.calls.at(-1)![1].id).not.toBe(
      state.reconcileAdd.mock.calls.at(-2)![1].id
    );
  });

  it('passes exact local owner authority through the production upsert call and adopts Hub authority by CAS', async () => {
    let callback = {
      oid: 20n,
      id: 'callback-1',
      tenant: { oid: 30n },
      isCallbacksV2: true,
      pollIntervalSecondsOverride: null,
      callbackProviderTriggers: [
        {
          providerTrigger: { specId: 'provider-trigger-1' },
          eventTypes: []
        },
        {
          providerTrigger: { specId: 'provider-trigger-2' },
          eventTypes: ['event.updated']
        }
      ]
    };
    state.loadCallbackInstance.mockResolvedValueOnce({
      oid: 1n,
      id: 'instance-1',
      status: 'attached',
      slateTriggerReceiverId: 'receiver-1',
      registrationReceiverAuthorityVersion: 4,
      callback,
      providerDeploymentConfigPair: {
        providerConfigVersion: { slateInstance: { id: 'slate-instance-1' } },
        providerAuthConfigVersion: null
      }
    });
    state.isCallbackSupported.mockReturnValue(true);
    state.getTenantForSlatesCached.mockResolvedValue({ id: 'slates-tenant-1' });
    let hubReceiver = {
      ...receiver({ authoritativeStateVersion: 11 }),
      callbackOwnerVersion: 5
    };
    state.slatesUpsert.mockResolvedValue(hubReceiver);
    state.findUniqueOrThrow.mockResolvedValueOnce({
      registrationPublicSnapshot: buildCallbackRegistrationMirror({
        ...receiver({ authoritativeStateVersion: 10 }),
        callbackOwnerVersion: 4
      }).registrationPublicSnapshot,
      registrationMirrorVersion: 40,
      registrationReceiverAuthorityVersion: 4,
      slateTriggerReceiverId: 'receiver-1'
    });

    await syncCallbackInstance({
      callbackInstanceId: 'instance-1',
      skipSignalSync: true,
      throwOnError: true
    });

    expect(state.slatesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackId: 'callback-1',
        callbackInstanceId: 'instance-1',
        expectedSlateTriggerReceiverId: 'receiver-1',
        expectedOwnerVersion: 4,
        ownerMutationId: expect.stringMatching(/^callback-owner:[a-f0-9]{64}$/),
        triggers: [
          { triggerId: 'provider-trigger-1', eventTypes: [] },
          { triggerId: 'provider-trigger-2', eventTypes: ['event.updated'] }
        ]
      })
    );
    expect(state.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          slateTriggerReceiverId: 'receiver-1',
          registrationReceiverAuthorityVersion: 4
        }),
        data: expect.objectContaining({
          slateTriggerReceiverId: 'receiver-1',
          registrationReceiverAuthorityVersion: 5
        })
      })
    );
  });

  it('archives Signal before receiver reconciliation and reactivates it only after Slates succeeds', async () => {
    let callback = {
      oid: 20n,
      id: 'callback-1',
      status: 'active',
      name: 'Callback 1',
      description: null,
      tenant: { oid: 30n },
      isCallbacksV2: true,
      pollIntervalSecondsOverride: null,
      callbackDestinationLinks: [],
      callbackProviderTriggers: [
        {
          providerTrigger: { specId: 'provider-trigger-1' },
          eventTypes: ['event.created']
        }
      ]
    };
    let callbackInstance = {
      oid: 1n,
      id: 'instance-1',
      status: 'attached',
      slateTriggerReceiverId: 'receiver-1',
      registrationReceiverAuthorityVersion: 4,
      callback,
      providerDeploymentConfigPair: {
        providerConfigVersion: { slateInstance: { id: 'slate-instance-1' } },
        providerAuthConfigVersion: null
      }
    };
    state.loadCallback.mockResolvedValue(callback);
    state.loadFreshCallback.mockResolvedValue(callback);
    state.loadCallbackInstance.mockResolvedValue(callbackInstance);
    state.loadFreshCallbackInstance.mockResolvedValue(callbackInstance);
    state.findMany.mockResolvedValueOnce([{ id: 'instance-1' }]);
    state.isCallbackSupported.mockReturnValue(true);
    state.getTenantForSignal.mockResolvedValue({ id: 'signal-tenant-1' });
    state.getTenantForSlatesCached.mockResolvedValue({ id: 'slates-tenant-1' });
    state.signalArchive.mockResolvedValue({});
    state.signalUpsert.mockResolvedValue({ destinations: [] });
    state.slatesUpsert.mockResolvedValue({
      ...receiver({ authoritativeStateVersion: 11 }),
      callbackOwnerVersion: 5
    });
    state.findUniqueOrThrow.mockResolvedValueOnce({
      registrationPublicSnapshot: buildCallbackRegistrationMirror({
        ...receiver({ authoritativeStateVersion: 10 }),
        callbackOwnerVersion: 4
      }).registrationPublicSnapshot,
      registrationMirrorVersion: 40,
      registrationReceiverAuthorityVersion: 4,
      slateTriggerReceiverId: 'receiver-1'
    });

    await syncCallback({ callbackId: callback.id, throwOnError: true });

    expect(state.signalArchive).toHaveBeenCalledWith({
      tenantId: 'signal-tenant-1',
      callbackId: callback.id
    });
    expect(state.signalUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ callbackId: callback.id, eventTypes: [] })
    );
    expect(state.signalArchive.mock.invocationCallOrder[0]).toBeLessThan(
      state.slatesUpsert.mock.invocationCallOrder[0]!
    );
    expect(state.slatesUpsert.mock.invocationCallOrder[0]).toBeLessThan(
      state.signalUpsert.mock.invocationCallOrder[0]!
    );

    state.signalArchive.mockClear();
    state.signalUpsert.mockClear();
    state.slatesUpsert.mockReset();
    state.slatesUpsert.mockRejectedValue(new Error('slates_unavailable'));
    state.findMany.mockResolvedValueOnce([{ id: 'instance-1' }]);

    await expect(
      syncCallback({ callbackId: callback.id, throwOnError: true })
    ).rejects.toThrow('slates_unavailable');
    expect(state.signalArchive).toHaveBeenCalledOnce();
    expect(state.signalUpsert).not.toHaveBeenCalled();

    state.signalArchive.mockClear();
    state.slatesUpsert.mockReset();
    state.slatesUpsert.mockResolvedValue({
      ...receiver({ authoritativeStateVersion: 12 }),
      callbackOwnerVersion: 5
    });
    state.findUniqueOrThrow.mockResolvedValueOnce({
      registrationPublicSnapshot: buildCallbackRegistrationMirror({
        ...receiver({ authoritativeStateVersion: 11 }),
        callbackOwnerVersion: 4
      }).registrationPublicSnapshot,
      registrationMirrorVersion: 41,
      registrationReceiverAuthorityVersion: 4,
      slateTriggerReceiverId: 'receiver-1'
    });
    state.findMany.mockResolvedValueOnce([{ id: 'instance-1' }]);

    await syncCallback({ callbackId: callback.id, fresh: true, throwOnError: true });

    expect(state.signalArchive).toHaveBeenCalledOnce();
    expect(state.slatesUpsert).toHaveBeenCalledOnce();
    expect(state.signalUpsert).toHaveBeenCalledOnce();
    expect(state.slatesUpsert.mock.invocationCallOrder[0]).toBeLessThan(
      state.signalUpsert.mock.invocationCallOrder[0]!
    );
  });

  it('keeps Signal archived when an individual repair finds another instance still failing', async () => {
    let callback = {
      oid: 20n,
      id: 'callback-1',
      status: 'active',
      name: 'Callback 1',
      description: null,
      tenant: { oid: 30n },
      isCallbacksV2: true,
      pollIntervalSecondsOverride: null,
      callbackDestinationLinks: [],
      callbackProviderTriggers: [
        {
          providerTrigger: { specId: 'provider-trigger-1' },
          eventTypes: ['event.created']
        }
      ]
    };
    let callbackInstance = (id: string) => ({
      oid: id === 'instance-1' ? 1n : 2n,
      id,
      status: 'attached',
      slateTriggerReceiverId: id === 'instance-1' ? 'receiver-1' : 'receiver-2',
      registrationReceiverAuthorityVersion: 4,
      callback,
      providerDeploymentConfigPair: {
        providerConfigVersion: { slateInstance: { id: `slate-${id}` } },
        providerAuthConfigVersion: null
      }
    });
    state.loadFreshCallbackInstance
      .mockResolvedValueOnce(callbackInstance('instance-1'))
      .mockResolvedValueOnce(callbackInstance('instance-1'))
      .mockResolvedValueOnce(callbackInstance('instance-2'));
    state.loadFreshCallback.mockResolvedValue(callback);
    state.findMany.mockResolvedValueOnce([{ id: 'instance-1' }, { id: 'instance-2' }]);
    state.isCallbackSupported.mockReturnValue(true);
    state.getTenantForSignal.mockResolvedValue({ id: 'signal-tenant-1' });
    state.getTenantForSlatesCached.mockResolvedValue({ id: 'slates-tenant-1' });
    state.signalArchive.mockResolvedValue({});
    state.findUniqueOrThrow.mockResolvedValue({
      registrationPublicSnapshot: buildCallbackRegistrationMirror({
        ...receiver({ authoritativeStateVersion: 10 }),
        callbackOwnerVersion: 4
      }).registrationPublicSnapshot,
      registrationMirrorVersion: 40,
      registrationReceiverAuthorityVersion: 4,
      slateTriggerReceiverId: 'receiver-1'
    });
    state.slatesUpsert
      .mockResolvedValueOnce({ ...receiver(), callbackOwnerVersion: 5 })
      .mockRejectedValueOnce(new Error('second_instance_unavailable'));

    await expect(
      syncCallbackInstance({ callbackInstanceId: 'instance-1', throwOnError: true })
    ).rejects.toThrow('second_instance_unavailable');

    expect(state.signalArchive).toHaveBeenCalledOnce();
    expect(state.signalUpsert).not.toHaveBeenCalled();
  });

  it('performs one fresh callback-wide pass and reactivates Signal after an individual repair', async () => {
    let callback = {
      oid: 20n,
      id: 'callback-1',
      status: 'active',
      name: 'Callback 1',
      description: null,
      tenant: { oid: 30n },
      isCallbacksV2: true,
      pollIntervalSecondsOverride: null,
      callbackDestinationLinks: [],
      callbackProviderTriggers: [
        {
          providerTrigger: { specId: 'provider-trigger-1' },
          eventTypes: ['event.created']
        }
      ]
    };
    let callbackInstance = {
      oid: 1n,
      id: 'instance-1',
      status: 'attached',
      slateTriggerReceiverId: 'receiver-1',
      registrationReceiverAuthorityVersion: 4,
      callback,
      providerDeploymentConfigPair: {
        providerConfigVersion: { slateInstance: { id: 'slate-instance-1' } },
        providerAuthConfigVersion: null
      }
    };
    let localAuthorityVersion = 4;
    state.loadFreshCallbackInstance.mockResolvedValue(callbackInstance);
    state.loadFreshCallback.mockResolvedValue(callback);
    state.findMany.mockResolvedValueOnce([{ id: 'instance-1' }]);
    state.isCallbackSupported.mockReturnValue(true);
    state.getTenantForSignal.mockResolvedValue({ id: 'signal-tenant-1' });
    state.getTenantForSlatesCached.mockResolvedValue({ id: 'slates-tenant-1' });
    state.signalArchive.mockResolvedValue({});
    state.signalUpsert.mockResolvedValue({ destinations: [] });
    state.slatesUpsert.mockResolvedValue({
      ...receiver({ authoritativeStateVersion: 11 }),
      callbackOwnerVersion: 5
    });
    state.findUniqueOrThrow.mockImplementation(async () => ({
      registrationPublicSnapshot: buildCallbackRegistrationMirror({
        ...receiver({ authoritativeStateVersion: 10 }),
        callbackOwnerVersion: localAuthorityVersion
      }).registrationPublicSnapshot,
      registrationMirrorVersion: 40,
      registrationReceiverAuthorityVersion: localAuthorityVersion,
      slateTriggerReceiverId: 'receiver-1'
    }));
    state.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (
        where.registrationReceiverAuthorityVersion !== undefined &&
        where.registrationReceiverAuthorityVersion !== localAuthorityVersion
      ) {
        return { count: 0 };
      }
      if (data.registrationReceiverAuthorityVersion !== undefined) {
        localAuthorityVersion = data.registrationReceiverAuthorityVersion;
      }
      return { count: 1 };
    });

    await syncCallbackInstance({
      callbackInstanceId: callbackInstance.id,
      throwOnError: true
    });

    expect(state.lockUsing).toHaveBeenCalledWith(callback.id, expect.any(Function), {
      durationMs: 60_000
    });
    expect(state.slatesUpsert).toHaveBeenCalledOnce();
    expect(localAuthorityVersion).toBe(5);
    expect(state.signalArchive).toHaveBeenCalledOnce();
    expect(state.signalUpsert).toHaveBeenCalledOnce();
  });

  it('does not resurrect a receiver from the removed registration fallback during sync', async () => {
    state.loadCallbackInstance.mockResolvedValueOnce({
      oid: 1n,
      id: 'instance-legacy-only',
      status: 'detached',
      slateTriggerReceiverId: null,
      activeRegistration: { slateTriggerReceiverId: 'receiver-legacy-only' },
      registrationReceiverAuthorityVersion: 4,
      callback: {
        oid: 20n,
        id: 'callback-1',
        tenant: { oid: 30n },
        isCallbacksV2: true,
        pollIntervalSecondsOverride: null,
        callbackProviderTriggers: []
      },
      providerDeploymentConfigPair: {
        providerConfigVersion: { slateInstance: null },
        providerAuthConfigVersion: null
      }
    });
    state.isCallbackSupported.mockReturnValue(false);

    await syncCallbackInstance({
      callbackInstanceId: 'instance-legacy-only',
      skipSignalSync: true,
      throwOnError: true
    });

    expect(state.slatesDelete).not.toHaveBeenCalled();
    expect(state.slatesUpsert).not.toHaveBeenCalled();
    expect(state.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: expect.objectContaining({
        lastSyncErrorCode: null,
        lastSyncErrorMessage: null
      })
    });
  });

  it('does not mutate the local mirror when Hub rejects stale upsert or delete authority', async () => {
    let callback = {
      oid: 20n,
      id: 'callback-1',
      tenant: { oid: 30n },
      isCallbacksV2: true,
      pollIntervalSecondsOverride: null,
      callbackProviderTriggers: [
        {
          providerTrigger: { specId: 'provider-trigger-1' },
          eventTypes: ['event.created']
        }
      ]
    };
    state.loadCallbackInstance.mockResolvedValueOnce({
      oid: 1n,
      id: 'instance-1',
      status: 'attached',
      slateTriggerReceiverId: 'receiver-old',
      registrationReceiverAuthorityVersion: 3,
      callback,
      providerDeploymentConfigPair: {
        providerConfigVersion: { slateInstance: { id: 'slate-instance-1' } },
        providerAuthConfigVersion: null
      }
    });
    state.isCallbackSupported.mockReturnValue(true);
    state.getTenantForSlatesCached.mockResolvedValue({ id: 'slates-tenant-1' });
    state.slatesUpsert.mockRejectedValueOnce(new Error('callback_owner_conflict'));

    await expect(
      syncCallbackInstance({
        callbackInstanceId: 'instance-1',
        skipSignalSync: true,
        throwOnError: true
      })
    ).rejects.toThrow('callback_owner_conflict');
    expect(state.updateMany).not.toHaveBeenCalled();

    state.update.mockClear();
    state.slatesDelete.mockRejectedValueOnce(new Error('callback_owner_conflict'));
    await expect(
      detachRegistration({
        callbackInstanceOid: 1n,
        callbackInstanceId: 'instance-1',
        callbackId: 'callback-1',
        slateTriggerReceiverId: 'receiver-old',
        expectedReceiverAuthorityVersion: 3,
        slatesTenantId: 'slates-tenant-1'
      })
    ).rejects.toThrow('callback_owner_conflict');
    expect(state.slatesDelete).toHaveBeenCalledWith({
      tenantId: 'slates-tenant-1',
      callbackId: 'callback-1',
      callbackInstanceId: 'instance-1',
      slateTriggerReceiverId: 'receiver-old',
      expectedOwnerVersion: 3,
      ownerMutationId: callbackOwnerMutationId({
        operation: 'delete',
        callbackId: 'callback-1',
        callbackInstanceId: 'instance-1',
        receiverId: 'receiver-old'
      })
    });
    expect(state.updateMany).not.toHaveBeenCalled();
  });

  it('tears down and detaches an attached instance whose pair resources are archived', async () => {
    state.loadCallbackInstance.mockResolvedValueOnce({
      oid: 1n,
      id: 'instance-1',
      status: 'attached',
      slateTriggerReceiverId: 'receiver-1',
      registrationReceiverAuthorityVersion: 2,
      callback: {
        oid: 20n,
        id: 'callback-1',
        status: 'active',
        tenant: { oid: 30n },
        isCallbacksV2: true,
        pollIntervalSecondsOverride: null,
        callbackProviderTriggers: [
          { providerTrigger: { specId: 'provider-trigger-1' }, eventTypes: [] }
        ]
      },
      providerDeploymentConfigPair: {
        providerConfigVersion: { slateInstance: { id: 'slate-instance-1' } },
        providerAuthConfigVersion: null
      }
    });
    state.isCallbackSupported.mockReturnValue(true);
    state.isPairUsable.mockReturnValueOnce(false);
    state.getTenantForSlatesCached.mockResolvedValue({ id: 'slates-tenant-1' });
    state.slatesDelete.mockResolvedValue({ ...receiver(), callbackOwnerVersion: 3 });

    await syncCallbackInstance({ callbackInstanceId: 'instance-1', skipSignalSync: true });

    expect(state.slatesDelete).toHaveBeenCalled();
    expect(state.slatesUpsert).not.toHaveBeenCalled();
    expect(state.tombstoneApps).toHaveBeenCalledWith(expect.anything(), 1n, expect.any(Date));
    expect(state.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 1n },
        data: expect.objectContaining({ status: 'detached' })
      })
    );
  });

  it('detaches attached instances of an archived callback without a receiver call', async () => {
    state.loadCallbackInstance.mockResolvedValueOnce({
      oid: 1n,
      id: 'instance-1',
      status: 'attached',
      slateTriggerReceiverId: null,
      registrationReceiverAuthorityVersion: 0,
      callback: {
        oid: 20n,
        id: 'callback-1',
        status: 'archived',
        tenant: { oid: 30n },
        isCallbacksV2: true,
        pollIntervalSecondsOverride: null,
        callbackProviderTriggers: []
      },
      providerDeploymentConfigPair: {
        providerConfigVersion: { slateInstance: null },
        providerAuthConfigVersion: null
      }
    });
    state.isCallbackSupported.mockReturnValue(false);

    await syncCallbackInstance({ callbackInstanceId: 'instance-1', skipSignalSync: true });

    expect(state.slatesDelete).not.toHaveBeenCalled();
    expect(state.tombstoneApps).toHaveBeenCalled();
    expect(state.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 1n },
        data: expect.objectContaining({ status: 'detached' })
      })
    );
  });

  it('keeps a failed teardown attached for the lifecycle sweep instead of detaching', async () => {
    let archivedInstance = () => ({
      oid: 1n,
      id: 'instance-1',
      status: 'attached',
      slateTriggerReceiverId: 'receiver-1',
      registrationReceiverAuthorityVersion: 2,
      callback: {
        oid: 20n,
        id: 'callback-1',
        status: 'archived',
        tenant: { oid: 30n },
        isCallbacksV2: true,
        pollIntervalSecondsOverride: null,
        callbackProviderTriggers: []
      },
      providerDeploymentConfigPair: {
        providerConfigVersion: { slateInstance: { id: 'slate-instance-1' } },
        providerAuthConfigVersion: null
      }
    });
    state.isCallbackSupported.mockReturnValue(false);
    state.getTenantForSlatesCached.mockResolvedValue({ id: 'slates-tenant-1' });
    state.slatesDelete.mockRejectedValue(new Error('slates_down'));

    state.loadCallbackInstance.mockResolvedValueOnce(archivedInstance());
    await expect(
      syncCallbackInstance({ callbackInstanceId: 'instance-1', skipSignalSync: true })
    ).resolves.toBeUndefined();
    expect(state.tombstoneApps).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'detached' })
      })
    );
    expect(state.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastRegistrationSyncErrorCode: 'registration_sync_failed'
        })
      })
    );

    state.loadCallbackInstance.mockResolvedValueOnce(archivedInstance());
    await expect(
      syncCallbackInstance({
        callbackInstanceId: 'instance-1',
        skipSignalSync: true,
        throwOnError: true
      })
    ).rejects.toThrow('slates_down');
    expect(state.tombstoneApps).not.toHaveBeenCalled();
  });
});
