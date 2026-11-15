import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  findEventDestination,
  countListeners,
  createListener,
  generateId,
  getCallbackById,
  getProviderById,
  getChatConnectionById,
  getValidTriggerKeys
} = vi.hoisted(() => ({
  findEventDestination: vi.fn(),
  countListeners: vi.fn(),
  createListener: vi.fn(),
  generateId: vi.fn(),
  getCallbackById: vi.fn(),
  getProviderById: vi.fn(),
  getChatConnectionById: vi.fn(),
  getValidTriggerKeys: vi.fn()
}));

let transactionDb = {
  eventDestinationListener: { create: createListener }
};

vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: () => unknown) => ({ build: factory }) }
}));

vi.mock('@metorial-subspace/module-callback', () => ({
  callbackInternalService: { getProviderIdsForCallbackIdsInternal: vi.fn() },
  callbackService: { getCallbackById }
}));

vi.mock('@metorial-subspace/module-catalog', () => ({
  providerService: { getProviderById },
  providerTriggerService: { getValidTriggerKeysForProviderVariant: getValidTriggerKeys }
}));

vi.mock('@metorial-subspace/module-chat', () => ({
  chatConnectionProviderService: { getProviderIdsForChatConnectionIdsInternal: vi.fn() },
  chatConnectionService: { getChatConnectionById }
}));

vi.mock('@metorial/db', () => ({
  db: {
    eventDestination: { findFirst: findEventDestination },
    eventDestinationListener: { count: countListeners }
  },
  ID: { generateId },
  withTransaction: (callback: (db: typeof transactionDb) => unknown) => callback(transactionDb)
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('@metorial/module-event-delivery', () => ({
  MAX_ACTIVE_LISTENERS_PER_DESTINATION: 100,
  MAX_ACTIVE_LISTENERS_PER_ORGANIZATION: 5_000
}));

vi.mock('@metorial/webhook-event-schema', () => ({
  webhookEvents: { 'session.created': {} },
  chatEventNames: ['chat.message.received']
}));

import { eventDestinationListenerService } from './eventDestinationListener';

let instance = { oid: BigInt(33), organizationOid: BigInt(4) } as any;

let eventDestination = { oid: BigInt(20), id: 'evtd_1', status: 'active' };

let auditScope = { scope: true } as any;

describe('eventDestinationListenerService.createEventDestinationListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateId.mockImplementation(async (model: string) => `${model}_1`);
    findEventDestination.mockResolvedValue(eventDestination);
    createListener.mockImplementation(async ({ data }: any) => ({ ...data }));
    getCallbackById.mockResolvedValue({ id: 'clb_1', providerVariantOid: BigInt(1) });
    getValidTriggerKeys.mockResolvedValue(['issue.created']);
    getChatConnectionById.mockResolvedValue({ id: 'chc_1' });
    getProviderById.mockResolvedValue({ id: 'prov_1' });
  });

  describe('per-destination cap', () => {
    it('allows creating the 100th listener on a destination', async () => {
      countListeners.mockImplementation(async ({ where }: any) =>
        'eventDestinationOid' in where ? 99 : 0
      );

      await expect(
        eventDestinationListenerService.createEventDestinationListener({
          instance,
          auditScope,
          input: {
            eventDestinationId: 'evtd_1',
            type: 'event',
            eventTypes: ['session.created']
          }
        })
      ).resolves.toBeDefined();
    });

    it('rejects creating a 101st listener on a destination', async () => {
      countListeners.mockImplementation(async ({ where }: any) =>
        'eventDestinationOid' in where ? 100 : 0
      );

      await expect(
        eventDestinationListenerService.createEventDestinationListener({
          instance,
          auditScope,
          input: {
            eventDestinationId: 'evtd_1',
            type: 'event',
            eventTypes: ['session.created']
          }
        })
      ).rejects.toThrow();

      expect(createListener).not.toHaveBeenCalled();
    });
  });

  describe('per-organization cap', () => {
    it('allows creating the 5,000th listener in an organization', async () => {
      countListeners.mockImplementation(async ({ where }: any) =>
        'eventDestinationOid' in where ? 0 : 4_999
      );

      await expect(
        eventDestinationListenerService.createEventDestinationListener({
          instance,
          auditScope,
          input: {
            eventDestinationId: 'evtd_1',
            type: 'event',
            eventTypes: ['session.created']
          }
        })
      ).resolves.toBeDefined();
    });

    it('rejects creating a 5,001st listener in an organization', async () => {
      countListeners.mockImplementation(async ({ where }: any) =>
        'eventDestinationOid' in where ? 0 : 5_000
      );

      await expect(
        eventDestinationListenerService.createEventDestinationListener({
          instance,
          auditScope,
          input: {
            eventDestinationId: 'evtd_1',
            type: 'event',
            eventTypes: ['session.created']
          }
        })
      ).rejects.toThrow();

      expect(createListener).not.toHaveBeenCalled();
    });
  });

  describe('callback target validation', () => {
    beforeEach(() => {
      countListeners.mockResolvedValue(0);
    });

    it('rejects a callback listener with both callback_id and provider_id', async () => {
      await expect(
        eventDestinationListenerService.createEventDestinationListener({
          instance,
          auditScope,
          input: {
            eventDestinationId: 'evtd_1',
            type: 'callback',
            callbackId: 'clb_1',
            providerId: 'prov_1',
            triggers: []
          }
        })
      ).rejects.toThrow();

      expect(createListener).not.toHaveBeenCalled();
    });

    it('accepts a callback listener targeting a specific callback', async () => {
      let listener = await eventDestinationListenerService.createEventDestinationListener({
        instance,
        auditScope,
        input: {
          eventDestinationId: 'evtd_1',
          type: 'callback',
          callbackId: 'clb_1',
          triggers: []
        }
      });

      expect(listener).toMatchObject({ callbackId: 'clb_1', providerId: null });
    });

    it('accepts a callback listener targeting all callbacks of a provider', async () => {
      let listener = await eventDestinationListenerService.createEventDestinationListener({
        instance,
        auditScope,
        input: {
          eventDestinationId: 'evtd_1',
          type: 'callback',
          providerId: 'prov_1',
          triggers: []
        }
      });

      expect(listener).toMatchObject({ callbackId: null, providerId: 'prov_1' });
    });

    it('accepts a callback listener targeting all callbacks', async () => {
      let listener = await eventDestinationListenerService.createEventDestinationListener({
        instance,
        auditScope,
        input: { eventDestinationId: 'evtd_1', type: 'callback', triggers: [] }
      });

      expect(listener).toMatchObject({ callbackId: null, providerId: null });
    });
  });

  describe('chat target validation', () => {
    beforeEach(() => {
      countListeners.mockResolvedValue(0);
    });

    it('rejects a chat listener with both chat_connection_id and provider_id', async () => {
      await expect(
        eventDestinationListenerService.createEventDestinationListener({
          instance,
          auditScope,
          input: {
            eventDestinationId: 'evtd_1',
            type: 'chat',
            chatConnectionId: 'chc_1',
            providerId: 'prov_1',
            eventTypes: ['chat.message.received']
          }
        })
      ).rejects.toThrow();

      expect(createListener).not.toHaveBeenCalled();
    });

    it('accepts a chat listener targeting a specific connection', async () => {
      let listener = await eventDestinationListenerService.createEventDestinationListener({
        instance,
        auditScope,
        input: {
          eventDestinationId: 'evtd_1',
          type: 'chat',
          chatConnectionId: 'chc_1',
          eventTypes: ['chat.message.received']
        }
      });

      expect(listener).toMatchObject({ chatConnectionId: 'chc_1', providerId: null });
    });

    it('accepts a chat listener targeting all connections of a provider', async () => {
      let listener = await eventDestinationListenerService.createEventDestinationListener({
        instance,
        auditScope,
        input: {
          eventDestinationId: 'evtd_1',
          type: 'chat',
          providerId: 'prov_1',
          eventTypes: ['chat.message.received']
        }
      });

      expect(listener).toMatchObject({ chatConnectionId: null, providerId: 'prov_1' });
    });

    it('rejects an unknown chat event type regardless of tier', async () => {
      await expect(
        eventDestinationListenerService.createEventDestinationListener({
          instance,
          auditScope,
          input: {
            eventDestinationId: 'evtd_1',
            type: 'chat',
            providerId: 'prov_1',
            eventTypes: ['chat.unknown.event']
          }
        })
      ).rejects.toThrow();

      expect(createListener).not.toHaveBeenCalled();
    });
  });
});
