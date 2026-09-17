import { beforeEach, describe, expect, it, vi } from 'vitest';

let { createSystemEvent, createEventDeliveryIntent, generateId, queueAdd } = vi.hoisted(
  () => ({
    createSystemEvent: vi.fn(),
    createEventDeliveryIntent: vi.fn(),
    generateId: vi.fn(),
    queueAdd: vi.fn()
  })
);

let transactionDb = {
  systemEvent: { create: createSystemEvent },
  eventDeliveryIntent: { create: createEventDeliveryIntent }
};

vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: () => unknown) => ({ build: factory }) }
}));

vi.mock('@metorial/db', () => ({
  db: {},
  ID: { generateId },
  withTransaction: (callback: (db: typeof transactionDb) => unknown) => callback(transactionDb)
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('../queues/attempt', () => ({
  attemptDeliveryQueue: { add: queueAdd }
}));

import { Fabric } from '@metorial/fabric';
import { eventDeliveryService } from './eventDelivery';

let organization = { oid: BigInt(4), id: 'org_1' } as any;

let eventDestination = {
  oid: BigInt(20),
  id: 'evtd_1',
  status: 'active',
  type: 'webhook',
  retryStrategy: 'exponential',
  retryMaxAttempts: 25,
  retryBaseDelaySeconds: 10,
  retryMaxDelaySeconds: 10800
} as any;

let auditScope = { auditScope: true } as any;

describe('eventDeliveryService.pingEventDestination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateId.mockImplementation(async (model: string) => `${model}_1`);
    createSystemEvent.mockResolvedValue({ oid: BigInt(900), id: 'sysevt_1' });
    createEventDeliveryIntent.mockResolvedValue({
      oid: BigInt(901),
      id: 'evtdi_1',
      eventDestinationListenerOid: null
    });
  });

  it('creates a ping SystemEvent and an EventDeliveryIntent with no listener', async () => {
    await eventDeliveryService.pingEventDestination({
      organization,
      eventDestination,
      auditScope
    });

    expect(createSystemEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'ping',
        eventType: 'ping',
        organizationOid: BigInt(4),
        instanceOid: null,
        payloadJson: { message: 'ping' }
      })
    });

    expect(createEventDeliveryIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          type: 'webhook',
          systemEventOid: BigInt(900),
          eventDestinationOid: BigInt(20),
          eventDestinationListenerOid: null,
          instanceOid: null
        })
      })
    );
  });

  it('enqueues the attempt directly, not via the dispatch queue', async () => {
    await eventDeliveryService.pingEventDestination({
      organization,
      eventDestination,
      auditScope
    });

    expect(queueAdd).toHaveBeenCalledWith(
      { intentId: 'evtdi_1', attemptNumber: 1 },
      { id: 'event-delivery-attempt:evtdi_1:1' }
    );
  });

  it('fires the pinged before/after Fabric events', async () => {
    await eventDeliveryService.pingEventDestination({
      organization,
      eventDestination,
      auditScope
    });

    expect(Fabric.fire).toHaveBeenCalledWith(
      'organization.event_destination.pinged:before',
      expect.objectContaining({ organization, auditScope, eventDestination })
    );
    expect(Fabric.fire).toHaveBeenCalledWith(
      'organization.event_destination.pinged:after',
      expect.objectContaining({ organization, auditScope, eventDestination })
    );
  });

  it('rejects pinging an archived event destination', async () => {
    await expect(
      eventDeliveryService.pingEventDestination({
        organization,
        eventDestination: { ...eventDestination, status: 'archived' },
        auditScope
      })
    ).rejects.toThrow();

    expect(createSystemEvent).not.toHaveBeenCalled();
    expect(queueAdd).not.toHaveBeenCalled();
  });
});
