import { describe, expect, it } from 'vitest';
import { slateTriggerReceiverPresenter } from './slateTriggerReceiver';

let trigger = (id: string, tombstonedAt: Date | null) => ({
  id,
  tombstonedAt,
  authoritativeStateVersion: tombstonedAt ? 8 : 7,
  action: { id: `action-${id}`, key: id, name: id },
  source: 'webhook',
  pollIntervalSeconds: null,
  nextPollAt: null,
  lastPolledAt: null,
  registrationStatus: tombstonedAt ? 'unregistered' : 'registered',
  registrationGeneration: 3,
  registrationTransitionVersion: 2,
  registrationErrorCode: null,
  registrationErrorMessage: null,
  registrationErrorMetadata: null,
  registrationErrorAt: null,
  verificationMechanism: 'path_secret_only',
  verificationSpecHash: 'a'.repeat(64)
});

describe('slateTriggerReceiverPresenter authoritative trigger membership', () => {
  it('marks a removed tombstoned trigger inactive while retaining active truth', () => {
    let presented = slateTriggerReceiverPresenter({
      id: 'receiver-1',
      slate: { id: 'slate-1' },
      slateInstance: { id: 'instance-1' },
      authConfig: null,
      status: 'active',
      deliveryMode: 'callback_v2',
      callbackId: 'callback-1',
      callbackInstanceId: 'callback-instance-1',
      name: null,
      description: null,
      eventTypes: [],
      consecutivePollingFailures: 0,
      consecutiveEventFailures: 0,
      triggers: [trigger('retained', null), trigger('removed', new Date())],
      createdAt: new Date('2026-08-14T00:00:00.000Z'),
      updatedAt: new Date('2026-08-14T00:00:00.000Z')
    } as any);

    expect(presented.triggers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'retained', active: true }),
        expect.objectContaining({ id: 'removed', active: false })
      ])
    );
  });
});
