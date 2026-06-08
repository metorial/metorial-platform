import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SlateStatus,
  SlateTriggerEventDeliveryStatus,
  SlateTriggerEventInputStatus,
  SlateTriggerInvocationType,
  SlateTriggerReceiverStatus,
  SlateTriggerReceiverTriggerSource,
  type Tenant
} from '../../../../prisma/generated/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

const signalState = vi.hoisted(() => {
  let seq = 0;
  return {
    nextId: (prefix: string) => `${prefix}_${++seq}`,
    tenants: new Map<string, { id: string; identifier: string; name: string }>(),
    senders: new Map<string, { id: string; identifier: string; name: string }>(),
    destinations: [] as Array<{
      id: string;
      tenantId: string;
      senderId: string;
      name: string;
      description?: string | null;
      eventTypes: string[] | null;
      webhook: { url: string; method: string };
    }>,
    events: [] as Array<{
      id: string;
      tenantId: string;
      senderId: string;
      topics: string[];
      eventType: string;
      payloadJson: string;
      headers: Record<string, string>;
      onlyForDestinations?: string[];
    }>
  };
});

const queueMocks = vi.hoisted(() => ({
  processAddMany: vi.fn(),
  processAdd: vi.fn(),
  sendAdd: vi.fn(),
  registerAddMany: vi.fn(),
  webhookAdd: vi.fn(),
  archiveAdd: vi.fn()
}));

const invocationMocks = vi.hoisted(() => ({
  handleWebhookRequest: vi.fn(),
  invokeTriggerMapper: vi.fn(),
  pollTriggerForEvents: vi.fn(),
  registerWebhook: vi.fn(),
  unregisterWebhook: vi.fn()
}));

vi.mock('../../../queues/trigger/eventQueues', () => ({
  slateTriggerEventProcessQueue: {
    addManyWithOps: queueMocks.processAddMany,
    add: queueMocks.processAdd
  },
  slateTriggerEventSendQueue: {
    add: queueMocks.sendAdd
  },
  slateTriggerEventInputArchiveQueue: {
    add: queueMocks.archiveAdd
  },
  slateTriggerWebhookRegisterQueue: {
    addManyWithOps: queueMocks.registerAddMany
  },
  slateTriggerWebhookUnregisterQueue: {
    addManyWithOps: vi.fn()
  }
}));

vi.mock('../../../queues/trigger/webhook', () => ({
  slateTriggerWebhookQueue: {
    add: queueMocks.webhookAdd
  }
}));

vi.mock('../../../services/slateInvocation', () => ({
  slateInvocationService: {
    createInvocationWithState: vi.fn(async () => ({ invoke: vi.fn() })),
    handleWebhookRequest: invocationMocks.handleWebhookRequest,
    invokeTriggerMapper: invocationMocks.invokeTriggerMapper,
    pollTriggerForEvents: invocationMocks.pollTriggerForEvents,
    registerWebhook: invocationMocks.registerWebhook,
    unregisterWebhook: invocationMocks.unregisterWebhook
  }
}));

vi.mock('../../../registry', () => ({
  getRegistryClient: vi.fn(async () => {
    throw new Error('Registry client not available in trigger webhook tests');
  })
}));

vi.mock('../../../functionBay', () => ({
  functionBay: {
    tenant: {
      upsert: vi.fn(async () => ({ id: 'fb-tenant' }))
    },
    function: {
      invoke: vi.fn(async () => ({
        type: 'error',
        status: 'failed',
        error: { code: 'mocked', message: 'mocked' },
        logs: [],
        computeTimeMs: 0,
        billedTimeMs: 0,
        functionVersionId: 'fv_test',
        id: 'bfi_test'
      }))
    }
  },
  functionBayTenant: { id: 'fb-tenant' },
  functionBayProvider: { oid: BigInt(1) }
}));

vi.mock('../../../signal', async () => {
  const { db } = await import('../../../db');

  const ensureSender = async () => {
    let existing = signalState.senders.get('slates-trigger-sender');
    if (existing) return existing;

    let sender = {
      id: signalState.nextId('sender'),
      identifier: 'slates-trigger-sender',
      name: 'Slates Triggers'
    };
    signalState.senders.set(sender.identifier, sender);
    return sender;
  };

  const ensureTenant = async (tenant: Tenant) => {
    let existing = signalState.tenants.get(tenant.identifier);
    if (existing) return existing;

    let signalTenant = {
      id: signalState.nextId('tenant'),
      identifier: tenant.identifier,
      name: tenant.name
    };
    signalState.tenants.set(signalTenant.identifier, signalTenant);

    await db.tenant.update({
      where: { oid: tenant.oid },
      data: { signalTenantId: signalTenant.id }
    });

    return signalTenant;
  };

  return {
    signal: {
      tenant: {
        upsert: async (input: { name: string; identifier: string }) => {
          let existing = signalState.tenants.get(input.identifier);
          if (existing) {
            existing.name = input.name;
            return existing;
          }
          let created = {
            id: signalState.nextId('tenant'),
            identifier: input.identifier,
            name: input.name
          };
          signalState.tenants.set(created.identifier, created);
          return created;
        }
      },
      sender: {
        upsert: async (input: { name: string; identifier: string }) => {
          let existing = signalState.senders.get(input.identifier);
          if (existing) {
            existing.name = input.name;
            return existing;
          }
          let created = {
            id: signalState.nextId('sender'),
            identifier: input.identifier,
            name: input.name
          };
          signalState.senders.set(created.identifier, created);
          return created;
        }
      },
      callback: {
        recordEvent: async (input: {
          tenantId: string;
          senderId: string;
          callbackId: string;
          callbackInstanceId?: string | null;
          sourceId?: string | null;
          triggerId?: string | null;
          triggerKey?: string | null;
          eventType: string;
          deliveryPayloadJson: string;
          inputJson?: string | null;
          outputJson?: string | null;
        }) => {
          let event = {
            id: signalState.nextId('event'),
            tenantId: input.tenantId,
            senderId: input.senderId,
            topics: [`callback:${input.callbackId}`],
            eventType: input.eventType,
            payloadJson: input.deliveryPayloadJson,
            headers: {},
            onlyForDestinations: undefined
          };
          signalState.events.push(event);
          return event;
        }
      },
      event: {
        create: async (input: {
          tenantId: string;
          senderId: string;
          topics: string[];
          eventType: string;
          payloadJson: string;
          headers: Record<string, string>;
          onlyForDestinations?: string[];
        }) => {
          let event = {
            id: signalState.nextId('event'),
            tenantId: input.tenantId,
            senderId: input.senderId,
            topics: input.topics,
            eventType: input.eventType,
            payloadJson: input.payloadJson,
            headers: input.headers,
            onlyForDestinations: input.onlyForDestinations
          };
          signalState.events.push(event);
          return event;
        }
      }
    },
    getTenantAndSenderForSignal: async (tenant: Tenant) => {
      let sender = await ensureSender();
      let signalTenant = tenant.signalTenantId
        ? { id: tenant.signalTenantId, identifier: tenant.identifier, name: tenant.name }
        : await ensureTenant(tenant);

      return {
        sender,
        tenant: {
          id: signalTenant.id,
          identifier: signalTenant.identifier
        }
      };
    },
    getTenantForSignal: async (tenant: Tenant) => {
      let signalTenant = tenant.signalTenantId
        ? { id: tenant.signalTenantId, identifier: tenant.identifier, name: tenant.name }
        : await ensureTenant(tenant);

      return {
        id: signalTenant.id,
        identifier: signalTenant.identifier
      };
    }
  };
});

import { slateTriggerInvocationService } from '../../../services/slateTriggerInvocation';
import { slateTriggerReceiverService } from '../../../services/slateTriggerReceiver';
import { hubApp } from '../index';

const buildWebhookUrl = (receiverTriggerId: string, suffix?: string) =>
  `http://slates-hub.test/slates-hub/triggers/webhook/${receiverTriggerId}${
    suffix ? `/${suffix}` : ''
  }`;

const buildReceiverWebhookUrl = (receiverId: string, suffix?: string) =>
  `http://slates-hub.test/slates-hub/triggers/receiver-webhook/${receiverId}${
    suffix ? `/${suffix}` : ''
  }`;

describe('slate:trigger webhook E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
    signalState.destinations.length = 0;
    signalState.events.length = 0;
    signalState.tenants.clear();
    signalState.senders.clear();
    queueMocks.processAddMany.mockClear();
    queueMocks.processAdd.mockClear();
    queueMocks.sendAdd.mockClear();
    queueMocks.registerAddMany.mockClear();
    queueMocks.webhookAdd.mockClear();
    queueMocks.archiveAdd.mockClear();
    invocationMocks.handleWebhookRequest.mockReset();
    invocationMocks.invokeTriggerMapper.mockReset();
    invocationMocks.pollTriggerForEvents.mockReset();
  });

  const setupWebhookScenario = async (options?: {
    triggerInvocation?: SlateTriggerReceiverTriggerSource;
    receiverStatus?: SlateTriggerReceiverStatus;
    receiverEventTypes?: string[];
    specAuthMethods?: any[];
  }) => {
    const tenant = await f.tenant.withIdentifier('tenant-slates');

    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active,
      specificationOverrides: options?.specAuthMethods
        ? { authMethods: options.specAuthMethods }
        : undefined
    });

    const provider = await f.deploymentProvider.functionBay();

    const deployment = await f.slateDeployment.succeeded({
      slateVersionOid: slate.currentVersion.oid,
      slateOid: slate.oid,
      providerOid: provider.oid,
      functionId: 'fn_test'
    });

    const bucket = await f.storageBucket.default('test-invocations');

    const { instance } = await f.slateInstance.withConfig({
      slateOid: slate.oid,
      tenantOid: tenant.oid,
      specificationOid: slate.currentVersion.specification.oid
    });
    const slateInstance = await testDb.slateInstance.findUniqueOrThrow({
      where: { oid: instance.oid },
      include: {
        slate: true,
        currentConfig: true
      }
    });

    const triggerAction = await f.slateSpecification.withTriggerAction({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid,
      identifier: 'trigger.test',
      key: 'trigger.test'
    });

    // Update to polling if requested
    if (options?.triggerInvocation === SlateTriggerReceiverTriggerSource.polling) {
      await testDb.slateAction.update({
        where: { oid: triggerAction.oid },
        data: {
          spec: {
            id: 'trigger.test',
            name: 'Test trigger trigger.test',
            type: 'action.trigger',
            inputSchema: {},
            outputSchema: {},
            capabilities: {},
            invocation: {
              type: 'polling',
              intervalSeconds: 60
            }
          }
        }
      });
    }

    const receiver = await slateTriggerReceiverService.createTriggerReceiver({
      tenant,
      slateInstance,
      input: {
        triggers: [{ triggerId: triggerAction.id }],
        eventTypes: options?.receiverEventTypes
      }
    });

    await testDb.slateTriggerReceiver.update({
      where: { oid: receiver.oid },
      data: {
        deliveryMode: 'callback_v2',
        callbackId: `callback_${receiver.id}`,
        callbackInstanceId: `callback_instance_${receiver.id}`
      }
    });

    if (
      options?.receiverStatus &&
      options.receiverStatus !== SlateTriggerReceiverStatus.active
    ) {
      await testDb.slateTriggerReceiver.update({
        where: { oid: receiver.oid },
        data: { status: options.receiverStatus }
      });
    }

    return {
      tenant,
      slate,
      provider,
      deployment,
      bucket,
      instance,
      triggerAction,
      receiver,
      receiverTrigger: receiver.triggers[0]!
    };
  };

  const postWebhook = async (receiverTriggerId: string, body?: Record<string, any>) => {
    const res = await hubApp.fetch(
      new Request(buildWebhookUrl(receiverTriggerId, 'events'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-test-header': 'present'
        },
        body: body ? JSON.stringify(body) : undefined
      })
    );

    expect(res.status).toBe(200);

    const requestRecord = await testDb.slateTriggerWebhookRequest.findFirst({
      where: { receiverTriggerId }
    });
    expect(requestRecord).toBeTruthy();
    return requestRecord!;
  };

  const postReceiverWebhook = async (receiverId: string, body?: Record<string, any>) => {
    const res = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiverId, 'events'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-test-header': 'present'
        },
        body: body ? JSON.stringify(body) : undefined
      })
    );

    expect(res.status).toBe(200);

    const requestRecord = await testDb.slateTriggerWebhookRequest.findFirst({
      where: { receiverId }
    });
    expect(requestRecord).toBeTruthy();
    return requestRecord!;
  };

  const webhookRequestPayload = (requestRecord: Awaited<ReturnType<typeof postWebhook>>) => ({
    url: requestRecord.url,
    method: requestRecord.method,
    headers: requestRecord.headers as Record<string, string>,
    body: requestRecord.body as { encoding: 'base64'; content: string } | null
  });

  it('creates a signal event and stores the signalEventId for webhook-triggered events', async () => {
    const tenant = await f.tenant.withIdentifier('tenant-slates');

    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });

    const provider = await f.deploymentProvider.functionBay();

    const deployment = await f.slateDeployment.succeeded({
      slateVersionOid: slate.currentVersion.oid,
      slateOid: slate.oid,
      providerOid: provider.oid,
      functionId: 'fn_test'
    });

    const bucket = await f.storageBucket.default('test-invocations');

    const { instance } = await f.slateInstance.withConfig({
      slateOid: slate.oid,
      tenantOid: tenant.oid,
      specificationOid: slate.currentVersion.specification.oid
    });
    const slateInstance = await testDb.slateInstance.findUniqueOrThrow({
      where: { oid: instance.oid },
      include: {
        slate: true,
        currentConfig: true
      }
    });

    const triggerAction = await f.slateSpecification.withTriggerAction({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid,
      identifier: 'trigger.test',
      key: 'trigger.test'
    });

    const receiver = await slateTriggerReceiverService.createTriggerReceiver({
      tenant,
      slateInstance,
      input: {
        triggers: [{ triggerId: triggerAction.id }]
      }
    });
    await testDb.slateTriggerReceiver.update({
      where: { oid: receiver.oid },
      data: {
        deliveryMode: 'callback_v2',
        callbackId: `callback_${receiver.id}`,
        callbackInstanceId: `callback_instance_${receiver.id}`
      }
    });

    expect(receiver.triggers[0]).toBeDefined();
    const receiverTrigger = receiver.triggers[0]!;
    const receiverTriggerId = receiverTrigger.id;

    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_webhook'
    });

    const mapInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_map'
    });

    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [{ payload: 'incoming' }],
        updatedState: { cursor: 'next' }
      }
    });

    invocationMocks.invokeTriggerMapper.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: mapInvocation.oid },
      data: {
        id: 'event-source-1',
        type: 'record.created',
        output: { value: 123 }
      }
    });

    const res = await hubApp.fetch(
      new Request(buildWebhookUrl(receiverTriggerId, 'events'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-test-header': 'present'
        },
        body: JSON.stringify({ hello: 'world' })
      })
    );

    expect(res.status).toBe(200);

    const requestRecord = await testDb.slateTriggerWebhookRequest.findFirst({
      where: { receiverTriggerId }
    });
    expect(requestRecord).toBeTruthy();

    await slateTriggerReceiverService.handleTriggerWebhook({
      receiverTriggerId,
      request: {
        url: requestRecord!.url,
        method: requestRecord!.method,
        headers: requestRecord!.headers as Record<string, string>,
        body: requestRecord!.body as { encoding: 'base64'; content: string } | null
      }
    });

    const eventInput = await testDb.slateTriggerEventInput.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(eventInput).toBeTruthy();
    expect(eventInput?.input).toMatchObject({ payload: 'incoming' });

    await slateTriggerReceiverService.processTriggerEventInput({
      eventInputId: eventInput!.id
    });
    expect(queueMocks.archiveAdd).toHaveBeenCalledWith(
      { eventInputId: eventInput!.id },
      { id: eventInput!.id }
    );

    const triggerEvent = await testDb.slateTriggerEvent.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(triggerEvent).toBeTruthy();

    let signalEvent = signalState.events.find(
      event => event.id === triggerEvent?.signalEventId
    );
    expect(signalEvent).toBeTruthy();
    expect(signalEvent?.onlyForDestinations).toBeUndefined();

    const payload = JSON.parse(signalEvent!.payloadJson);
    expect(payload).toMatchObject({
      object: 'callback.event_payload',
      trigger: triggerAction.key,
      type: 'record.created'
    });
  });

  it('queues receiver-level webhook requests and treats empty fanout inputs as non-matches', async () => {
    const { tenant, receiver, receiverTrigger, deployment, bucket } =
      await setupWebhookScenario();

    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_receiver_webhook_non_match'
    });

    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [],
        updatedState: { cursor: 'unchanged' }
      }
    });

    const requestRecord = await postReceiverWebhook(receiver.id, { hello: 'world' });
    expect(requestRecord.receiverId).toBe(receiver.id);
    expect(requestRecord.receiverTriggerId).toBeNull();

    await slateTriggerReceiverService.handleReceiverWebhook({
      receiverId: receiver.id,
      request: webhookRequestPayload(requestRecord)
    });

    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(1);

    const eventInput = await testDb.slateTriggerEventInput.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(eventInput).toMatchObject({
      status: SlateTriggerEventInputStatus.skipped
    });
    expect(eventInput?.input).toMatchObject({
      url: requestRecord.url,
      method: requestRecord.method
    });

    const triggerInvocationPaginator =
      await slateTriggerInvocationService.listTriggerInvocations({
        tenant,
        eventInputIds: [eventInput!.id]
      });
    const triggerInvocationList = await triggerInvocationPaginator.run({ limit: 10 });
    expect(triggerInvocationList.items).toHaveLength(1);
    expect(triggerInvocationList.items[0]?.type).toBe(
      SlateTriggerInvocationType.webhook_handle
    );
    expect(triggerInvocationList.items[0]?.invocationOid).toBe(webhookInvocation.oid);

    expect(signalState.events).toHaveLength(1);
    expect(signalState.events[0]?.topics).toEqual([`callback:callback_${receiver.id}`]);
    expect(signalState.events[0]?.eventType).toBe('trigger.test');
  });

  it('fans receiver-level webhook requests out to multiple matching webhook triggers', async () => {
    const { receiver, receiverTrigger, slate, deployment, bucket } =
      await setupWebhookScenario();

    const secondTriggerAction = await f.slateSpecification.withTriggerAction({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid,
      identifier: 'trigger.second',
      key: 'trigger.second'
    });
    const secondReceiverTrigger = await f.slateTriggerReceiver.createTrigger({
      receiverOid: receiver.oid,
      actionOid: secondTriggerAction.oid,
      source: SlateTriggerReceiverTriggerSource.webhook
    });

    const firstWebhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_receiver_webhook_first'
    });
    const secondWebhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_receiver_webhook_second'
    });

    invocationMocks.handleWebhookRequest
      .mockResolvedValueOnce({
        status: 'success',
        invocation: { oid: firstWebhookInvocation.oid },
        data: {
          inputs: [{ payload: 'first' }],
          updatedState: { cursor: 'first' }
        }
      })
      .mockResolvedValueOnce({
        status: 'success',
        invocation: { oid: secondWebhookInvocation.oid },
        data: {
          inputs: [{ payload: 'second' }],
          updatedState: { cursor: 'second' }
        }
      });

    const requestRecord = await postReceiverWebhook(receiver.id, { hello: 'world' });

    await slateTriggerReceiverService.handleReceiverWebhook({
      receiverId: receiver.id,
      request: webhookRequestPayload(requestRecord)
    });

    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(2);

    const eventInputs = await testDb.slateTriggerEventInput.findMany({
      where: {
        receiverTriggerOid: { in: [receiverTrigger.oid, secondReceiverTrigger.oid] }
      }
    });
    expect(eventInputs).toHaveLength(2);
    expect(eventInputs.map(input => input.receiverTriggerOid).sort()).toEqual(
      [receiverTrigger.oid, secondReceiverTrigger.oid].sort()
    );
    expect(eventInputs.map(input => (input.input as any).payload).sort()).toEqual([
      'first',
      'second'
    ]);
  });

  it('keeps per-trigger webhook requests scoped to one trigger', async () => {
    const { receiver, receiverTrigger, slate, deployment, bucket } =
      await setupWebhookScenario();

    const secondTriggerAction = await f.slateSpecification.withTriggerAction({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid,
      identifier: 'trigger.direct.second',
      key: 'trigger.direct.second'
    });
    const secondReceiverTrigger = await f.slateTriggerReceiver.createTrigger({
      receiverOid: receiver.oid,
      actionOid: secondTriggerAction.oid,
      source: SlateTriggerReceiverTriggerSource.webhook
    });

    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_direct_webhook_only_one'
    });

    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [{ payload: 'direct' }],
        updatedState: { cursor: 'direct' }
      }
    });

    const requestRecord = await postWebhook(receiverTrigger.id, { hello: 'world' });

    await slateTriggerReceiverService.handleTriggerWebhook({
      receiverTriggerId: receiverTrigger.id,
      request: webhookRequestPayload(requestRecord)
    });

    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(1);

    const firstInput = await testDb.slateTriggerEventInput.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    const secondInput = await testDb.slateTriggerEventInput.findFirst({
      where: { receiverTriggerOid: secondReceiverTrigger.oid }
    });
    expect(firstInput).toBeTruthy();
    expect(secondInput).toBeNull();
  });

  it('ignores receiver-level webhook requests when the receiver is paused', async () => {
    const { receiver } = await setupWebhookScenario({
      receiverStatus: SlateTriggerReceiverStatus.paused
    });

    const requestRecord = await postReceiverWebhook(receiver.id, { hello: 'world' });

    await slateTriggerReceiverService.handleReceiverWebhook({
      receiverId: receiver.id,
      request: webhookRequestPayload(requestRecord)
    });

    expect(invocationMocks.handleWebhookRequest).not.toHaveBeenCalled();
  });

  it('ignores polling triggers during receiver-level webhook fanout', async () => {
    const { receiver, receiverTrigger } = await setupWebhookScenario({
      triggerInvocation: SlateTriggerReceiverTriggerSource.polling
    });

    const requestRecord = await postReceiverWebhook(receiver.id, { hello: 'world' });

    await slateTriggerReceiverService.handleReceiverWebhook({
      receiverId: receiver.id,
      request: webhookRequestPayload(requestRecord)
    });

    expect(invocationMocks.handleWebhookRequest).not.toHaveBeenCalled();

    const eventInput = await testDb.slateTriggerEventInput.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(eventInput).toBeNull();
  });

  it('skips oversized receiver-level webhook invocation payloads', async () => {
    const { receiver, receiverTrigger } = await setupWebhookScenario();

    const requestRecord = await postReceiverWebhook(receiver.id, {
      payload: 'x'.repeat(4 * 1024 * 1024)
    });

    await slateTriggerReceiverService.handleReceiverWebhook({
      receiverId: receiver.id,
      request: webhookRequestPayload(requestRecord)
    });

    expect(invocationMocks.handleWebhookRequest).not.toHaveBeenCalled();

    const eventInput = await testDb.slateTriggerEventInput.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(eventInput).toBeNull();
  });

  it('ignores OPTIONS requests', async () => {
    const receiverTriggerId = 'trg_test_opts';

    const res = await hubApp.fetch(
      new Request(buildWebhookUrl(receiverTriggerId), {
        method: 'OPTIONS'
      })
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');

    const record = await testDb.slateTriggerWebhookRequest.findFirst({
      where: { receiverTriggerId }
    });

    expect(record).toBeNull();
    expect(queueMocks.webhookAdd).not.toHaveBeenCalled();
  });

  it('ignores webhook requests when receiver is paused', async () => {
    const { receiverTrigger } = await setupWebhookScenario({
      receiverStatus: SlateTriggerReceiverStatus.paused
    });

    const requestRecord = await postWebhook(receiverTrigger.id, { hello: 'world' });

    await slateTriggerReceiverService.handleTriggerWebhook({
      receiverTriggerId: receiverTrigger.id,
      request: {
        url: requestRecord.url,
        method: requestRecord.method,
        headers: requestRecord.headers as Record<string, string>,
        body: requestRecord.body as { encoding: 'base64'; content: string } | null
      }
    });

    expect(invocationMocks.handleWebhookRequest).not.toHaveBeenCalled();

    const eventInput = await testDb.slateTriggerEventInput.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(eventInput).toBeNull();
  });

  it('ignores webhook requests when trigger source is polling', async () => {
    const { receiverTrigger } = await setupWebhookScenario({
      triggerInvocation: SlateTriggerReceiverTriggerSource.polling
    });

    const requestRecord = await postWebhook(receiverTrigger.id, { hello: 'world' });

    await slateTriggerReceiverService.handleTriggerWebhook({
      receiverTriggerId: receiverTrigger.id,
      request: {
        url: requestRecord.url,
        method: requestRecord.method,
        headers: requestRecord.headers as Record<string, string>,
        body: requestRecord.body as { encoding: 'base64'; content: string } | null
      }
    });

    expect(invocationMocks.handleWebhookRequest).not.toHaveBeenCalled();

    const eventInput = await testDb.slateTriggerEventInput.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(eventInput).toBeNull();
  });

  it('does not enqueue inputs when webhook handler returns an error', async () => {
    const { tenant, receiverTrigger, deployment, bucket } = await setupWebhookScenario();

    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_webhook_error'
    });

    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'error',
      invocation: { oid: webhookInvocation.oid },
      error: { code: 'webhook_error', message: 'Webhook failed' }
    });

    const requestRecord = await postWebhook(receiverTrigger.id, { hello: 'world' });

    await slateTriggerReceiverService.handleTriggerWebhook({
      receiverTriggerId: receiverTrigger.id,
      request: {
        url: requestRecord.url,
        method: requestRecord.method,
        headers: requestRecord.headers as Record<string, string>,
        body: requestRecord.body as { encoding: 'base64'; content: string } | null
      }
    });

    const eventInput = await testDb.slateTriggerEventInput.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(eventInput).toMatchObject({
      status: SlateTriggerEventInputStatus.failed,
      errorCode: 'webhook_error',
      errorMessage: 'Webhook failed'
    });
    expect(eventInput?.input).toMatchObject({
      url: requestRecord.url,
      method: requestRecord.method
    });

    const triggerInvocationPaginator =
      await slateTriggerInvocationService.listTriggerInvocations({
        tenant,
        eventInputIds: [eventInput!.id]
      });
    const triggerInvocationList = await triggerInvocationPaginator.run({ limit: 10 });
    expect(triggerInvocationList.items).toHaveLength(1);
    expect(triggerInvocationList.items[0]?.type).toBe(
      SlateTriggerInvocationType.webhook_handle
    );
    expect(triggerInvocationList.items[0]?.invocationOid).toBe(webhookInvocation.oid);

    expect(signalState.events).toHaveLength(1);
    expect(signalState.events[0]?.eventType).toBe('trigger.test');
  });

  it('retries event inputs when map_event returns an error', async () => {
    const { receiverTrigger, deployment, bucket } = await setupWebhookScenario();

    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_webhook_success'
    });

    const mapInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_map_error'
    });

    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [{ payload: 'incoming' }],
        updatedState: { cursor: 'next' }
      }
    });

    invocationMocks.invokeTriggerMapper.mockResolvedValueOnce({
      status: 'error',
      invocation: { oid: mapInvocation.oid },
      error: { code: 'map_error', message: 'Map failed' }
    });

    const requestRecord = await postWebhook(receiverTrigger.id, { hello: 'world' });

    await slateTriggerReceiverService.handleTriggerWebhook({
      receiverTriggerId: receiverTrigger.id,
      request: {
        url: requestRecord.url,
        method: requestRecord.method,
        headers: requestRecord.headers as Record<string, string>,
        body: requestRecord.body as { encoding: 'base64'; content: string } | null
      }
    });

    const eventInput = await testDb.slateTriggerEventInput.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(eventInput).toBeTruthy();

    await slateTriggerReceiverService.processTriggerEventInput({
      eventInputId: eventInput!.id
    });

    const updated = await testDb.slateTriggerEventInput.findFirst({
      where: { id: eventInput!.id }
    });
    expect(updated?.status).toBe(SlateTriggerEventInputStatus.retrying);
    expect(queueMocks.processAdd).toHaveBeenCalled();
  });

  it('increments consecutivePollingFailures on failed polls and resets on success', async () => {
    const { receiverTrigger, deployment, bucket, receiver } = await setupWebhookScenario({
      triggerInvocation: SlateTriggerReceiverTriggerSource.polling
    });

    const pollErrorInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_poll_error'
    });

    const pollSuccessInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_poll_success'
    });

    invocationMocks.pollTriggerForEvents
      .mockResolvedValueOnce({
        status: 'error',
        invocation: { oid: pollErrorInvocation.oid },
        error: { code: 'poll_error', message: 'Poll failed' }
      })
      .mockResolvedValueOnce({
        status: 'success',
        invocation: { oid: pollSuccessInvocation.oid },
        data: {
          inputs: [],
          updatedState: { cursor: 'next' }
        }
      });

    await slateTriggerReceiverService.pollTriggerReceiverTrigger({
      receiverTriggerId: receiverTrigger.id
    });

    const receiverAfterFailure = await testDb.slateTriggerReceiver.findUniqueOrThrow({
      where: { oid: receiver.oid }
    });
    expect(receiverAfterFailure.consecutivePollingFailures).toBe(1);

    await slateTriggerReceiverService.pollTriggerReceiverTrigger({
      receiverTriggerId: receiverTrigger.id
    });

    const receiverAfterSuccess = await testDb.slateTriggerReceiver.findUniqueOrThrow({
      where: { oid: receiver.oid }
    });
    expect(receiverAfterSuccess.consecutivePollingFailures).toBe(0);
  });

  it('skips delivery when receiver eventTypes exclude the event type', async () => {
    const { receiverTrigger, deployment, bucket, receiver } = await setupWebhookScenario({
      receiverEventTypes: ['allowed.event']
    });

    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_webhook_success_types'
    });

    const mapInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_map_success_types'
    });

    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [{ payload: 'incoming' }],
        updatedState: { cursor: 'next' }
      }
    });

    invocationMocks.invokeTriggerMapper.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: mapInvocation.oid },
      data: {
        id: 'event-source-typed',
        type: 'different.event',
        output: { value: 456 }
      }
    });

    const requestRecord = await postWebhook(receiverTrigger.id, { hello: 'world' });

    await slateTriggerReceiverService.handleTriggerWebhook({
      receiverTriggerId: receiverTrigger.id,
      request: {
        url: requestRecord.url,
        method: requestRecord.method,
        headers: requestRecord.headers as Record<string, string>,
        body: requestRecord.body as { encoding: 'base64'; content: string } | null
      }
    });

    const eventInput = await testDb.slateTriggerEventInput.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(eventInput).toBeTruthy();

    await slateTriggerReceiverService.processTriggerEventInput({
      eventInputId: eventInput!.id
    });

    const triggerEvent = await testDb.slateTriggerEvent.findFirst({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(triggerEvent).toBeTruthy();
    expect(triggerEvent?.deliveryStatus).toBe(SlateTriggerEventDeliveryStatus.skipped);
    expect(queueMocks.sendAdd).not.toHaveBeenCalled();
  });
});
