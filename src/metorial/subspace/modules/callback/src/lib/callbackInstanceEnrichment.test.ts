import { beforeEach, describe, expect, it, vi } from 'vitest';

let state = vi.hoisted(() => ({
  findManyProviderTriggers: vi.fn(),
  getTenantForSlates: vi.fn(),
  getReceivers: vi.fn(),
  getReceiver: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerTrigger: {
      findMany: state.findManyProviderTriggers
    }
  }
}));

vi.mock('@metorial-subspace/provider-slates/src/client', () => ({
  getTenantForSlates: state.getTenantForSlates,
  slates: {
    slateTriggerReceiver: {
      getMany: state.getReceivers,
      get: state.getReceiver
    }
  }
}));

import {
  enrichCallbackInstanceTriggers,
  enrichSingleCallbackInstanceTriggers
} from './callbackInstanceEnrichment';

type CallbackInstanceInput = Parameters<typeof enrichSingleCallbackInstanceTriggers>[2];

let tenant = {} as Parameters<typeof enrichSingleCallbackInstanceTriggers>[0];
let callback = { oid: 1n } as Parameters<typeof enrichSingleCallbackInstanceTriggers>[1];
let instance = (id: string, slateTriggerReceiverId: string | null, legacyReceiverId: string) =>
  ({
    id,
    slateTriggerReceiverId,
    activeRegistration: { slateTriggerReceiverId: legacyReceiverId }
  }) as unknown as CallbackInstanceInput;

describe('callback instance enrichment after registration mirror migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getTenantForSlates.mockResolvedValue({ id: 'slates-tenant-1' });
    state.findManyProviderTriggers.mockResolvedValue([]);
  });

  it('routes batch enrichment exclusively through the canonical receiver id', async () => {
    state.getReceivers.mockResolvedValue([
      {
        id: 'receiver-current',
        receiverWebhookUrl: 'https://callbacks.example/receiver-current',
        receiverPathSecrets: [],
        triggers: []
      }
    ]);

    let result = await enrichCallbackInstanceTriggers(tenant, callback, [
      instance('instance-current', 'receiver-current', 'receiver-legacy-conflict'),
      instance('instance-legacy-only', null, 'receiver-legacy-only')
    ]);

    expect(state.getReceivers).toHaveBeenCalledWith({
      tenantId: 'slates-tenant-1',
      slateTriggerReceiverIds: ['receiver-current']
    });
    expect(result.get('instance-current')).toEqual({
      receiverId: 'receiver-current',
      receiverWebhookUrl: 'https://callbacks.example/receiver-current',
      receiverPathSecrets: [],
      triggers: []
    });
    expect(result.has('instance-legacy-only')).toBe(false);
  });

  it('does not query Hub when a batch has only a removed legacy registration shape', async () => {
    let result = await enrichCallbackInstanceTriggers(tenant, callback, [
      instance('instance-legacy-only', null, 'receiver-legacy-only')
    ]);

    expect(result.size).toBe(0);
    expect(state.getTenantForSlates).not.toHaveBeenCalled();
    expect(state.getReceivers).not.toHaveBeenCalled();
  });

  it('uses only the canonical receiver id for single-instance enrichment', async () => {
    state.getReceiver.mockResolvedValue({
      id: 'receiver-current',
      receiverWebhookUrl: 'https://callbacks.example/receiver-current',
      receiverPathSecrets: [],
      triggers: []
    });

    await expect(
      enrichSingleCallbackInstanceTriggers(
        tenant,
        callback,
        instance('instance-current', 'receiver-current', 'receiver-legacy-conflict')
      )
    ).resolves.toEqual({
      receiverId: 'receiver-current',
      receiverWebhookUrl: 'https://callbacks.example/receiver-current',
      receiverPathSecrets: [],
      triggers: []
    });
    expect(state.getReceiver).toHaveBeenCalledWith({
      tenantId: 'slates-tenant-1',
      slateTriggerReceiverId: 'receiver-current'
    });
  });

  it('does not query Hub for a single instance with only the removed legacy shape', async () => {
    await expect(
      enrichSingleCallbackInstanceTriggers(
        tenant,
        callback,
        instance('instance-legacy-only', null, 'receiver-legacy-only')
      )
    ).resolves.toBeUndefined();

    expect(state.getTenantForSlates).not.toHaveBeenCalled();
    expect(state.getReceiver).not.toHaveBeenCalled();
  });
});
