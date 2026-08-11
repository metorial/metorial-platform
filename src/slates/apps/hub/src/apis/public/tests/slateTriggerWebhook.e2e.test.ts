import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SlateStatus,
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

const lockMocks = vi.hoisted(() => ({
  usingLock: vi.fn(async (_key: string, callback: () => Promise<unknown>) => callback())
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: vi.fn(() => ({ usingLock: lockMocks.usingLock }))
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
    lockMocks.usingLock.mockClear();
    lockMocks.usingLock.mockImplementation(
      async (_key: string, callback: () => Promise<unknown>) => callback()
    );
  });

  const setupWebhookScenario = async (options?: {
    triggerInvocation?: SlateTriggerReceiverTriggerSource;
    receiverStatus?: SlateTriggerReceiverStatus;
    receiverEventTypes?: string[];
    specAuthMethods?: any[];
    http?: {
      methods?: Array<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'>;
      sync?: {
        mode: 'never' | 'match' | 'always';
        match?: Array<{
          method?: string;
          hasQueryParam?: string;
          hasHeader?: string;
          jsonBodyField?: { path: string; equals?: string };
          formBodyField?: { path: string; equals?: string };
        }>;
        timeoutMs?: number;
      };
    };
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
      key: 'trigger.test',
      webhookConfig: options?.http ? { http: options.http } : undefined
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

  it('returns a matched receiver webhook response synchronously and finalizes its audit row', async () => {
    const { tenant, receiver, receiverTrigger, deployment, bucket } =
      await setupWebhookScenario({
        http: {
          methods: ['POST'],
          sync: {
            mode: 'match',
            match: [{ jsonBodyField: { path: 'type', equals: 'url_verification' } }]
          }
        }
      });

    await testDb.slateTriggerReceiverTrigger.update({
      where: { oid: receiverTrigger.oid },
      data: { registrationDetails: { signingSecret: 'registered-secret' } }
    });

    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_sync_webhook_response'
    });

    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [],
        response: {
          status: 200,
          headers: {
            'content-type': 'text/plain',
            'x-provider-response': 'present',
            'set-cookie': 'secret=value'
          },
          body: {
            encoding: 'base64',
            content: Buffer.from('challenge-value').toString('base64')
          }
        }
      }
    });

    const response = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'url_verification', challenge: 'challenge-value' })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('challenge-value');
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('x-provider-response')).toBe('present');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(queueMocks.webhookAdd).toHaveBeenCalledTimes(1);
    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationDetails: { signingSecret: 'registered-secret' }
      })
    );

    const requestRecord = await testDb.slateTriggerWebhookRequest.findFirstOrThrow({
      where: { receiverId: receiver.id }
    });
    expect(requestRecord.processedAt).not.toBeNull();
    expect(requestRecord.body).toBeNull();

    const triggerInvocation = await testDb.slateTriggerInvocation.findFirstOrThrow({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(triggerInvocation.hasResponse).toBe(true);

    const paginator = await slateTriggerInvocationService.listTriggerInvocations({
      tenant,
      receiverTriggerIds: [receiverTrigger.id]
    });
    expect((await paginator.run({ limit: 10 })).items).toHaveLength(1);
  });

  it('normalizes an informational provider response without retrying processed work', async () => {
    const { receiver, deployment, bucket } = await setupWebhookScenario({
      http: { methods: ['POST'], sync: { mode: 'always' } }
    });
    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_sync_informational_response'
    });
    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [],
        response: {
          status: 103,
          headers: { 'content-type': 'text/plain' },
          body: {
            encoding: 'base64',
            content: Buffer.from('early hints').toString('base64')
          }
        }
      }
    });

    const response = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), { method: 'POST' })
    );

    expect(response.status).toBe(502);
    expect((await response.arrayBuffer()).byteLength).toBe(0);
    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(1);
    expect(queueMocks.webhookAdd).toHaveBeenCalledTimes(1);
    expect(
      await testDb.slateTriggerWebhookRequest.findFirst({
        where: { receiverId: receiver.id }
      })
    ).toMatchObject({ processedAt: expect.any(Date) });
  });

  it('keeps matcher misses on the queued path', async () => {
    const { receiver } = await setupWebhookScenario({
      http: {
        sync: {
          mode: 'match',
          match: [{ jsonBodyField: { path: 'type', equals: 'url_verification' } }]
        }
      }
    });

    const response = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'event_callback' })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'queued' });
    expect(queueMocks.webhookAdd).toHaveBeenCalledTimes(1);
    expect(invocationMocks.handleWebhookRequest).not.toHaveBeenCalled();
  });

  it('routes matching URL-encoded form verification requests synchronously', async () => {
    const { receiver, deployment, bucket } = await setupWebhookScenario({
      http: {
        methods: ['POST'],
        sync: {
          mode: 'match',
          match: [{ formBodyField: { path: 'mode', equals: 'subscribe' } }]
        }
      }
    });
    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_sync_form_body'
    });
    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [],
        response: {
          status: 200,
          headers: { 'content-type': 'text/plain' },
          body: {
            encoding: 'base64',
            content: Buffer.from('form-challenge').toString('base64')
          }
        }
      }
    });

    const response = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'mode=subscribe&challenge=form-challenge'
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('form-challenge');
    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(1);
    expect(queueMocks.webhookAdd).toHaveBeenCalledTimes(1);
  });

  it('routes declared GET webhooks synchronously and rejects undeclared GET methods', async () => {
    const allowed = await setupWebhookScenario({
      http: {
        methods: ['GET', 'POST'],
        sync: { mode: 'always' }
      }
    });
    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: allowed.deployment.oid,
      bucketOid: allowed.bucket.oid,
      providerInvocationId: 'inv_sync_get'
    });
    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [],
        response: {
          status: 200,
          headers: { 'content-type': 'text/plain' },
          body: {
            encoding: 'base64',
            content: Buffer.from('get-challenge').toString('base64')
          }
        }
      }
    });

    const allowedResponse = await hubApp.fetch(
      new Request(`${buildReceiverWebhookUrl(allowed.receiver.id)}?challenge=abc`, {
        method: 'GET'
      })
    );
    expect(allowedResponse.status).toBe(200);
    expect(await allowedResponse.text()).toBe('get-challenge');

    await cleanDatabase();
    queueMocks.webhookAdd.mockClear();
    invocationMocks.handleWebhookRequest.mockReset();
    const denied = await setupWebhookScenario();
    const deniedResponse = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(denied.receiver.id), { method: 'GET' })
    );

    expect(deniedResponse.status).toBe(405);
    expect(deniedResponse.headers.get('allow')).toBe('POST');
    expect(queueMocks.webhookAdd).not.toHaveBeenCalled();
    expect(
      await testDb.slateTriggerWebhookRequest.findFirst({
        where: { receiverId: denied.receiver.id }
      })
    ).toMatchObject({ method: 'GET', processedAt: expect.any(Date) });
  });

  it('selects only method-compatible triggers for synchronous receiver fanout', async () => {
    const { receiver, receiverTrigger, slate, deployment, bucket } =
      await setupWebhookScenario({
        http: { methods: ['GET'], sync: { mode: 'always' } }
      });
    const postAction = await f.slateSpecification.withTriggerAction({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid,
      identifier: 'trigger.post-only',
      key: 'trigger.post-only',
      webhookConfig: { http: { methods: ['POST'], sync: { mode: 'always' } } }
    });
    await f.slateTriggerReceiver.createTrigger({
      receiverOid: receiver.oid,
      actionOid: postAction.oid,
      source: SlateTriggerReceiverTriggerSource.webhook
    });
    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_sync_mixed_methods'
    });
    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [],
        response: {
          status: 200,
          headers: { 'content-type': 'text/plain' },
          body: {
            encoding: 'base64',
            content: Buffer.from('get-only').toString('base64')
          }
        }
      }
    });

    const response = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), { method: 'GET' })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('get-only');
    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(1);
    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: 'trigger.test' })
    );
    expect(queueMocks.webhookAdd).toHaveBeenCalledTimes(1);
    expect(queueMocks.webhookAdd.mock.invocationCallOrder[0]).toBeLessThan(
      invocationMocks.handleWebhookRequest.mock.invocationCallOrder[0]!
    );
    expect(
      await testDb.slateTriggerInvocation.findFirst({
        where: { receiverTriggerOid: receiverTrigger.oid }
      })
    ).toBeTruthy();
  });

  it('fans queued receiver requests out only to method-compatible triggers', async () => {
    const { receiver, slate, deployment, bucket } = await setupWebhookScenario({
      http: { methods: ['GET'], sync: { mode: 'never' } }
    });
    const postAction = await f.slateSpecification.withTriggerAction({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid,
      identifier: 'trigger.queued-post-only',
      key: 'trigger.queued-post-only',
      webhookConfig: { http: { methods: ['POST'], sync: { mode: 'never' } } }
    });
    await f.slateTriggerReceiver.createTrigger({
      receiverOid: receiver.oid,
      actionOid: postAction.oid,
      source: SlateTriggerReceiverTriggerSource.webhook
    });

    const response = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), { method: 'GET' })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'queued' });
    expect(invocationMocks.handleWebhookRequest).not.toHaveBeenCalled();

    const requestRecord = await testDb.slateTriggerWebhookRequest.findFirstOrThrow({
      where: { receiverId: receiver.id }
    });
    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_queued_mixed_methods'
    });
    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: { inputs: [] }
    });

    await slateTriggerReceiverService.handleReceiverWebhook({
      receiverId: receiver.id,
      request: webhookRequestPayload(requestRecord)
    });

    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(1);
    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: 'trigger.test' })
    );
  });

  it('falls back to the queue when a synchronous provider invocation errors', async () => {
    const { receiver, deployment, bucket } = await setupWebhookScenario({
      http: { sync: { mode: 'always' } }
    });
    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_sync_error'
    });
    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'error',
      invocation: { oid: webhookInvocation.oid },
      error: { code: 'provider_error', message: 'Provider failed' }
    });

    const response = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), { method: 'POST' })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; webhookRequestId: string };
    expect(body.status).toBe('queued');
    expect(queueMocks.webhookAdd).toHaveBeenCalledWith({
      webhookRequestId: body.webhookRequestId,
      excludeReceiverTriggerIds: undefined
    });
  });

  it('schedules a durable queue owner when the synchronous invocation does not settle', async () => {
    const { receiver } = await setupWebhookScenario({
      http: { sync: { mode: 'always', timeoutMs: 1 } }
    });
    invocationMocks.handleWebhookRequest.mockImplementationOnce(
      () => new Promise(() => undefined)
    );

    const response = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), { method: 'POST' })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; webhookRequestId: string };
    expect(body.status).toBe('queued');
    expect(queueMocks.webhookAdd).toHaveBeenCalledWith(
      { webhookRequestId: body.webhookRequestId },
      {
        delay: expect.any(Number),
        id: `sync-fallback-${body.webhookRequestId}`
      }
    );
    expect(queueMocks.webhookAdd.mock.calls[0]?.[1]?.delay).toBeGreaterThan(15 * 60 * 1_000);
    // The queued response settles before the background owner reaches the provider RPC.
    await vi.waitFor(() =>
      expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(1)
    );
  });

  it('lets a late synchronous invocation finish once and finalize without a queue race', async () => {
    const { receiver, deployment, bucket } = await setupWebhookScenario({
      http: { sync: { mode: 'always', timeoutMs: 1 } }
    });
    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_sync_late_settlement'
    });
    let resolveInvocation!: (value: any) => void;
    invocationMocks.handleWebhookRequest.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveInvocation = resolve;
        })
    );

    const response = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), { method: 'POST' })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; webhookRequestId: string };
    expect(body.status).toBe('queued');
    expect(queueMocks.webhookAdd).toHaveBeenCalledTimes(1);

    // Wait for the background owner to invoke the provider so resolveInvocation is assigned.
    await vi.waitFor(() =>
      expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(1)
    );
    resolveInvocation({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: { inputs: [] }
    });

    await vi.waitFor(async () => {
      const requestRecord = await testDb.slateTriggerWebhookRequest.findFirstOrThrow({
        where: { id: body.webhookRequestId }
      });
      expect(requestRecord.processedAt).not.toBeNull();
    });
    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(1);
    expect(queueMocks.webhookAdd).toHaveBeenCalledTimes(1);
  });

  it('returns the first synchronous fanout response and queues the unprocessed remainder', async () => {
    const { receiver, receiverTrigger, slate, deployment, bucket } =
      await setupWebhookScenario({
        http: { sync: { mode: 'always' } }
      });
    const secondAction = await f.slateSpecification.withTriggerAction({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid,
      identifier: 'trigger.sync.second',
      key: 'trigger.sync.second',
      webhookConfig: { http: { sync: { mode: 'always' } } }
    });
    const secondTrigger = await f.slateTriggerReceiver.createTrigger({
      receiverOid: receiver.oid,
      actionOid: secondAction.oid,
      source: SlateTriggerReceiverTriggerSource.webhook
    });
    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_sync_first_wins'
    });
    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [],
        response: {
          status: 202,
          headers: { 'x-winner': 'first' },
          body: {
            encoding: 'base64',
            content: Buffer.from('first').toString('base64')
          }
        }
      }
    });

    const response = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), { method: 'POST' })
    );

    expect(response.status).toBe(202);
    expect(await response.text()).toBe('first');
    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(1);
    expect(queueMocks.webhookAdd).toHaveBeenCalledWith({
      webhookRequestId: expect.any(String),
      excludeReceiverTriggerIds: [receiverTrigger.id]
    });
    expect(secondTrigger.id).not.toBe(receiverTrigger.id);

    const requestRecord = await testDb.slateTriggerWebhookRequest.findFirstOrThrow({
      where: { receiverId: receiver.id }
    });
    expect(requestRecord.processedAt).toBeNull();
  });

  it('keeps CORS preflight unchanged and routes declared non-preflight OPTIONS', async () => {
    const { receiver, deployment, bucket } = await setupWebhookScenario({
      http: {
        methods: ['POST', 'OPTIONS'],
        sync: { mode: 'match', match: [{ method: 'OPTIONS' }] }
      }
    });

    const preflight = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), {
        method: 'OPTIONS',
        headers: { 'access-control-request-method': 'POST' }
      })
    );
    expect(preflight.status).toBe(200);
    expect(await preflight.text()).toBe('');
    expect(queueMocks.webhookAdd).not.toHaveBeenCalled();

    const webhookInvocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      providerInvocationId: 'inv_sync_options'
    });
    invocationMocks.handleWebhookRequest.mockResolvedValueOnce({
      status: 'success',
      invocation: { oid: webhookInvocation.oid },
      data: {
        inputs: [],
        response: {
          status: 200,
          headers: { 'webhook-allowed-origin': 'https://origin.test' },
          body: null
        }
      }
    });

    const actual = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), { method: 'OPTIONS' })
    );
    expect(actual.status).toBe(200);
    expect(actual.headers.get('webhook-allowed-origin')).toBe('https://origin.test');
    expect(invocationMocks.handleWebhookRequest).toHaveBeenCalledTimes(1);
    expect(queueMocks.webhookAdd).toHaveBeenCalledTimes(1);
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
        method: 'OPTIONS',
        headers: { 'access-control-request-method': 'POST' }
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

  it('reports ignored webhook requests when only polling triggers are attached', async () => {
    const { receiver } = await setupWebhookScenario({
      triggerInvocation: SlateTriggerReceiverTriggerSource.polling
    });

    const response = await hubApp.fetch(
      new Request(buildReceiverWebhookUrl(receiver.id), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'url_verification', challenge: 'challenge-value' })
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; webhookRequestId: string };
    expect(body).toMatchObject({
      status: 'ignored',
      reason: 'no_webhook_triggers_attached',
      webhookRequestId: expect.any(String)
    });
    expect(queueMocks.webhookAdd).not.toHaveBeenCalled();
    expect(invocationMocks.handleWebhookRequest).not.toHaveBeenCalled();

    const requestRecord = await testDb.slateTriggerWebhookRequest.findFirstOrThrow({
      where: { id: body.webhookRequestId }
    });
    expect(requestRecord.processedAt).not.toBeNull();
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
});
